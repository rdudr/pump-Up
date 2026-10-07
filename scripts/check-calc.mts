// Checks lib/pump-calc.ts against the formulas in the original workbook.
//
// It reads the formula text from "Pump Analysis.xlsx", puts test readings into
// column C, evaluates the cells by following their references, and compares the
// results with calculatePump(). Run:
//   npm run test:calc -- "C:\path\to\Pump Analysis.xlsx"
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { calculatePump, type PumpInputs } from "../lib/pump-calc.ts";

const file = process.argv[2] ?? "C:/Users/risha/Downloads/Pump Analysis (1).xlsx";
const wb = XLSX.read(readFileSync(file), { cellFormula: true });

function evaluator(ws: XLSX.WorkSheet, inputs: Record<string, number>) {
  const cache = new Map<string, number>();
  const value = (addr: string): number => {
    if (addr in inputs) return inputs[addr];
    if (cache.has(addr)) return cache.get(addr)!;
    const cell = ws[addr];
    let out: number;
    if (cell?.f) {
      const js = cell.f
        .replace(/\$?\b([A-Z]{1,2})\$?(\d+)\b/g, (_m: string, c: string, r: string) => `(${value(c + r)})`)
        .replace(/\^/g, "**");
      out = Function(`"use strict"; return (${js});`)() as number;
    } else {
      out = typeof cell?.v === "number" ? cell.v : 0;
    }
    cache.set(addr, out);
    return out;
  };
  return value;
}

let failures = 0;
function compare(label: string, excel: number, app: number | null) {
  const okay = app !== null && Math.abs(excel - app) <= Math.max(1e-9, Math.abs(excel) * 1e-9);
  if (!okay) failures++;
  console.log(`${okay ? "PASS" : "FAIL"}  ${label.padEnd(28)} excel=${excel.toPrecision(10).padEnd(16)} app=${app}`);
}

// ── Transit sheet ─────────────────────────────────────────────────────────
{
  const ws = wb.Sheets["PUMPS_Transit"];
  const t = { flow: 120, periphery: 600, thickness: 6, pd: 3.2, ps: -0.2, pe: 18.5, motorEff: 90, L: 91.44 };
  const value = evaluator(ws, {
    C18: t.flow, C19: t.periphery, C22: t.thickness, C20: t.pd, C21: t.ps, C25: t.pe, C27: t.motorEff, C57: t.L,
  });
  const C = value("B73"); // the workbook's friction formula uses B73
  const app: PumpInputs = {
    method: "TRANSIT", measuredFlowM3h: t.flow, pipePeriphery: t.periphery, pipeThickness: t.thickness,
    dischargePressure: t.pd, suctionPressure: t.ps, inputPowerKw: t.pe, motorEfficiency: t.motorEff,
    waterDensity: value("C23"), gravity: value("C24"), hwCoefficient: C, equivalentLengthM: t.L,
  };
  const r = calculatePump(app);
  console.log("\nPUMPS_Transit");
  compare("Velocity (C17)", value("C17"), r.velocity);
  compare("Head (C37)", value("C37"), r.head);
  compare("Pipe OD (C39)", value("C39"), r.pipeOd);
  compare("Pipe ID (C40)", value("C40"), r.pipeId);
  compare("Flow m3/min (C42)", value("C42"), r.flowM3min);
  compare("Flow m3/s (C43)", value("C43"), r.flowM3s);
  compare("Hydraulic power Ph (C44)", value("C44"), r.hydraulicPowerKw);
  compare("Shaft power Ps (C46)", value("C46"), r.shaftPowerKw);
  compare("Pump efficiency (C47)", value("C47"), r.pumpEfficiency);
  compare("Flow LPM (C56)", value("C56"), r.flowLpm);
  compare("Friction loss hf (C58)", value("C58"), r.frictionLossM);
}

// ── Doppler sheet ─────────────────────────────────────────────────────────
{
  const ws = wb.Sheets["PUMPS_Doppler"];
  const d = { velocity: 2.224897, periphery: 500, thickness: 5, pd: 2.8, ps: 0.3, pe: 15, motorEff: 88, L: 91.44 };
  const value = evaluator(ws, {
    C14: d.velocity, C15: d.periphery, C18: d.thickness, C16: d.pd, C17: d.ps, C21: d.pe, C24: d.motorEff, C55: d.L,
    // The Doppler sheet leaves density and g blank — use the Transit defaults
    C19: 998, C20: 9.81,
  });
  const app: PumpInputs = {
    method: "DOPPLER", measuredVelocity: d.velocity, pipePeriphery: d.periphery, pipeThickness: d.thickness,
    dischargePressure: d.pd, suctionPressure: d.ps, inputPowerKw: d.pe, motorEfficiency: d.motorEff,
    waterDensity: 998, gravity: 9.81, hwCoefficient: value("B71"), equivalentLengthM: d.L,
  };
  const r = calculatePump(app);
  console.log("\nPUMPS_Doppler");
  compare("Head (C34)", value("C34"), r.head);
  compare("Pipe OD (C35)", value("C35"), r.pipeOd);
  compare("Pipe ID (C36)", value("C36"), r.pipeId);
  compare("Flow m3/h (C37)", value("C37"), r.flowM3h);
  compare("Flow m3/min (C38)", value("C38"), r.flowM3min);
  compare("Flow m3/s (C39)", value("C39"), r.flowM3s);
  compare("Hydraulic power Ph (C40)", value("C40"), r.hydraulicPowerKw);
  compare("Shaft power Ps (C42)", value("C42"), r.shaftPowerKw);
  compare("Pump efficiency (C43)", value("C43"), r.pumpEfficiency);
  compare("Flow LPM (C54)", value("C54"), r.flowLpm);
  compare("Friction loss hf (C56)", value("C56"), r.frictionLossM);
}

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed — the app matches the workbook.");
process.exit(failures ? 1 : 0);
