// ─────────────────────────────────────────────────────────────────────────────
// Pump-Up calculation engine.
//
// Every formula here is copied from "Pump Analysis.xlsx" (sheets PUMPS_Transit
// and PUMPS_Doppler) so the app gives the same numbers as the workbook,
// including the workbook's use of 3.14 for π. Cell references are noted next
// to each formula; change them only together with the workbook and PostMan
// (see docs/POSTMAN_IMPORT.md).
// ─────────────────────────────────────────────────────────────────────────────

export type FlowMethod = "TRANSIT" | "DOPPLER";

const PI = 3.14; // the workbook uses 3.14, not Math.PI

export const DEFAULT_WATER_DENSITY = 998; // kg/m3 (C23)
export const DEFAULT_GRAVITY = 9.81; // m/s2 (C24)

/** Inputs as typed by the engineer. Numbers are null when the field is empty. */
export type PumpInputs = {
  method: FlowMethod;
  measuredFlowM3h?: number | null; // Transit only — "Measd/Estd Flow" (C18)
  measuredVelocity?: number | null; // Doppler only — "Measd/Estd. Velocity" (C14)
  pipePeriphery?: number | null; // mm (C19 / C15)
  pipeThickness?: number | null; // mm (C22 / C18)
  dischargePressure?: number | null; // kg/cm2 (C20 / C16)
  suctionPressure?: number | null; // kg/cm2 (C21 / C17)
  waterDensity?: number | null; // kg/m3
  gravity?: number | null; // m/s2
  inputPowerKw?: number | null; // Total input power Pe, kW (C25 / C21)
  motorEfficiency?: number | null; // % (C27 / C24)
  ratedHead?: number | null; // m
  ratedFlow?: number | null; // m3/h
  // Friction loss (rows 56-58 / 54-56)
  hwCoefficient?: number | null; // Hazen-Williams C
  equivalentLengthM?: number | null; // L, total equivalent pipe length in m
};

export type PumpResults = {
  head: number | null; // m — (Pd − Ps) × 10
  pipeOd: number | null; // mm — periphery / 3.14
  pipeId: number | null; // mm — OD − 2 × thickness
  velocity: number | null; // m/s
  flowM3h: number | null;
  flowM3min: number | null;
  flowM3s: number | null;
  flowLpm: number | null;
  hydraulicPowerKw: number | null; // Ph
  shaftPowerKw: number | null; // Ps
  pumpEfficiency: number | null; // % = Ph / Ps × 100
  flowPctOfRated: number | null;
  headPctOfRated: number | null;
  frictionLossM: number | null; // hf
};

const ok = (n: number | null | undefined): n is number =>
  typeof n === "number" && Number.isFinite(n);

/** Returns null instead of Infinity / NaN so the UI can show "—". */
function safe(n: number): number | null {
  return Number.isFinite(n) ? n : null;
}

export function calculatePump(i: PumpInputs): PumpResults {
  const density = ok(i.waterDensity) ? i.waterDensity : DEFAULT_WATER_DENSITY;
  const g = ok(i.gravity) ? i.gravity : DEFAULT_GRAVITY;

  // Head = (Discharge − Suction) × 10                         (C37 / C34)
  const head =
    ok(i.dischargePressure) && ok(i.suctionPressure)
      ? (i.dischargePressure - i.suctionPressure) * 10
      : null;

  // Pipe OD = periphery / 3.14                                (C39 / C35)
  const pipeOd = ok(i.pipePeriphery) ? i.pipePeriphery / PI : null;
  // Pipe ID = OD − 2 × thickness                              (C40 / C36)
  const pipeId = ok(pipeOd) ? pipeOd - 2 * (ok(i.pipeThickness) ? i.pipeThickness : 0) : null;

  let velocity: number | null = null;
  let flowM3s: number | null = null;
  let flowM3min: number | null = null;
  let flowM3h: number | null = null;

  if (i.method === "TRANSIT") {
    // Transit meter reads the flow; velocity is worked back from it.
    if (ok(i.measuredFlowM3h)) {
      flowM3h = i.measuredFlowM3h; //                          (C41 = C18)
      flowM3s = flowM3h / 3600; //                             (C43)
      flowM3min = flowM3s * 60; //                             (C42)
      // Velocity = Q × 10⁶ × 4 / (3.14 × ID² × 3600)          (C17)
      if (ok(pipeId) && pipeId > 0) {
        velocity = safe((flowM3h * 1000 * 1000 * 4) / (PI * pipeId * pipeId * 3600));
      }
    }
  } else {
    // Doppler meter reads the velocity; flow is worked out from the pipe ID.
    if (ok(i.measuredVelocity) && ok(pipeId)) {
      velocity = i.measuredVelocity;
      // Q (m3/s) = v × 3.14 × ID² / (10⁶ × 4)                 (C39)
      flowM3s = (velocity * PI * pipeId * pipeId) / (1000 * 1000 * 4);
      flowM3min = flowM3s * 60; //                             (C38)
      flowM3h = flowM3min * 60; //                             (C37)
    } else if (ok(i.measuredVelocity)) {
      velocity = i.measuredVelocity;
    }
  }

  // Hydraulic power Ph = Q × g × ρ × H / 1000                (C44 / C40)
  const hydraulicPowerKw =
    ok(flowM3s) && ok(head) ? (flowM3s * g * density * head) / 1000 : null;

  // Pump shaft input power Ps = Pe × (ηmotor / 100)           (C46 / C42)
  const shaftPowerKw =
    ok(i.inputPowerKw) && ok(i.motorEfficiency) ? i.inputPowerKw * (i.motorEfficiency / 100) : null;

  // Pump efficiency = Ph × 100 / Ps                           (C47 / C43)
  const pumpEfficiency =
    ok(hydraulicPowerKw) && ok(shaftPowerKw) && shaftPowerKw !== 0
      ? safe((hydraulicPowerKw * 100) / shaftPowerKw)
      : null;

  // Flow in LPM = Q (m3/s) × 1000 × 60                        (C56 / C54)
  const flowLpm = ok(flowM3s) ? flowM3s * 1000 * 60 : null;

  const frictionLossM = hazenWilliamsLoss(i.equivalentLengthM, flowLpm, i.hwCoefficient, pipeId);

  const flowPctOfRated =
    ok(flowM3h) && ok(i.ratedFlow) && i.ratedFlow > 0 ? (flowM3h / i.ratedFlow) * 100 : null;
  const headPctOfRated =
    ok(head) && ok(i.ratedHead) && i.ratedHead > 0 ? (head / i.ratedHead) * 100 : null;

  return {
    head,
    pipeOd,
    pipeId,
    velocity,
    flowM3h,
    flowM3min,
    flowM3s,
    flowLpm,
    hydraulicPowerKw,
    shaftPowerKw,
    pumpEfficiency,
    flowPctOfRated,
    headPctOfRated,
    frictionLossM,
  };
}

/**
 * Friction loss, Hazen-Williams                              (C58 / C56)
 *   hf = (6.1961×10⁸ / 100) × (L × (Q/C)^1.852) / d^4.87
 *   L = equivalent pipe length (m), Q = flow (LPM), C = H-W coefficient, d = pipe ID (mm)
 * Result is in metres of water.
 */
export function hazenWilliamsLoss(
  lengthM: number | null | undefined,
  flowLpm: number | null | undefined,
  c: number | null | undefined,
  pipeIdMm: number | null | undefined,
): number | null {
  if (!ok(lengthM) || !ok(flowLpm) || !ok(c) || c <= 0 || !ok(pipeIdMm) || pipeIdMm <= 0) return null;
  return safe(((6.1961 * 10 ** 8) / 100) * ((lengthM * Math.pow(flowLpm / c, 1.852)) / Math.pow(pipeIdMm, 4.87)));
}

// ─────────────────────────────────────────────────────────────────────────────
// Reference tables (rows 65-121 of PUMPS_Transit)
// ─────────────────────────────────────────────────────────────────────────────

/** Diameters the Hazen-Williams C table is given for (mm). */
export const HW_DIAMETERS = [75, 150, 300, 600] as const;

/** C' values for different pipe diameters. null = not given in the table ("-"). */
export const HW_TABLE: { type: string; c: (number | null)[] }[] = [
  { type: "Uncoated Cast Iron - new", c: [121, 125, 130, 132] },
  { type: "Coated Cast Iron - new", c: [129, 130, 138, 140] },
  { type: "Cast Iron - 30 years old", c: [83, 90, 97, 102] },
  { type: "Galvanised Iron - new", c: [129, 133, null, null] },
  { type: "Coated Steel - new", c: [137, 142, 145, 148] },
  { type: "Coated Asbestos Cement - clean", c: [147, 149, 150, 152] },
  { type: "Smooth pipe (lead, brass, copper), polyethylene and PVC", c: [147, 149, 150, 152] },
];

export const HW_NOTE =
  "The C values are valid at a velocity of 0.9 m/s. For higher velocities C is slightly lower, and for lower velocities slightly higher.";

/**
 * Picks the C value for a pipe type, using the table column whose diameter is
 * nearest to the pipe ID. Falls back to the nearest column that has a value.
 */
export function lookupHwC(pipeType: string, pipeIdMm: number | null): number | null {
  const row = HW_TABLE.find((r) => r.type === pipeType);
  if (!row) return null;
  const d = ok(pipeIdMm) && pipeIdMm > 0 ? pipeIdMm : HW_DIAMETERS[0];
  const order = HW_DIAMETERS.map((dia, idx) => ({ idx, dist: Math.abs(dia - d) })).sort((a, b) => a.dist - b.dist);
  for (const { idx } of order) {
    const c = row.c[idx];
    if (c !== null) return c;
  }
  return null;
}

export type Fitting = { key: string; group?: string; name: string; k: number; lOverD: number | null };

/** Loss coefficient and equivalent length (L/D) of valves and fittings. */
export const FITTINGS: Fitting[] = [
  { key: "gate_open", group: "Gate valve", name: "Fully open", k: 0.39, lOverD: 13 },
  { key: "gate_34", group: "Gate valve", name: "3/4 open", k: 1.1, lOverD: 35 },
  { key: "gate_12", group: "Gate valve", name: "1/2 open", k: 4.8, lOverD: 160 },
  { key: "gate_14", group: "Gate valve", name: "1/4 open", k: 27, lOverD: 900 },
  { key: "globe_open", name: "Globe valve - open", k: 10, lOverD: 350 },
  { key: "angle_open", name: "Angle valve - open", k: 4.3, lOverD: 170 },
  { key: "check_conv", group: "Check valve", name: "Conventional", k: 4, lOverD: 130 },
  { key: "check_clear", group: "Check valve", name: "Clearway", k: 1.5, lOverD: 50 },
  { key: "check_ball", group: "Check valve", name: "Ball", k: 4.5, lOverD: 150 },
  { key: "butterfly_open", name: "Butterfly valve - open", k: 1.2, lOverD: 40 },
  { key: "cock_straight", name: "Cock - straight through", k: 0.5, lOverD: 18 },
  { key: "foot_low", group: "Foot valve", name: "Low", k: 0.8, lOverD: null },
  { key: "foot_hinged", group: "Foot valve", name: "Hinged", k: 2.2, lOverD: 75 },
  { key: "foot_poppet", group: "Foot valve", name: "Poppet", k: 12.5, lOverD: 420 },
  { key: "elbow_90", name: "90° std. elbow", k: 0.9, lOverD: 30 },
  { key: "elbow_45", name: "45° std. elbow", k: 0.45, lOverD: 15 },
  { key: "tee_run", group: "Standard tee", name: "Flow through run", k: 0.6, lOverD: 20 },
  { key: "tee_branch", group: "Standard tee", name: "Flow through branch", k: 1.8, lOverD: 60 },
  { key: "bend90_rd2", group: "90° bend", name: "r/d = 2", k: 0.3, lOverD: 9 },
  { key: "bend90_rd8", group: "90° bend", name: "r/d = 8", k: 0.4, lOverD: 12 },
  { key: "bend90_rd20", group: "90° bend", name: "r/d = 20", k: 0.5, lOverD: 18 },
  { key: "mitre_90", group: "Mitre bend", name: "90°", k: 1.8, lOverD: 60 },
  { key: "mitre_60", group: "Mitre bend", name: "60°", k: 0.75, lOverD: 25 },
  { key: "mitre_30", group: "Mitre bend", name: "30°", k: 0.25, lOverD: 8 },
  { key: "exp_075", group: "Expansion", name: "d/D = 0.75", k: 0.18, lOverD: 6 },
  { key: "exp_050", group: "Expansion", name: "d/D = 0.5", k: 0.55, lOverD: 18 },
  { key: "exp_025", group: "Expansion", name: "d/D = 0.25", k: 0.88, lOverD: 29 },
  { key: "con_075", group: "Contraction", name: "d/D = 0.75", k: 0.18, lOverD: 6 },
  { key: "con_050", group: "Contraction", name: "d/D = 0.5", k: 0.33, lOverD: 10 },
  { key: "con_025", group: "Contraction", name: "d/D = 0.25", k: 0.43, lOverD: 14 },
  { key: "entr_proj", group: "Entrance", name: "Projecting", k: 0.78, lOverD: 26 },
  { key: "entr_sharp", group: "Entrance", name: "Sharp", k: 0.5, lOverD: 17 },
  { key: "entr_round", group: "Entrance", name: "Well rounded", k: 0.04, lOverD: 1 },
  { key: "exit", name: "Exit", k: 1, lOverD: 33 },
];

export function fittingLabel(f: Fitting): string {
  return f.group ? `${f.group} — ${f.name}` : f.name;
}

/**
 * Equivalent pipe length L (m) = straight length + Σ count × (L/D) × ID.
 * Fittings with no L/D in the table add nothing.
 */
export function equivalentLength(
  straightLengthM: number | null | undefined,
  fittings: Record<string, number> | null | undefined,
  pipeIdMm: number | null,
): { totalM: number | null; fittingsM: number } {
  let fittingsM = 0;
  if (fittings && ok(pipeIdMm) && pipeIdMm > 0) {
    for (const [key, count] of Object.entries(fittings)) {
      const f = FITTINGS.find((x) => x.key === key);
      if (!f || f.lOverD === null || !ok(count) || count <= 0) continue;
      fittingsM += count * f.lOverD * (pipeIdMm / 1000);
    }
  }
  const straight = ok(straightLengthM) ? straightLengthM : 0;
  const hasAnything = ok(straightLengthM) || fittingsM > 0;
  return { totalM: hasAnything ? straight + fittingsM : null, fittingsM };
}

// ─────────────────────────────────────────────────────────────────────────────
// Display helpers
// ─────────────────────────────────────────────────────────────────────────────

export function fmt(n: number | null | undefined, digits = 2): string {
  return ok(n) ? n.toFixed(digits) : "—";
}

/**
 * Rough reading of the pump efficiency for the field engineer. This is not in
 * the workbook; it only colours the number so a poor pump stands out.
 */
export function efficiencyBand(eff: number | null): { label: string; tone: "good" | "fair" | "poor" | "none" } {
  if (!ok(eff)) return { label: "Not enough data", tone: "none" };
  if (eff > 100) return { label: "Check readings (above 100%)", tone: "poor" };
  if (eff >= 70) return { label: "Good", tone: "good" };
  if (eff >= 50) return { label: "Fair", tone: "fair" };
  return { label: "Poor", tone: "poor" };
}
