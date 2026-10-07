import { NextResponse } from "next/server";
import { buildExcelBase64, resultsFor } from "@/lib/export-offline";
import type { CompanyProfile, PumpTest } from "@/lib/store";

export const runtime = "nodejs";

// Team that receives every submitted report (same list as Fox Kisem).
// Set REPORT_RECIPIENTS on Vercel (comma-separated) to replace it without a code change.
const TEAM_EMAILS = [
  "loriyasagar.b@iitgn.ac.in",
  "abhay.maurya@iitgn.ac.in",
  "md.faizan@iitgn.ac.in",
  "rishabh.dangi@iitgn.ac.in",
  "dhruvit.patel@iitgn.ac.in",
  "rahuljayantibhai.p@iitgn.ac.in",
  "iea@iitgn.ac.in",
];

// CORS headers for the Capacitor mobile app and any cross-origin caller
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const escapeHtml = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  let body: { jobId?: string; reporterName?: string; profile?: CompanyProfile | null; pumps?: PumpTest[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS });
  }
  const { jobId, reporterName, profile } = body;
  const pumps = Array.isArray(body.pumps) ? body.pumps : [];

  console.log("[SYNC] Received jobId:", jobId, "pumps:", pumps.length, "hasProfile:", !!profile);

  if (!profile) {
    return NextResponse.json({ ok: true, synced: { jobId }, note: "No profile — email skipped" }, { headers: CORS_HEADERS });
  }

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.error("[SYNC] SMTP_USER / SMTP_PASS missing");
    return NextResponse.json(
      { error: "Email service not configured. Add SMTP_USER and SMTP_PASS to the Vercel environment variables." },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  try {
    const engineer = reporterName || "Field Engineer";
    const { base64, filename } = buildExcelBase64(profile, pumps, engineer);
    const xlsxBuffer = Buffer.from(base64, "base64");
    const today = new Date();
    const ddmm = `${String(today.getDate()).padStart(2, "0")}${String(today.getMonth() + 1).padStart(2, "0")}`;
    const address = [profile.area, profile.district, profile.state, profile.pincode].filter(Boolean).join(", ") || "N/A";
    const finalTime = today.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    const company = profile.companyName || "Company";

    const recipients = process.env.REPORT_RECIPIENTS
      ? process.env.REPORT_RECIPIENTS.split(",").map((s) => s.trim()).filter(Boolean)
      : TEAM_EMAILS;

    const transit = pumps.filter((p) => p.method === "TRANSIT").length;
    const doppler = pumps.filter((p) => p.method === "DOPPLER").length;
    const pumpLines = pumps
      .map((p) => {
        const r = resultsFor(p);
        const eff = r.pumpEfficiency === null ? "—" : `${r.pumpEfficiency.toFixed(1)}%`;
        return `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee">${escapeHtml(p.pumpTag)}</td><td style="padding:4px 8px;border-bottom:1px solid #eee">${p.method === "TRANSIT" ? "Transit" : "Doppler"}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;text-align:right">${eff}</td></tr>`;
      })
      .join("");

    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST ?? "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"Pump-Up" <${process.env.SMTP_USER}>`,
      to: recipients.join(", "),
      subject: `Pump Test Report — ${company} (${ddmm})`,
      html: `<div style="font-family:sans-serif;color:#333;line-height:1.6;">
        <h2 style="color:#1a00aa;">Pump-Up — Pump Testing Report</h2>
        <p><strong>${escapeHtml(engineer)}</strong> has completed the pump testing for <strong>${escapeHtml(company)}</strong>.</p>
        <p>Location: ${escapeHtml(address)}<br>Completed: ${finalTime}</p>
        <p><strong>Report summary:</strong> ${pumps.length} pump(s) — ${transit} Transit, ${doppler} Doppler</p>
        ${pumps.length ? `<table style="border-collapse:collapse;font-size:13px"><tr><th style="text-align:left;padding:4px 8px">Pump</th><th style="text-align:left;padding:4px 8px">Flow meter</th><th style="text-align:right;padding:4px 8px">Efficiency</th></tr>${pumpLines}</table>` : ""}
        <p>The full Excel report is attached. It opens in PostMan as well as in Excel.</p>
        <hr style="border:none;border-top:1px solid #ddd;margin:20px 0;">
        <p style="font-size:12px;color:#999;">Pump-Up — Pump Testing System<br>IITGN Kisem Lab</p>
      </div>`,
      attachments: [{ filename, content: xlsxBuffer }],
    });

    console.log("[SYNC] Email sent to", recipients.length, "recipients");
    return NextResponse.json({ ok: true, synced: { jobId } }, { headers: CORS_HEADERS });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[SYNC] Email error:", message);
    return NextResponse.json({ error: message }, { status: 500, headers: CORS_HEADERS });
  }
}
