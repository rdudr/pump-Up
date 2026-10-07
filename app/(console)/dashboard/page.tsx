"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { DashboardExportBtn } from "@/components/dashboard/export-btn";
import { EfficiencyValue } from "@/components/pump/results-panel";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { resultsFor } from "@/lib/export-offline";
import { efficiencyBand, fmt } from "@/lib/pump-calc";
import { Building2, Radio, Waves } from "lucide-react";

export default function DashboardPage() {
  const profile = useAppStore((s) => s.profile);
  const pumps = useAppStore((s) => s.pumps);

  const rows = pumps.map((p) => ({ p, r: resultsFor(p) }));
  const withEff = rows.filter((x) => x.r.pumpEfficiency !== null);
  const avgEff = withEff.length ? withEff.reduce((s, x) => s + (x.r.pumpEfficiency ?? 0), 0) / withEff.length : null;
  const totalPe = rows.reduce((s, x) => s + (x.p.inputPowerKw ?? 0), 0);
  const totalPh = rows.reduce((s, x) => s + (x.r.hydraulicPowerKw ?? 0), 0);
  const poorCount = withEff.filter((x) => efficiencyBand(x.r.pumpEfficiency).tone === "poor").length;

  // Chart scale: 0–100 %, stretched only if a reading is above 100 (which flags a bad reading)
  const maxEff = Math.max(100, ...withEff.map((x) => x.r.pumpEfficiency ?? 0));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-4 pt-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-slate-500">Current report</p>
            <h2 className="text-xl font-semibold text-slate-50">{profile?.companyName || "No company yet"}</h2>
            <p className="text-xs text-slate-400">
              {[profile?.area, profile?.district, profile?.state].filter(Boolean).join(", ") || (
                <Link href="/company" className="text-cyan-300 hover:underline">Add company details</Link>
              )}
            </p>
          </div>
          <DashboardExportBtn hasCompany={!!profile?.companyName} />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Pumps tested" value={String(pumps.length)} hint={`${pumps.filter((p) => p.method === "TRANSIT").length} Transit · ${pumps.filter((p) => p.method === "DOPPLER").length} Doppler`} />
        <KpiCard label="Average pump efficiency" value={avgEff === null ? "—" : `${avgEff.toFixed(1)}%`} hint="Simple average of pumps with full readings" />
        <KpiCard label="Total input power Pe" value={`${fmt(totalPe, 1)} kW`} hint={`Useful hydraulic power: ${fmt(totalPh, 1)} kW`} />
        <KpiCard label="Pumps below 50%" value={String(poorCount)} hint="Candidates for repair or replacement" />
      </div>

      {pumps.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Get started</CardTitle>
            <CardDescription>Add the company, then record each pump with the flow meter you used.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="secondary"><Link href="/company"><Building2 />Company details</Link></Button>
            <Button asChild><Link href="/transit"><Radio />Transit pump test</Link></Button>
            <Button asChild><Link href="/doppler"><Waves />Doppler pump test</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Pump efficiency</CardTitle>
              <CardDescription>Ph / Ps × 100 for each pump. Good ≥ 70%, Fair 50–70%, Poor below 50%.</CardDescription>
            </CardHeader>
            <CardContent>
              {withEff.length === 0 ? (
                <p className="text-sm text-slate-400">No pump has all the readings needed for efficiency yet.</p>
              ) : (
                <ul className="space-y-1">
                  {withEff.map(({ p, r }) => {
                    const eff = r.pumpEfficiency ?? 0;
                    const band = efficiencyBand(eff);
                    const tip = `${p.pumpTag} — ${eff.toFixed(1)}% (${band.label})\nFlow ${fmt(r.flowM3h)} m³/h · Head ${fmt(r.head)} m · Pe ${fmt(p.inputPowerKw)} kW`;
                    return (
                      <li key={p.id} className="group grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 rounded-md px-1 py-1 hover:bg-white/5 sm:grid-cols-[minmax(0,14rem)_1fr_auto]" title={tip}>
                        <span className="truncate text-xs text-slate-300">
                          {p.pumpTag}
                          <span className="ml-1 text-[10px] text-slate-500">{p.method === "TRANSIT" ? "T" : "D"}</span>
                        </span>
                        <div className="relative h-4 rounded-sm bg-white/[0.03]">
                          {/* reference lines at 50% and 70% */}
                          {[50, 70].map((g) => (
                            <span key={g} className="absolute inset-y-0 w-px bg-white/10" style={{ left: `${(g / maxEff) * 100}%` }} aria-hidden />
                          ))}
                          <div
                            className="absolute inset-y-0.5 left-0 rounded-r bg-cyan-400/80 transition-[width] group-hover:bg-cyan-300"
                            style={{ width: `${Math.max(0, (eff / maxEff) * 100)}%` }}
                          />
                        </div>
                        <span className="w-28 text-right text-xs tabular-nums text-slate-200">
                          {eff.toFixed(1)}% <span className="text-[10px] text-slate-500">{band.label}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-2 text-[10px] text-slate-500">T = Transit flow meter, D = Doppler flow meter. Faint lines mark 50% and 70%.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pump summary</CardTitle>
              <CardDescription>The same table as the &quot;Pump Summary&quot; sheet in the Excel report.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-white/10">
                    <th className="text-left px-2 py-2">Pump</th>
                    <th className="text-left px-2 py-2">Meter</th>
                    <th className="text-right px-2 py-2">Pe (kW)</th>
                    <th className="text-right px-2 py-2">Flow (m³/h)</th>
                    <th className="text-right px-2 py-2">Head (m)</th>
                    <th className="text-right px-2 py-2">Ph (kW)</th>
                    <th className="text-right px-2 py-2">Ps (kW)</th>
                    <th className="text-right px-2 py-2">Efficiency</th>
                    <th className="text-right px-2 py-2">hf (m)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ p, r }) => (
                    <tr key={p.id} className="border-t border-white/5">
                      <td className="px-2 py-2">
                        <Link href={p.method === "TRANSIT" ? "/transit" : "/doppler"} className="font-mono font-semibold text-cyan-300 hover:underline">{p.pumpTag}</Link>
                      </td>
                      <td className="px-2 py-2 text-slate-400">{p.method === "TRANSIT" ? "Transit" : "Doppler"}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmt(p.inputPowerKw)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmt(r.flowM3h)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmt(r.head)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmt(r.hydraulicPowerKw, 3)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmt(r.shaftPowerKw, 3)}</td>
                      <td className="px-2 py-2 text-right"><EfficiencyValue value={r.pumpEfficiency} /></td>
                      <td className="px-2 py-2 text-right tabular-nums">{fmt(r.frictionLossM, 3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
