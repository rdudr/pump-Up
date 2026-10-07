"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Minus, Plus } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cn, toNum, toStr } from "@/lib/utils";
import {
  FITTINGS,
  HW_DIAMETERS,
  HW_NOTE,
  HW_TABLE,
  equivalentLength,
  fmt,
  hazenWilliamsLoss,
  lookupHwC,
} from "@/lib/pump-calc";
import { resultsFor } from "@/lib/export-offline";

const MANUAL = "__manual__";

function FrictionPicker() {
  const params = useSearchParams();
  const pumps = useAppStore((s) => s.pumps);
  const [pumpId, setPumpId] = useState<string>(params.get("pump") ?? MANUAL);
  const loaded = pumps.some((p) => p.id === pumpId);
  // Remount when the pump changes (or arrives from IndexedDB) to load its saved settings
  return <FrictionTool key={`${pumpId}:${loaded}`} pumpId={pumpId} setPumpId={setPumpId} />;
}

function FrictionTool({ pumpId, setPumpId }: { pumpId: string; setPumpId: (id: string) => void }) {
  const pumps = useAppStore((s) => s.pumps);
  const updatePump = useAppStore((s) => s.updatePump);

  const pump = pumps.find((p) => p.id === pumpId);
  const pumpResults = pump ? resultsFor(pump) : null;

  // Manual mode inputs (no pump selected)
  const [manualLpm, setManualLpm] = useState("");
  const [manualId, setManualId] = useState("");

  const [pipeType, setPipeType] = useState(pump?.pipeType ?? "");
  const [cValue, setCValue] = useState(toStr(pump?.hwCoefficient));
  const [straightLength, setStraightLength] = useState(toStr(pump?.straightLengthM));
  const [fittings, setFittings] = useState<Record<string, number>>(pump?.fittings ?? {});

  const flowLpm = pump ? pumpResults?.flowLpm ?? null : toNum(manualLpm);
  const pipeId = pump ? pumpResults?.pipeId ?? null : toNum(manualId);
  const velocity = pump
    ? pumpResults?.velocity ?? null
    : flowLpm !== null && pipeId !== null && pipeId > 0
      ? (flowLpm / 60000) / (3.14 * (pipeId / 1000) ** 2 / 4)
      : null;

  const suggestedC = pipeType ? lookupHwC(pipeType, pipeId) : null;
  const { totalM, fittingsM } = equivalentLength(toNum(straightLength), fittings, pipeId);
  const hf = hazenWilliamsLoss(totalM, flowLpm, toNum(cValue), pipeId);

  function choosePipeType(type: string) {
    setPipeType(type);
    const c = lookupHwC(type, pipeId);
    if (c !== null) setCValue(String(c));
  }

  function bump(key: string, delta: number) {
    setFittings((prev) => {
      const next = { ...prev, [key]: Math.max(0, (prev[key] ?? 0) + delta) };
      if (next[key] === 0) delete next[key];
      return next;
    });
  }

  function save() {
    if (!pump) return;
    updatePump(pump.id, {
      pipeType: pipeType || null,
      hwCoefficient: toNum(cValue),
      straightLengthM: toNum(straightLength),
      fittings: Object.keys(fittings).length ? fittings : null,
    });
    toast.success(`Friction loss saved to ${pump.pumpTag}`);
  }

  const cWarning =
    velocity !== null && Math.abs(velocity - 0.9) > 0.5
      ? velocity > 0.9
        ? "Velocity is well above 0.9 m/s — use a slightly lower C."
        : "Velocity is well below 0.9 m/s — use a slightly higher C."
      : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Friction loss — Hazen-Williams</CardTitle>
          <CardDescription>
            hf = (6.1961×10⁸ / 100) × L × (Q / C)<sup>1.852</sup> / d<sup>4.87</sup> — L in m, Q in LPM, d = pipe ID in mm, hf in m of water.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <Label htmlFor="pump">Pump</Label>
              <select
                id="pump"
                className="mt-1 h-9 w-full rounded-md border border-white/10 bg-slate-950/50 px-2 text-sm"
                value={pumpId}
                onChange={(e) => setPumpId(e.target.value)}
              >
                <option value={MANUAL}>Manual entry (no pump)</option>
                {pumps.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.pumpTag} — {p.method === "TRANSIT" ? "Transit" : "Doppler"}
                  </option>
                ))}
              </select>
            </div>
            {pump ? (
              <>
                <ReadOnly label="Flow Q" value={fmt(flowLpm, 1)} unit="LPM" />
                <ReadOnly label="Pipe ID d" value={fmt(pipeId)} unit="mm" />
              </>
            ) : (
              <>
                <div>
                  <Label htmlFor="lpm">Flow Q (LPM)</Label>
                  <Input id="lpm" className="mt-1" type="number" step="any" inputMode="decimal" value={manualLpm} onChange={(e) => setManualLpm(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="pid">Pipe ID d (mm)</Label>
                  <Input id="pid" className="mt-1" type="number" step="any" inputMode="decimal" value={manualId} onChange={(e) => setManualId(e.target.value)} />
                </div>
              </>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 border-t border-white/5 pt-4">
            <div className="sm:col-span-2">
              <Label htmlFor="ptype">Type of pipe</Label>
              <select
                id="ptype"
                className="mt-1 h-9 w-full rounded-md border border-white/10 bg-slate-950/50 px-2 text-sm"
                value={pipeType}
                onChange={(e) => choosePipeType(e.target.value)}
              >
                <option value="">Select pipe type…</option>
                {HW_TABLE.map((r) => <option key={r.type} value={r.type}>{r.type}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="c" className="flex h-3 items-end justify-between">
                <span>H-W coefficient C</span>
                {suggestedC !== null && <span className="text-[10px] text-slate-500">table: {suggestedC}</span>}
              </Label>
              <Input id="c" className="mt-1" type="number" step="any" inputMode="decimal" value={cValue} onChange={(e) => setCValue(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="len" className="flex h-3 items-end">Straight pipe length (m)</Label>
              <Input id="len" className="mt-1" type="number" step="any" inputMode="decimal" value={straightLength} onChange={(e) => setStraightLength(e.target.value)} />
            </div>
          </div>
          {cWarning && <p className="text-xs text-amber-300">{cWarning} {HW_NOTE}</p>}

          {/* Result */}
          <div className="rounded-xl border border-white/10 bg-slate-900/50 p-4 flex flex-wrap gap-8">
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">Friction loss hf</div>
              <div className="text-3xl text-cyan-400 font-bold tabular-nums">{fmt(hf, 3)} <span className="text-sm text-slate-500">m</span></div>
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">Equivalent length L</div>
              <div className="text-2xl text-slate-100 font-bold tabular-nums">{fmt(totalM, 2)} <span className="text-sm text-slate-500">m</span></div>
              <div className="text-[10px] text-slate-500">pipe {fmt(toNum(straightLength) ?? 0, 2)} m + fittings {fmt(fittingsM, 2)} m</div>
            </div>
            <div>
              <div className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">Velocity</div>
              <div className="text-2xl text-slate-100 font-bold tabular-nums">{fmt(velocity, 3)} <span className="text-sm text-slate-500">m/s</span></div>
            </div>
          </div>

          {pump && <Button onClick={save}>Save to {pump.pumpTag}</Button>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Valves &amp; fittings</CardTitle>
          <CardDescription>Each fitting adds count × (L/D) × pipe ID to the equivalent length.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-x-6 gap-y-1 md:grid-cols-2">
            {FITTINGS.map((f) => {
              const n = fittings[f.key] ?? 0;
              return (
                <div key={f.key} className={cn("flex items-center gap-3 rounded-md px-2 py-1.5", n > 0 && "bg-cyan-500/5")}>
                  <div className="flex-1 min-w-0 text-xs">
                    <span className="text-slate-200">{f.group ? <><span className="text-slate-400">{f.group} — </span>{f.name}</> : f.name}</span>
                    <span className="ml-2 text-[10px] text-slate-500">K {f.k} · L/D {f.lOverD ?? "—"}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={`Remove ${f.name}`} disabled={n === 0} onClick={() => bump(f.key, -1)}>
                      <Minus className="size-3.5" />
                    </Button>
                    <span className={cn("w-6 text-center text-sm tabular-nums", n > 0 ? "text-cyan-300 font-semibold" : "text-slate-500")}>{n}</span>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={`Add ${f.name}`} disabled={f.lOverD === null} onClick={() => bump(f.key, 1)}>
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[10px] text-slate-500">
            Mitre loss includes one pipe diameter up and down stream. For sudden contraction and expansion, velocities refer to the smaller pipe.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hazen-Williams C values</CardTitle>
          <CardDescription>{HW_NOTE}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-white/10">
                <th className="text-left px-2 py-2">Type of pipe</th>
                {HW_DIAMETERS.map((d) => <th key={d} className="text-right px-2 py-2">{d} mm</th>)}
              </tr>
            </thead>
            <tbody>
              {HW_TABLE.map((r) => (
                <tr key={r.type} className={cn("border-t border-white/5", r.type === pipeType && "bg-cyan-500/10")}>
                  <td className="px-2 py-2 text-slate-300">{r.type}</td>
                  {r.c.map((c, i) => <td key={i} className="px-2 py-2 text-right tabular-nums text-slate-300">{c ?? "—"}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function ReadOnly({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 flex h-9 items-center rounded-md border border-white/5 bg-slate-900/40 px-3 text-sm tabular-nums text-slate-200">
        {value} <span className="ml-1 text-xs text-slate-500">{value !== "—" && unit}</span>
      </div>
    </div>
  );
}

export default function FrictionPage() {
  return (
    <Suspense fallback={null}>
      <FrictionPicker />
    </Suspense>
  );
}
