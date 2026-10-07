"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Download, AlertTriangle, CloudUpload, Loader2, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { useAppStore, type CompanyProfile, type PumpTest } from "@/lib/store";
import { useAuthStore } from "@/lib/auth-store";
import { exportOfflineExcel } from "@/lib/export-offline";
import { MailSendModal } from "@/components/dashboard/mail-send-modal";
import { toast } from "sonner";

// Server the Android app posts to — embedded at build time
const PROD_SERVER = (process.env.NEXT_PUBLIC_API_URL || "https://pump-up.vercel.app").replace(/\/$/, "");

// ─── Resolve server URL ──────────────────────────────────────────────────
function getServerBase(): string {
  if (typeof window === "undefined") return PROD_SERVER;
  const stored = localStorage.getItem("PUMP_UP_SERVER_URL");
  if (stored) return stored.replace(/\/$/, "");
  // Inside the Android app (Capacitor) there is no API on the device — use Vercel
  const origin = window.location.origin;
  if (origin.startsWith("capacitor:") || origin.startsWith("file:") || origin === "https://localhost") return PROD_SERVER;
  // Web: use the current origin (works on preview deployments and `npm run dev`)
  return origin;
}

export function DashboardExportBtn({ hasCompany }: { hasCompany: boolean }) {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [mailModalStatus, setMailModalStatus] = useState<"sending" | "success" | "error" | "idle">("idle");
  const [mailErrorMessage, setMailErrorMessage] = useState<string | undefined>(undefined);
  const [syncJobCount, setSyncJobCount] = useState(0);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<"synced" | "queued">("queued");

  const profile = useAppStore((s) => s.profile);
  const pumps = useAppStore((s) => s.pumps);
  const wipeData = useAppStore((s) => s.wipeData);
  const syncQueue = useAppStore((s) => s.syncQueue);
  const addJobToQueue = useAppStore((s) => s.addJobToQueue);
  const updateJobStatus = useAppStore((s) => s.updateJobStatus);
  const pruneQueue = useAppStore((s) => s.pruneQueue);
  const displayName = useAuthStore((s) => s.displayName);
  const authLogout = useAuthStore((s) => s.logout);

  const pendingJobs = syncQueue.filter((j) => j.status === "pending");

  useEffect(() => {
    pruneQueue();
  }, [pruneQueue]);

  // ─── Try to POST one job to the server ──────────────────────────────────
  async function trySyncJob(
    jobId: string,
    payload: { profile: CompanyProfile | null; pumps: PumpTest[] },
    reporterName: string,
  ): Promise<{ ok: boolean; error?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);
      const res = await fetch(`${getServerBase()}/api/sync/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, reporterName, ...payload }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        updateJobStatus(jobId, "synced");
        return { ok: true };
      }
      const body = await res.json().catch(() => ({ error: "Server error" }));
      return { ok: false, error: body.error || `Server error ${res.status}` };
    } catch (err) {
      return { ok: false, error: `Connection failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  // ─── Download only (no email) ────────────────────────────────────────────
  const handleDownloadOnly = async () => {
    const saved = await exportOfflineExcel(profile, pumps, displayName || "Engineer").catch(() => null);
    if (saved) toast.success("Excel saved ✓");
    else toast.error("Could not save the Excel file.");
  };

  // ─── Main submit handler ─────────────────────────────────────────────────
  const handleExportAndComplete = async (skipCompanyCheck = false) => {
    if (!hasCompany && !skipCompanyCheck) {
      setShowWarning(true);
      return;
    }
    if (pumps.length === 0) {
      toast.error("Add at least one pump test before submitting.");
      return;
    }

    setExporting(true);
    const jobId = crypto.randomUUID();
    const reporterName = displayName || "Engineer";
    const payload = { profile, pumps };

    // 1. Always save the Excel file locally first
    let savedUri: string | null = null;
    try {
      savedUri = await exportOfflineExcel(profile, pumps, reporterName);
    } catch (err) {
      console.error("[export] local save failed:", err);
    }
    if (!savedUri) {
      toast.error("Could not write the Excel file to this device.");
      setExporting(false);
      return;
    }
    toast.success("Excel saved to device ✓");

    // 2. Queue the job so it can be retried if sending fails now
    addJobToQueue({ jobId, status: "pending", createdAt: Date.now(), reporterName, payload });

    // 3. Always attempt to send immediately (don't rely on navigator.onLine)
    setSyncJobCount(1);
    setMailModalStatus("sending");
    const result = await trySyncJob(jobId, payload, reporterName);
    if (result.ok) {
      setLastSyncResult("synced");
      setMailModalStatus("success");
      setMailErrorMessage(undefined);
      toast.success("Report emailed to the team ✓");
      setTimeout(() => setMailModalStatus("idle"), 2500);
    } else {
      setLastSyncResult("queued");
      setMailErrorMessage(result.error);
      setMailModalStatus("error");
    }

    setExporting(false);
    setShowCompleteModal(true);
  };

  // ─── Retry all pending jobs ──────────────────────────────────────────────
  const handleSyncAll = async () => {
    if (pendingJobs.length === 0) return toast.info("No pending reports to send.");

    setSyncing(true);
    setMailModalStatus("sending");
    setSyncJobCount(pendingJobs.length);

    let ok = 0;
    let lastError: string | undefined;
    for (const job of pendingJobs) {
      const result = await trySyncJob(job.jobId, job.payload, job.reporterName);
      if (result.ok) ok++;
      else lastError = result.error;
    }

    if (ok > 0) {
      setMailModalStatus("success");
      if (ok === pendingJobs.length) toast.success(`All ${ok} report(s) sent ✓`);
      else toast.warning(`Sent ${ok} of ${pendingJobs.length}. The rest stay queued.`);
      setTimeout(() => setMailModalStatus("idle"), 2000);
    } else {
      setMailErrorMessage(lastError);
      setMailModalStatus("error");
      toast.error("Sending failed. Check the internet connection.");
    }
    setSyncing(false);
  };

  const handleLogoutAction = () => {
    // Do NOT wipe data on logout — preserve in-progress reports
    authLogout();
    router.push("/login");
  };

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
      <MailSendModal
        isOpen={mailModalStatus !== "idle" && !showCompleteModal}
        status={mailModalStatus}
        companyName={profile?.companyName || "Your Company"}
        jobCount={syncJobCount || 1}
        errorMessage={mailErrorMessage}
        onClose={() => setMailModalStatus("idle")}
      />

      <Button onClick={handleDownloadOnly} variant="secondary" className="border-cyan-500/30 text-cyan-50 hover:bg-cyan-500/10 gap-2 w-full sm:w-auto">
        <FileSpreadsheet className="size-4" />
        Download Excel
      </Button>

      {pendingJobs.length > 0 ? (
        <Button
          onClick={handleSyncAll}
          disabled={syncing}
          variant="secondary"
          className="relative border border-red-500/50 text-red-50 hover:bg-red-500/10 gap-2 pr-10 w-full sm:w-auto animate-pulse"
        >
          {syncing ? <Loader2 className="size-4 animate-spin" /> : <CloudUpload className="size-4" />}
          {syncing ? "Sending…" : "Resend"}
          <span className="absolute top-1/2 -translate-y-1/2 right-2 px-1.5 min-w-[20px] h-5 flex items-center justify-center bg-red-600 text-white text-[10px] font-bold rounded-full">
            {pendingJobs.length}
          </span>
        </Button>
      ) : (
        <Button disabled variant="secondary" className="border border-slate-500/30 text-slate-400 gap-2 w-full sm:w-auto opacity-50">
          <CloudUpload className="size-4" />
          All Sent
        </Button>
      )}

      <Button
        onClick={() => void handleExportAndComplete()}
        disabled={exporting}
        className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 font-semibold shadow-lg shadow-emerald-900/20 w-full sm:w-auto"
      >
        {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        {exporting ? "Generating…" : "Submit Report"}
      </Button>

      {/* ── Missing company modal ── */}
      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-slate-900 border border-white/10 p-6 rounded-xl shadow-2xl max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4 text-amber-400">
              <AlertTriangle className="size-6" />
              <h3 className="text-lg font-semibold">Missing Company Details</h3>
            </div>
            <p className="text-slate-300 text-sm mb-6">
              No company details found. The report will show &quot;Unknown Company&quot;, and the email is skipped without a company. Add the details for a proper report.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => { setShowWarning(false); router.push("/company"); }} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white">
                Add Company Details
              </Button>
              <Button
                onClick={() => { setShowWarning(false); void handleExportAndComplete(true); }}
                variant="ghost"
                className="w-full text-slate-400 hover:text-white"
              >
                Export Anyway
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Report completion modal ── */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
          <div className="bg-slate-900 border border-white/10 p-6 rounded-xl shadow-2xl max-w-sm w-full text-center">
            <div className="flex justify-center mb-4">
              <div className={lastSyncResult === "synced" ? "rounded-full bg-emerald-500/20 p-3" : "rounded-full bg-amber-500/20 p-3"}>
                {lastSyncResult === "synced" ? <CheckCircle2 className="size-10 text-emerald-400" /> : <AlertTriangle className="size-10 text-amber-400" />}
              </div>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Report Generated</h3>
            <p className="text-sm text-slate-300 mb-6">
              Excel file saved to this device.
              {lastSyncResult === "synced"
                ? " ✓ Email sent to the team."
                : ` The email could not be sent${mailErrorMessage ? ` (${mailErrorMessage})` : ""}. The report is queued — press 'Resend' when online.`}
            </p>
            <div className="flex flex-col gap-3">
              <Button onClick={handleLogoutAction} className="w-full bg-slate-700 hover:bg-slate-600 text-white gap-2 font-medium">
                Logout
              </Button>
              <Button
                onClick={() => {
                  if (pendingJobs.length > 0 && !confirm("Some reports are still queued. Starting a new report keeps them queued but clears the current tests. Continue?")) return;
                  const queue = useAppStore.getState().syncQueue;
                  wipeData();
                  useAppStore.setState({ syncQueue: queue });
                  setShowCompleteModal(false);
                  setMailModalStatus("idle");
                  router.push("/company");
                }}
                variant="secondary"
                className="w-full border border-white/20 text-white bg-white/5 hover:bg-white/10"
              >
                New Report
              </Button>
              <Button
                onClick={() => { setShowCompleteModal(false); setMailModalStatus("idle"); }}
                variant="ghost"
                className="w-full text-slate-400 hover:text-white"
              >
                Continue Editing
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
