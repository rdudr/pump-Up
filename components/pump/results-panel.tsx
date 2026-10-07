import { cn } from "@/lib/utils";
import { efficiencyBand, fmt, type PumpResults } from "@/lib/pump-calc";

const toneText = {
  good: "text-emerald-400",
  fair: "text-amber-300",
  poor: "text-red-400",
  none: "text-slate-400",
} as const;

export function EfficiencyValue({ value, className }: { value: number | null; className?: string }) {
  const band = efficiencyBand(value);
  return <span className={cn("font-bold tabular-nums", toneText[band.tone], className)}>{fmt(value, 1)}{value !== null && "%"}</span>;
}

function Stat({ label, value, unit, highlight }: { label: string; value: string; unit?: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-white/5 bg-slate-950/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={cn("text-base font-semibold tabular-nums", highlight ? "text-cyan-300" : "text-slate-100")}>
        {value}
        {unit && value !== "—" && <span className="ml-1 text-[11px] font-normal text-slate-500">{unit}</span>}
      </div>
    </div>
  );
}

/** Live "PUMP ANALYSYS" block — the lower half of the workbook sheet. */
export function ResultsPanel({ r, method }: { r: PumpResults; method: "TRANSIT" | "DOPPLER" }) {
  const band = efficiencyBand(r.pumpEfficiency);
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">Pump efficiency (Ph / Ps × 100)</div>
          <div className="flex items-baseline gap-3">
            <EfficiencyValue value={r.pumpEfficiency} className="text-4xl" />
            <span className={cn("text-xs font-medium", toneText[band.tone])}>{band.label}</span>
          </div>
        </div>
        <div className="flex gap-6">
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">Hydraulic power Ph</div>
            <div className="text-2xl text-cyan-400 font-bold tabular-nums">{fmt(r.hydraulicPowerKw, 3)} <span className="text-sm text-slate-500">kW</span></div>
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">Shaft power Ps</div>
            <div className="text-2xl text-cyan-400 font-bold tabular-nums">{fmt(r.shaftPowerKw, 3)} <span className="text-sm text-slate-500">kW</span></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Head" value={fmt(r.head)} unit="m" highlight />
        <Stat label={method === "TRANSIT" ? "Velocity (calc.)" : "Velocity (meas.)"} value={fmt(r.velocity, 3)} unit="m/s" />
        <Stat label="Pipe OD" value={fmt(r.pipeOd)} unit="mm" />
        <Stat label="Pipe ID" value={fmt(r.pipeId)} unit="mm" />
        <Stat label={method === "TRANSIT" ? "Flow (meas.)" : "Flow (calc.)"} value={fmt(r.flowM3h)} unit="m³/h" highlight />
        <Stat label="Flow" value={fmt(r.flowM3min, 3)} unit="m³/min" />
        <Stat label="Flow" value={fmt(r.flowM3s, 5)} unit="m³/s" />
        <Stat label="Flow" value={fmt(r.flowLpm, 1)} unit="LPM" />
        <Stat label="Flow vs rated" value={fmt(r.flowPctOfRated, 1)} unit="%" />
        <Stat label="Head vs rated" value={fmt(r.headPctOfRated, 1)} unit="%" />
        <Stat label="Friction loss hf" value={fmt(r.frictionLossM, 3)} unit="m" />
      </div>
    </div>
  );
}
