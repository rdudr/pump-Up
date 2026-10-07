import * as XLSX from "xlsx";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import type { CompanyProfile, PumpTest } from "@/lib/store";
import {
  calculatePump,
  equivalentLength,
  FITTINGS,
  fittingLabel,
  type PumpResults,
  DEFAULT_GRAVITY,
  DEFAULT_WATER_DENSITY,
} from "@/lib/pump-calc";

// ─────────────────────────────────────────────────────────────────────────────
// Pump result helper — shared by the screens, the export and the email
// ─────────────────────────────────────────────────────────────────────────────
export function resultsFor(p: PumpTest): PumpResults & { equivalentLengthM: number | null } {
  const pipeOd = typeof p.pipePeriphery === "number" ? p.pipePeriphery / 3.14 : null;
  const pipeId = pipeOd !== null ? pipeOd - 2 * (p.pipeThickness ?? 0) : null;
  const { totalM } = equivalentLength(p.straightLengthM, p.fittings, pipeId);
  const r = calculatePump({ ...p, equivalentLengthM: totalM });
  return { ...r, equivalentLengthM: totalM };
}

export function fittingsText(fittings: Record<string, number> | null | undefined): string {
  if (!fittings) return "";
  return Object.entries(fittings)
    .filter(([, n]) => n > 0)
    .map(([key, n]) => {
      const f = FITTINGS.find((x) => x.key === key);
      return f ? `${fittingLabel(f)} x${n}` : `${key} x${n}`;
    })
    .join("; ");
}

const r2 = (n: number | null | undefined, d = 2) => (typeof n === "number" && Number.isFinite(n) ? Number(n.toFixed(d)) : "");
const v = <T,>(x: T | null | undefined) => (x === null || x === undefined ? "" : x);
const date = (iso: string) => new Date(iso).toLocaleString("en-IN");

// ─────────────────────────────────────────────────────────────────────────────
// Flat sheets (what PostMan reads — see docs/POSTMAN_IMPORT.md)
// ─────────────────────────────────────────────────────────────────────────────
const COMMON_DESC_HEADERS = [
  "Pump Tag", "Location", "Type/Size", "Make", "Rated Head (m)", "Rated Flow (m3/h)", "Impeller Dia (mm)", "Rated Power (HP)",
];

const TRANSIT_HEADERS = [
  ...COMMON_DESC_HEADERS,
  "Transducer Type/Model", "Pipe Material", "Transducer Mounting", "Transducer Spacing (mm)",
  "Measured Flow (m3/h)", "Pipe Periphery (mm)", "Discharge Pressure (kg/cm2)", "Suction Pressure (kg/cm2)",
  "Pipe Thickness (mm)", "Water Density (kg/m3)", "Gravity (m/s2)", "Input Power Pe (kW)", "Frequency (Hz)",
  "Motor Efficiency (%)", "Valve Open (%)",
  "Velocity (m/s)", "Head (m)", "Pipe OD (mm)", "Pipe ID (mm)", "Flow (m3/min)", "Flow (m3/s)", "Flow (LPM)",
  "Hydraulic Power Ph (kW)", "Shaft Power Ps (kW)", "Pump Efficiency (%)", "Flow vs Rated (%)", "Head vs Rated (%)",
  "Pipe Type", "H-W Coefficient C", "Straight Length (m)", "Fittings", "Equivalent Length L (m)", "Friction Loss hf (m)",
  "Description", "Photo Path", "Recorded By", "Date",
];

const DOPPLER_HEADERS = [
  ...COMMON_DESC_HEADERS,
  "Measured Velocity (m/s)", "Pipe Periphery (mm)", "Discharge Pressure (kg/cm2)", "Suction Pressure (kg/cm2)",
  "Pipe Thickness (mm)", "Water Density (kg/m3)", "Gravity (m/s2)", "Input Power Pe (kW)", "Frequency (Hz)",
  "Motor Efficiency (%)", "Valve Open (%)",
  "Head (m)", "Pipe OD (mm)", "Pipe ID (mm)", "Flow (m3/h)", "Flow (m3/min)", "Flow (m3/s)", "Flow (LPM)",
  "Hydraulic Power Ph (kW)", "Shaft Power Ps (kW)", "Pump Efficiency (%)", "Flow vs Rated (%)", "Head vs Rated (%)",
  "Pipe Type", "H-W Coefficient C", "Straight Length (m)", "Fittings", "Equivalent Length L (m)", "Friction Loss hf (m)",
  "Description", "Photo Path", "Recorded By", "Date",
];

function descCols(p: PumpTest) {
  return [p.pumpTag, v(p.location), v(p.typeSize), v(p.make), v(p.ratedHead), v(p.ratedFlow), v(p.impellerDia), v(p.ratedPowerHp)];
}

function frictionAndMeta(p: PumpTest, r: ReturnType<typeof resultsFor>) {
  return [
    v(p.pipeType), v(p.hwCoefficient), v(p.straightLengthM), fittingsText(p.fittings),
    r2(r.equivalentLengthM), r2(r.frictionLossM, 3),
    v(p.description), v(p.photoPath), p.recordedBy ?? "Unknown", date(p.createdAt),
  ];
}

function transitRow(p: PumpTest) {
  const r = resultsFor(p);
  return [
    ...descCols(p),
    v(p.transducerModel), v(p.pipeMaterial), v(p.transducerMounting), v(p.transducerSpacing),
    v(p.measuredFlowM3h), v(p.pipePeriphery), v(p.dischargePressure), v(p.suctionPressure),
    v(p.pipeThickness), p.waterDensity ?? DEFAULT_WATER_DENSITY, p.gravity ?? DEFAULT_GRAVITY, v(p.inputPowerKw), v(p.frequencyHz),
    v(p.motorEfficiency), v(p.valveOpenPct),
    r2(r.velocity, 3), r2(r.head), r2(r.pipeOd), r2(r.pipeId), r2(r.flowM3min, 3), r2(r.flowM3s, 5), r2(r.flowLpm),
    r2(r.hydraulicPowerKw, 3), r2(r.shaftPowerKw, 3), r2(r.pumpEfficiency), r2(r.flowPctOfRated, 1), r2(r.headPctOfRated, 1),
    ...frictionAndMeta(p, r),
  ];
}

function dopplerRow(p: PumpTest) {
  const r = resultsFor(p);
  return [
    ...descCols(p),
    v(p.measuredVelocity), v(p.pipePeriphery), v(p.dischargePressure), v(p.suctionPressure),
    v(p.pipeThickness), p.waterDensity ?? DEFAULT_WATER_DENSITY, p.gravity ?? DEFAULT_GRAVITY, v(p.inputPowerKw), v(p.frequencyHz),
    v(p.motorEfficiency), v(p.valveOpenPct),
    r2(r.head), r2(r.pipeOd), r2(r.pipeId), r2(r.flowM3h), r2(r.flowM3min, 3), r2(r.flowM3s, 5), r2(r.flowLpm),
    r2(r.hydraulicPowerKw, 3), r2(r.shaftPowerKw, 3), r2(r.pumpEfficiency), r2(r.flowPctOfRated, 1), r2(r.headPctOfRated, 1),
    ...frictionAndMeta(p, r),
  ];
}

const SUMMARY_HEADERS = [
  "Pump Tag", "Flow Meter", "Location", "Input Power Pe (kW)", "Flow (m3/h)", "Head (m)",
  "Hydraulic Power Ph (kW)", "Shaft Power Ps (kW)", "Pump Efficiency (%)", "Friction Loss hf (m)", "Recorded By", "Date",
];

// ─────────────────────────────────────────────────────────────────────────────
// Sheets in the layout of the original "Pump Analysis" workbook:
// parameters down the rows, one pump per column from C, live formulas.
// Row numbers match the original so the formulas are the same text.
// ─────────────────────────────────────────────────────────────────────────────
type RowSpec = {
  row: number;
  label: string;
  unit?: string;
  value?: (p: PumpTest, r: ReturnType<typeof resultsFor>, idx: number) => string | number | null | undefined;
  formula?: string; // "{c}" is replaced by the pump's column letter
  cached?: (p: PumpTest, r: ReturnType<typeof resultsFor>, idx: number) => string | number | null | undefined;
};

const TRANSIT_LAYOUT: { title: string; titleRow: number; inputHeaderRow: number; analysisHeaderRow: number; rows: RowSpec[] } = {
  title: "For Transit Flow Meter",
  titleRow: 3,
  inputHeaderRow: 5,
  analysisHeaderRow: 29,
  rows: [
    { row: 6, label: "PUMP DESCRIPTION", unit: "→", value: (p) => p.pumpTag },
    { row: 7, label: "", unit: "UNITS", value: (_p, _r, i) => i + 1 },
    { row: 8, label: "TYPE/SIZE", value: (p) => p.typeSize },
    { row: 9, label: "MAKE", value: (p) => p.make },
    { row: 10, label: "RATED HEAD", unit: "Mtr.", value: (p) => p.ratedHead },
    { row: 11, label: "RATED FLOW", unit: "M3/H", value: (p) => p.ratedFlow },
    { row: 12, label: "IMPELLER DIA.", unit: "MM", value: (p) => p.impellerDia },
    { row: 13, label: "Transducer Type/Model", unit: "TM-1 or TS2", value: (p) => p.transducerModel },
    { row: 14, label: "Pipe material", unit: "--NA--", value: (p) => p.pipeMaterial },
    { row: 15, label: "Transducer Mounting", unit: "Method", value: (p) => p.transducerMounting },
    { row: 16, label: "Transducers Spacing", unit: "mm", value: (p) => p.transducerSpacing },
    { row: 17, label: "Measd/Estd. Velocity.", unit: "Mt/sec", formula: "({c}18*1000*1000*4)/(3.14*{c}40*{c}40*3600)", cached: (_p, r) => r.velocity },
    { row: 18, label: "Measd/Estd Flow", unit: "CMH", value: (p) => p.measuredFlowM3h },
    { row: 19, label: "Periphery of Pipe", unit: "mm", value: (p) => p.pipePeriphery },
    { row: 20, label: "Pressure(Discharge)", unit: "Kg/cm2", value: (p) => p.dischargePressure },
    { row: 21, label: "Pressure(Suction)", unit: "Kg/cm2", value: (p) => p.suctionPressure },
    { row: 22, label: "thickness of pipe ", unit: "mm", value: (p) => p.pipeThickness },
    { row: 23, label: "Water Density", unit: "Kg/m3", value: (p) => p.waterDensity ?? DEFAULT_WATER_DENSITY },
    { row: 24, label: "Gravitational Accln.", unit: "M/s2", value: (p) => p.gravity ?? DEFAULT_GRAVITY },
    { row: 25, label: "Total Input power Pe", unit: "KW", value: (p) => p.inputPowerKw },
    { row: 26, label: "Frequency", unit: "Hz", value: (p) => p.frequencyHz },
    { row: 27, label: "Motor efficiency", unit: "%ge", value: (p) => p.motorEfficiency },
    { row: 28, label: "%ge VALVE OPEN", unit: "%ge", value: (p) => p.valveOpenPct },
    { row: 30, label: "PUMP DESCRIPTION", unit: "→", formula: "{c}6", cached: (p) => p.pumpTag },
    { row: 31, label: "", unit: "UNITS", formula: "{c}7", cached: (_p, _r, i) => i + 1 },
    { row: 32, label: "TYPE/SIZE", formula: "{c}8", cached: (p) => p.typeSize },
    { row: 33, label: "MAKE", formula: "{c}9", cached: (p) => p.make },
    { row: 34, label: "RATED HEAD", unit: "Mtr.", formula: "{c}10", cached: (p) => p.ratedHead },
    { row: 35, label: "RATED FLOW", unit: "M3/H", formula: "{c}11", cached: (p) => p.ratedFlow },
    { row: 36, label: "Total Input power Pe", unit: "KW", formula: "{c}25", cached: (p) => p.inputPowerKw },
    { row: 37, label: "Head", unit: "Mtr", formula: "({c}20-{c}21)*10", cached: (_p, r) => r.head },
    { row: 38, label: "Measured/Estd Flow", unit: "CMH", formula: "{c}18", cached: (p) => p.measuredFlowM3h },
    { row: 39, label: "Pipe OD", unit: "mm", formula: "{c}19/3.14", cached: (_p, r) => r.pipeOd },
    { row: 40, label: "Pipe ID", unit: "mm", formula: "{c}39-(2*{c}22)", cached: (_p, r) => r.pipeId },
    { row: 41, label: "Measured/Calculated Flow", unit: "Mtr Cu./Hr", formula: "{c}18", cached: (_p, r) => r.flowM3h },
    { row: 42, label: "", unit: "Mtr Cu./Min", formula: "{c}43*60", cached: (_p, r) => r.flowM3min },
    { row: 43, label: "", unit: "Mtr Cu./Sec", formula: "{c}41/3600", cached: (_p, r) => r.flowM3s },
    { row: 44, label: "Hydraulic Power Ph", unit: "KW", formula: "{c}43*{c}24*{c}23*{c}37/1000", cached: (_p, r) => r.hydraulicPowerKw },
    { row: 45, label: "Motor efficiency", unit: "%ge", formula: "{c}27", cached: (p) => p.motorEfficiency },
    { row: 46, label: "Pump Shaft input Power Ps", unit: "KW", formula: "{c}25*({c}45/100)", cached: (_p, r) => r.shaftPowerKw },
    { row: 47, label: "Efficiency of Pump", unit: "%ge = (Ph/Ps* 100)", formula: "{c}44*100/{c}46", cached: (_p, r) => r.pumpEfficiency },
    { row: 55, label: "Hazen-Williams C", unit: "C", value: (p) => p.hwCoefficient },
    { row: 56, label: "Flow", unit: "LPM", formula: "{c}43*1000*60", cached: (_p, r) => r.flowLpm },
    { row: 57, label: "Equivalent pipe length", unit: "L (m)", value: (_p, r) => (r.equivalentLengthM === null ? null : Number(r.equivalentLengthM.toFixed(3))) },
    { row: 58, label: "Friction loss", unit: "hf (m)", formula: "((6.1961*10^8)/100)*(({c}57*({c}56/{c}55)^1.852)/{c}40^4.87)", cached: (_p, r) => r.frictionLossM },
  ],
};

const DOPPLER_LAYOUT: typeof TRANSIT_LAYOUT = {
  title: "For Doppler Flow Meter",
  titleRow: 4,
  inputHeaderRow: 6,
  analysisHeaderRow: 26,
  rows: [
    { row: 7, label: "PUMP DESCRIPTION", unit: "→", value: (p) => p.pumpTag },
    { row: 8, label: "", unit: "UNITS", value: (_p, _r, i) => i + 1 },
    { row: 9, label: "TYPE/SIZE", value: (p) => p.typeSize },
    { row: 10, label: "MAKE", value: (p) => p.make },
    { row: 11, label: "RATED HEAD", unit: "Mtr.", value: (p) => p.ratedHead },
    { row: 12, label: "RATED FLOW", unit: "M3/H", value: (p) => p.ratedFlow },
    { row: 13, label: "IMPELLER DIA.", unit: "MM", value: (p) => p.impellerDia },
    { row: 14, label: "Measd/Estd. Velocity.", unit: "Mt/sec", value: (p) => p.measuredVelocity },
    { row: 15, label: "Periphery of Pipe", unit: "mm", value: (p) => p.pipePeriphery },
    { row: 16, label: "Pressure(Discharge)", unit: "Kg/cm2", value: (p) => p.dischargePressure },
    { row: 17, label: "Pressure(Suction)", unit: "Kg/cm2", value: (p) => p.suctionPressure },
    { row: 18, label: "thickness of pipe ", unit: "mm", value: (p) => p.pipeThickness },
    { row: 19, label: "Water Density", unit: "Kg/m3", value: (p) => p.waterDensity ?? DEFAULT_WATER_DENSITY },
    { row: 20, label: "Gravitatioal Accln.", unit: "M/s2", value: (p) => p.gravity ?? DEFAULT_GRAVITY },
    { row: 21, label: "Total Input power Pe", unit: "KW", value: (p) => p.inputPowerKw },
    { row: 22, label: "Frequecy", unit: "Hz", value: (p) => p.frequencyHz },
    { row: 23, label: "Rated Power", unit: "HP", value: (p) => p.ratedPowerHp },
    { row: 24, label: "Motor efficiency", unit: "%ge", value: (p) => p.motorEfficiency },
    { row: 25, label: "%ge VALVE OPEN", unit: "%ge", value: (p) => p.valveOpenPct },
    { row: 27, label: "PUMP DESCRIPTION", unit: "→", formula: "{c}7", cached: (p) => p.pumpTag },
    { row: 28, label: "", unit: "UNITS", formula: "{c}8", cached: (_p, _r, i) => i + 1 },
    { row: 29, label: "TYPE/SIZE", formula: "{c}9", cached: (p) => p.typeSize },
    { row: 30, label: "MAKE", formula: "{c}10", cached: (p) => p.make },
    { row: 31, label: "RATED HEAD", unit: "Mtr.", formula: "{c}11", cached: (p) => p.ratedHead },
    { row: 32, label: "RATED FLOW", unit: "M3/H", formula: "{c}12", cached: (p) => p.ratedFlow },
    { row: 33, label: "Total Input power Pe", unit: "KW", formula: "{c}21", cached: (p) => p.inputPowerKw },
    { row: 34, label: "Head", unit: "mtr", formula: "({c}16-{c}17)*10", cached: (_p, r) => r.head },
    { row: 35, label: "Pipe OD", unit: "mm", formula: "{c}15/3.14", cached: (_p, r) => r.pipeOd },
    { row: 36, label: "Pipe ID", unit: "mm", formula: "{c}35-(2*{c}18)", cached: (_p, r) => r.pipeId },
    { row: 37, label: "Measured/Calculated Flow", unit: "Mtr Cu./Hr", formula: "{c}38*60", cached: (_p, r) => r.flowM3h },
    { row: 38, label: "", unit: "Mtr Cu./Min", formula: "{c}39*60", cached: (_p, r) => r.flowM3min },
    { row: 39, label: "", unit: "Mtr Cu./Sec", formula: "{c}14*3.14*{c}36*{c}36/(1000*1000*4)", cached: (_p, r) => r.flowM3s },
    { row: 40, label: "Hydraulic Power Ph", unit: "KW", formula: "{c}39*{c}20*{c}19*{c}34/1000", cached: (_p, r) => r.hydraulicPowerKw },
    { row: 41, label: "Motor efficiency", unit: "%ge", formula: "{c}24", cached: (p) => p.motorEfficiency },
    { row: 42, label: "Pump Shaft input Power Ps", unit: "KW", formula: "{c}21*({c}41/100)", cached: (_p, r) => r.shaftPowerKw },
    { row: 43, label: "Efficiency of Pump", unit: "%ge = (Ph/Ps* 100)", formula: "{c}40*100/{c}42", cached: (_p, r) => r.pumpEfficiency },
    { row: 53, label: "Hazen-Williams C", unit: "C", value: (p) => p.hwCoefficient },
    { row: 54, label: "Flow", unit: "LPM", formula: "{c}39*1000*60", cached: (_p, r) => r.flowLpm },
    { row: 55, label: "Equivalent pipe length", unit: "L (m)", value: (_p, r) => (r.equivalentLengthM === null ? null : Number(r.equivalentLengthM.toFixed(3))) },
    { row: 56, label: "Friction loss", unit: "hf (m)", formula: "((6.1961*10^8)/100)*(({c}55*({c}54/{c}53)^1.852)/{c}36^4.87)", cached: (_p, r) => r.frictionLossM },
  ],
};

function buildAnalysisSheet(pumps: PumpTest[], layout: typeof TRANSIT_LAYOUT): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  const put = (addr: string, cell: XLSX.CellObject) => {
    ws[addr] = cell;
  };
  const text = (s: string): XLSX.CellObject => ({ t: "s", v: s });

  put(`A${layout.titleRow}`, text(layout.title));
  put(`A${layout.inputHeaderRow}`, text("PUMP  INPUT READINGS"));
  put(`A${layout.analysisHeaderRow}`, text("PUMP  ANALYSYS"));
  const lastFrictionRow = Math.max(...layout.rows.map((r) => r.row));
  put(`A${lastFrictionRow - 4}`, text("FRICTION LOSS (Hazen-Williams)"));

  const results = pumps.map(resultsFor);

  for (const spec of layout.rows) {
    if (spec.label) put(`A${spec.row}`, text(spec.label));
    if (spec.unit) put(`B${spec.row}`, text(spec.unit));

    pumps.forEach((p, idx) => {
      const col = XLSX.utils.encode_col(2 + idx); // C, D, E, …
      const addr = `${col}${spec.row}`;
      if (spec.formula) {
        const cached = spec.cached?.(p, results[idx], idx);
        const f = spec.formula.replaceAll("{c}", col);
        if (typeof cached === "number" && Number.isFinite(cached)) put(addr, { t: "n", v: cached, f });
        else if (typeof cached === "string" && cached !== "") put(addr, { t: "s", v: cached, f });
        else put(addr, { t: "s", v: "", f });
      } else if (spec.value) {
        const val = spec.value(p, results[idx], idx);
        if (typeof val === "number" && Number.isFinite(val)) put(addr, { t: "n", v: val });
        else if (typeof val === "string" && val !== "") put(addr, text(val));
      }
    });
  }

  const lastCol = XLSX.utils.encode_col(Math.max(2, 1 + pumps.length));
  ws["!ref"] = `A1:${lastCol}${lastFrictionRow}`;
  ws["!cols"] = [{ wch: 28 }, { wch: 16 }, ...pumps.map(() => ({ wch: 14 }))];
  return ws;
}

// ─────────────────────────────────────────────────────────────────────────────
// Workbook builder — shared between local export and server email attachment
// ─────────────────────────────────────────────────────────────────────────────
export function buildWorkbook(profile: CompanyProfile | null, pumps: PumpTest[], reporterName?: string): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const transit = pumps.filter((p) => p.method === "TRANSIT");
  const doppler = pumps.filter((p) => p.method === "DOPPLER");

  // Sheet 1: Company Profile
  if (profile) {
    const profileRows = [
      ["Company Name", profile.companyName],
      ["Area / Zone", profile.area],
      ["District", profile.district],
      ["State", profile.state],
      ["Pincode", profile.pincode],
      ["Reported By", reporterName ?? ""],
      ["Export Date", new Date().toLocaleString("en-IN")],
      ["Source App", "Pump-Up"],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(profileRows), "Company Profile");
  }

  // Sheet 2: Pump Summary (all pumps, both meters)
  const summaryRows = pumps.map((p) => {
    const r = resultsFor(p);
    return [
      p.pumpTag, p.method === "TRANSIT" ? "Transit" : "Doppler", v(p.location), v(p.inputPowerKw),
      r2(r.flowM3h), r2(r.head), r2(r.hydraulicPowerKw, 3), r2(r.shaftPowerKw, 3), r2(r.pumpEfficiency),
      r2(r.frictionLossM, 3), p.recordedBy ?? "Unknown", date(p.createdAt),
    ];
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([SUMMARY_HEADERS, ...summaryRows]), "Pump Summary");

  // Sheets 3-4: flat tables
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([TRANSIT_HEADERS, ...transit.map(transitRow)]), "Pump Tests Transit");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([DOPPLER_HEADERS, ...doppler.map(dopplerRow)]), "Pump Tests Doppler");

  // Sheets 5-6: same layout as the original Pump Analysis workbook
  XLSX.utils.book_append_sheet(wb, buildAnalysisSheet(transit, TRANSIT_LAYOUT), "PUMPS_Transit");
  XLSX.utils.book_append_sheet(wb, buildAnalysisSheet(doppler, DOPPLER_LAYOUT), "PUMPS_Doppler");

  return wb;
}

export function getFilename(profile: CompanyProfile | null): string {
  const company = profile?.companyName?.trim().replace(/\s+/g, "_") || "export";
  const today = new Date();
  const ddmm = `${String(today.getDate()).padStart(2, "0")}${String(today.getMonth() + 1).padStart(2, "0")}`;
  return `${company}_PumpUp_${ddmm}.xlsx`;
}

/**
 * exportOfflineExcel
 * Android: silently saves the Excel file to the device's Documents folder and
 *          returns its URI.
 * Web:     triggers a browser download.
 */
export async function exportOfflineExcel(
  profile: CompanyProfile | null,
  pumps: PumpTest[],
  reporterName?: string,
): Promise<string | null> {
  const wb = buildWorkbook(profile, pumps, reporterName);
  const filename = getFilename(profile);

  if (Capacitor.isNativePlatform()) {
    const base64 = XLSX.write(wb, { bookType: "xlsx", type: "base64" });
    // Try saving to Documents first (visible in Files app), fall back to Cache
    for (const dir of [Directory.Documents, Directory.Cache]) {
      try {
        const result = await Filesystem.writeFile({ path: filename, data: base64, directory: dir, recursive: true });
        return result.uri;
      } catch (e) {
        console.warn(`[export] Write to ${dir} failed, trying next:`, e);
      }
    }
    console.error("[export] All write targets failed");
    return null;
  }

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 200);
  return filename;
}

/** buildExcelBase64 — used by the sync job to send the file as an email attachment */
export function buildExcelBase64(
  profile: CompanyProfile | null,
  pumps: PumpTest[],
  reporterName?: string,
): { base64: string; filename: string } {
  const wb = buildWorkbook(profile, pumps, reporterName);
  const base64 = XLSX.write(wb, { bookType: "xlsx", type: "base64" });
  return { base64, filename: getFilename(profile) };
}
