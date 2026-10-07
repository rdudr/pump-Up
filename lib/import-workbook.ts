import * as XLSX from "xlsx";
import type { CompanyProfile, PumpTest } from "@/lib/store";
import { FITTINGS, fittingLabel, type FlowMethod } from "@/lib/pump-calc";

export type ImportSummary = { added: number; updated: number; profileFound: boolean };

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");

const num = (val: unknown): number | null => {
  if (val === undefined || val === null || val === "") return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
};
const str = (val: unknown): string | null => {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  return s === "" ? null : s;
};

// Accepts ISO strings, Excel serial numbers and "DD/MM/YYYY, HH:MM:SS (am/pm)"
function parseExcelDate(val: unknown): string {
  if (val === undefined || val === null || val === "") return new Date().toISOString();
  if (typeof val === "number") {
    const d = new Date((val - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  const s = String(val).trim();
  const parts = s.split(/[\/\-,\s:]+/);
  if (parts.length >= 3 && /^\d{1,2}$/.test(parts[0])) {
    let hour = parts.length >= 6 ? parseInt(parts[3], 10) : 0;
    const minute = parts.length >= 6 ? parseInt(parts[4], 10) : 0;
    const second = parts.length >= 6 ? parseInt(parts[5], 10) : 0;
    const lower = s.toLowerCase();
    if (lower.includes("pm") && hour < 12) hour += 12;
    if (lower.includes("am") && hour === 12) hour = 0;
    const d = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10), hour, minute, second);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function parseFittings(text: unknown): Record<string, number> | null {
  const s = str(text);
  if (!s) return null;
  const out: Record<string, number> = {};
  for (const part of s.split(";")) {
    const m = part.trim().match(/^(.*)\s+x(\d+(?:\.\d+)?)$/);
    if (!m) continue;
    const f = FITTINGS.find((x) => norm(fittingLabel(x)) === norm(m[1]) || x.key === m[1].trim());
    if (f) out[f.key] = Number(m[2]);
  }
  return Object.keys(out).length ? out : null;
}

// Header text (normalised) → PumpTest field
const FIELD_MAP: Record<string, { key: keyof PumpTest; kind: "num" | "str" }> = {
  "pump tag": { key: "pumpTag", kind: "str" },
  location: { key: "location", kind: "str" },
  "type/size": { key: "typeSize", kind: "str" },
  make: { key: "make", kind: "str" },
  "rated head (m)": { key: "ratedHead", kind: "num" },
  "rated flow (m3/h)": { key: "ratedFlow", kind: "num" },
  "impeller dia (mm)": { key: "impellerDia", kind: "num" },
  "rated power (hp)": { key: "ratedPowerHp", kind: "num" },
  "transducer type/model": { key: "transducerModel", kind: "str" },
  "pipe material": { key: "pipeMaterial", kind: "str" },
  "transducer mounting": { key: "transducerMounting", kind: "str" },
  "transducer spacing (mm)": { key: "transducerSpacing", kind: "num" },
  "measured flow (m3/h)": { key: "measuredFlowM3h", kind: "num" },
  "measured velocity (m/s)": { key: "measuredVelocity", kind: "num" },
  "pipe periphery (mm)": { key: "pipePeriphery", kind: "num" },
  "discharge pressure (kg/cm2)": { key: "dischargePressure", kind: "num" },
  "suction pressure (kg/cm2)": { key: "suctionPressure", kind: "num" },
  "pipe thickness (mm)": { key: "pipeThickness", kind: "num" },
  "water density (kg/m3)": { key: "waterDensity", kind: "num" },
  "gravity (m/s2)": { key: "gravity", kind: "num" },
  "input power pe (kw)": { key: "inputPowerKw", kind: "num" },
  "frequency (hz)": { key: "frequencyHz", kind: "num" },
  "motor efficiency (%)": { key: "motorEfficiency", kind: "num" },
  "valve open (%)": { key: "valveOpenPct", kind: "num" },
  "pipe type": { key: "pipeType", kind: "str" },
  "h-w coefficient c": { key: "hwCoefficient", kind: "num" },
  "straight length (m)": { key: "straightLengthM", kind: "num" },
  description: { key: "description", kind: "str" },
  "photo path": { key: "photoPath", kind: "str" },
  "recorded by": { key: "recordedBy", kind: "str" },
};

function readPumpSheet(ws: XLSX.WorkSheet, method: FlowMethod): Omit<PumpTest, "id">[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
  if (rows.length < 2) return [];
  const headers = (rows[0] as unknown[]).map(norm);
  const out: Omit<PumpTest, "id">[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row || row.length === 0) continue;
    const p: Record<string, unknown> = { method, createdAt: new Date().toISOString() };
    headers.forEach((h, idx) => {
      const val = row[idx];
      if (h === "fittings") p.fittings = parseFittings(val);
      else if (h === "date") p.createdAt = parseExcelDate(val);
      else if (FIELD_MAP[h]) p[FIELD_MAP[h].key] = FIELD_MAP[h].kind === "num" ? num(val) : str(val);
      // Calculated columns are ignored — the app recalculates them.
    });
    if (p.pumpTag) out.push(p as Omit<PumpTest, "id">);
  }
  return out;
}

/**
 * Reads a Pump-Up export and merges it into the current data.
 * Pumps merge by flow meter + pump tag: a pump in the file replaces its
 * earlier copy, the rest stay — so importing the same file twice never
 * creates duplicates.
 */
export function importWorkbook(
  wb: XLSX.WorkBook,
  existing: PumpTest[],
  currentUserName = "Unknown",
): { pumps: PumpTest[]; profile: Partial<CompanyProfile> | null; summary: ImportSummary } {
  let profile: Partial<CompanyProfile> | null = null;
  const incoming: Omit<PumpTest, "id">[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const name = norm(sheetName);
    if (name === "company profile") {
      profile = {};
      for (const row of XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 })) {
        if (!row || row.length < 2) continue;
        const key = norm(row[0]);
        const val = String(row[1] ?? "").trim();
        if (key.includes("company name")) profile.companyName = val;
        else if (key.includes("area")) profile.area = val;
        else if (key.includes("district")) profile.district = val;
        else if (key.includes("state")) profile.state = val;
        else if (key.includes("pincode")) profile.pincode = val;
      }
    } else if (name === "pump tests transit") {
      incoming.push(...readPumpSheet(ws, "TRANSIT"));
    } else if (name === "pump tests doppler") {
      incoming.push(...readPumpSheet(ws, "DOPPLER"));
    }
  }

  if (!profile && incoming.length === 0) {
    throw new Error("No Pump-Up sheets found. Expected 'Pump Tests Transit' or 'Pump Tests Doppler'.");
  }

  // Same rules as Fox Kisem's import: match by name (case / space-insensitive),
  // keep the existing record's id, take the file's readings, and keep who
  // recorded it — from the file, else the existing record, else the importer.
  const pumps = [...existing];
  let added = 0;
  let updated = 0;
  for (const p of incoming) {
    const idx = pumps.findIndex((x) => x.method === p.method && norm(x.pumpTag) === norm(p.pumpTag));
    if (idx >= 0) {
      const prev = pumps[idx];
      pumps[idx] = { ...prev, ...p, id: prev.id, recordedBy: p.recordedBy || prev.recordedBy || currentUserName };
      updated++;
    } else {
      pumps.push({ ...p, id: crypto.randomUUID(), recordedBy: p.recordedBy || currentUserName });
      added++;
    }
  }

  return { pumps, profile, summary: { added, updated, profileFound: !!profile } };
}
