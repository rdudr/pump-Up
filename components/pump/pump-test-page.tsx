"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAppStore, type PumpTest } from "@/lib/store";
import { useAuthStore } from "@/lib/auth-store";
import { toNum, toStr } from "@/lib/utils";
import { DEFAULT_GRAVITY, DEFAULT_WATER_DENSITY, fmt, type FlowMethod } from "@/lib/pump-calc";
import { resultsFor } from "@/lib/export-offline";
import { ResultsPanel, EfficiencyValue } from "@/components/pump/results-panel";
import { Copy, Gauge } from "lucide-react";

type Field = {
  key: keyof PumpTest;
  label: string;
  unit?: string;
  kind: "num" | "text";
  only?: FlowMethod;
  placeholder?: string;
  list?: string[];
  required?: boolean;
};

// Same rows as the "PUMP INPUT READINGS" block of the workbook
const DESCRIPTION_FIELDS: Field[] = [
  { key: "pumpTag", label: "Pump description / tag", kind: "text", placeholder: "e.g. Cooling Tower Pump-1", required: true },
  { key: "location", label: "Location", kind: "text", placeholder: "e.g. Utility building" },
  { key: "typeSize", label: "Type / Size", kind: "text", placeholder: "e.g. Centrifugal 100x80" },
  { key: "make", label: "Make", kind: "text" },
  { key: "ratedHead", label: "Rated head", unit: "m", kind: "num" },
  { key: "ratedFlow", label: "Rated flow", unit: "m³/h", kind: "num" },
  { key: "impellerDia", label: "Impeller dia.", unit: "mm", kind: "num" },
  { key: "ratedPowerHp", label: "Rated power", unit: "HP", kind: "num", only: "DOPPLER" },
];

const TRANSIT_SETUP_FIELDS: Field[] = [
  { key: "transducerModel", label: "Transducer type / model", kind: "text", list: ["TM-1", "TS2"] },
  { key: "pipeMaterial", label: "Pipe material", kind: "text", list: ["Carbon steel", "Stainless steel", "Cast iron", "Ductile iron", "PVC", "HDPE"] },
  { key: "transducerMounting", label: "Transducer mounting", kind: "text", list: ["V method", "Z method", "W method"] },
  { key: "transducerSpacing", label: "Transducer spacing", unit: "mm", kind: "num" },
];

const READING_FIELDS: Field[] = [
  { key: "measuredFlowM3h", label: "Measured flow", unit: "m³/h (CMH)", kind: "num", only: "TRANSIT", required: true },
  { key: "measuredVelocity", label: "Measured velocity", unit: "m/s", kind: "num", only: "DOPPLER", required: true },
  { key: "pipePeriphery", label: "Periphery of pipe", unit: "mm", kind: "num", required: true },
  { key: "pipeThickness", label: "Thickness of pipe", unit: "mm", kind: "num" },
  { key: "dischargePressure", label: "Pressure (discharge)", unit: "kg/cm²", kind: "num", required: true },
  { key: "suctionPressure", label: "Pressure (suction)", unit: "kg/cm²", kind: "num", required: true, placeholder: "negative if under suction" },
  { key: "inputPowerKw", label: "Total input power Pe", unit: "kW", kind: "num", required: true },
  { key: "motorEfficiency", label: "Motor efficiency", unit: "%", kind: "num", required: true },
  { key: "frequencyHz", label: "Frequency", unit: "Hz", kind: "num" },
  { key: "valveOpenPct", label: "Valve open", unit: "%", kind: "num" },
  { key: "waterDensity", label: "Water density", unit: "kg/m³", kind: "num" },
  { key: "gravity", label: "Gravitational accln.", unit: "m/s²", kind: "num" },
];

const ALL_FIELDS = [...DESCRIPTION_FIELDS, ...TRANSIT_SETUP_FIELDS, ...READING_FIELDS];

type FormState = Record<string, string>;

function emptyForm(): FormState {
  const f: FormState = { description: "" };
  for (const field of ALL_FIELDS) f[field.key] = "";
  f.waterDensity = String(DEFAULT_WATER_DENSITY);
  f.gravity = String(DEFAULT_GRAVITY);
  return f;
}

function formFromPump(p: PumpTest): FormState {
  const f = emptyForm();
  for (const field of ALL_FIELDS) f[field.key] = toStr(p[field.key] as string | number | null | undefined);
  f.description = p.description ?? "";
  return f;
}

/** Turns the form into the stored shape (numbers parsed, empty → null). */
function pumpFieldsFromForm(f: FormState, method: FlowMethod): Partial<PumpTest> {
  const out: Record<string, unknown> = {};
  for (const field of ALL_FIELDS) {
    if (field.only && field.only !== method) continue;
    out[field.key] = field.kind === "num" ? toNum(f[field.key]) : f[field.key].trim() || null;
  }
  out.description = f.description.trim() || null;
  return out as Partial<PumpTest>;
}

export function PumpTestPage({ method }: { method: FlowMethod }) {
  const isTransit = method === "TRANSIT";
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const allPumps = useAppStore((s) => s.pumps);
  const addPump = useAppStore((s) => s.addPump);
  const updatePump = useAppStore((s) => s.updatePump);
  const deletePump = useAppStore((s) => s.deletePump);
  const pumps = allPumps.filter((p) => p.method === method);

  // Live results — keep the friction settings of the pump being edited
  const editing = editingId ? allPumps.find((p) => p.id === editingId) : undefined;
  const live = useMemo(
    () =>
      resultsFor({
        ...(editing ?? {}),
        ...pumpFieldsFromForm(form, method),
        id: "live",
        method,
        pumpTag: form.pumpTag,
        createdAt: "",
      } as PumpTest),
    [form, method, editing],
  );

  const set = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  function save() {
    if (!form.pumpTag.trim()) return toast.error("Pump description / tag is required");
    const duplicate = pumps.find((p) => p.id !== editingId && p.pumpTag.trim().toLowerCase() === form.pumpTag.trim().toLowerCase());
    if (duplicate) return toast.error(`A ${isTransit ? "Transit" : "Doppler"} test named "${duplicate.pumpTag}" already exists`);

    const missing = READING_FIELDS.filter((f) => f.required && (!f.only || f.only === method) && toNum(form[f.key]) === null);
    if (missing.length) toast.warning(`Saved, but efficiency needs: ${missing.map((m) => m.label.toLowerCase()).join(", ")}`);

    const fields = pumpFieldsFromForm(form, method);
    const recordedBy = useAuthStore.getState().displayName || "Unknown";

    if (editingId) {
      updatePump(editingId, fields);
      toast.success("Pump test updated");
    } else {
      addPump({ ...(fields as PumpTest), id: crypto.randomUUID(), method, pumpTag: form.pumpTag.trim(), recordedBy, createdAt: new Date().toISOString() });
      toast.success("Pump test saved on this device");
    }
    resetForm();
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm());
  }

  function handleEdit(p: PumpTest) {
    setEditingId(p.id);
    setForm(formFromPump(p));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Next pump on the same line usually shares pipe size and meter set-up
  function handleCopy(p: PumpTest) {
    setEditingId(null);
    const f = formFromPump(p);
    f.pumpTag = "";
    setForm(f);
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.info("Readings copied — give the new pump a tag");
  }

  function handleDelete(id: string) {
    if (confirm("Delete this pump test?")) {
      deletePump(id);
      toast.success("Pump test deleted");
      if (editingId === id) resetForm();
    }
  }

  const renderField = (field: Field) => {
    if (field.only && field.only !== method) return null;
    const id = `f-${field.key}`;
    return (
      <div key={field.key}>
        <Label htmlFor={id} className="flex items-baseline justify-between gap-2">
          <span>
            {field.label}
            {field.required && <span className="text-cyan-400"> *</span>}
          </span>
          {field.unit && <span className="text-[10px] font-normal text-slate-500">{field.unit}</span>}
        </Label>
        <Input
          id={id}
          className="mt-1"
          type={field.kind === "num" ? "number" : "text"}
          inputMode={field.kind === "num" ? "decimal" : undefined}
          step="any"
          value={form[field.key]}
          placeholder={field.placeholder}
          list={field.list ? `${id}-list` : undefined}
          onChange={(e) => set(field.key, e.target.value)}
        />
        {field.list && (
          <datalist id={`${id}-list`}>
            {field.list.map((o) => <option key={o} value={o} />)}
          </datalist>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>
            {editingId ? "Edit" : "Add"} pump test — {isTransit ? "Transit flow meter" : "Doppler flow meter"}
          </CardTitle>
          <CardDescription>
            {isTransit
              ? "The transit-time meter gives the flow; the app works out the velocity from the pipe size."
              : "The Doppler meter gives the velocity; the app works out the flow from the pipe size."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <section>
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Pump description</h4>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{DESCRIPTION_FIELDS.map(renderField)}</div>
          </section>

          {isTransit && (
            <section className="border-t border-white/5 pt-4">
              <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Transit meter set-up</h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{TRANSIT_SETUP_FIELDS.map(renderField)}</div>
            </section>
          )}

          <section className="border-t border-white/5 pt-4">
            <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Pump input readings</h4>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{READING_FIELDS.map(renderField)}</div>
          </section>

          <div className="border-t border-white/5 pt-4">
            <Label htmlFor="f-description">Description / remarks</Label>
            <Textarea
              id="f-description"
              className="mt-1 h-20"
              placeholder="Condition of pump, valve throttling, leaks, noise…"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          <ResultsPanel r={live} method={method} />

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={save}>{editingId ? "Update Pump Test" : "Save Pump Test"}</Button>
            {(editingId || form.pumpTag) && (
              <Button variant="secondary" onClick={resetForm}>
                {editingId ? "Cancel" : "Clear"}
              </Button>
            )}
            {editingId && (
              <Link href={`/friction?pump=${editingId}`} className="ml-auto inline-flex items-center gap-1.5 text-xs text-cyan-300 hover:text-cyan-200">
                <Gauge className="size-4" /> Friction loss for this pump
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{isTransit ? "Transit" : "Doppler"} pump tests ({pumps.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pumps.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-slate-400 border-b border-white/10">
                    <th className="text-left px-2 py-2">#</th>
                    <th className="text-left px-2 py-2">Pump</th>
                    <th className="text-right px-2 py-2">Flow (m³/h)</th>
                    <th className="text-right px-2 py-2">Head (m)</th>
                    <th className="text-right px-2 py-2">Pe (kW)</th>
                    <th className="text-right px-2 py-2">Ph (kW)</th>
                    <th className="text-right px-2 py-2">Efficiency</th>
                    <th className="text-left px-2 py-2">Recorded</th>
                  </tr>
                </thead>
                <tbody>
                  {pumps.map((p, idx) => {
                    const r = resultsFor(p);
                    return (
                      <React.Fragment key={p.id}>
                        <tr
                          className="border-t border-white/5 hover:bg-white/5 cursor-pointer"
                          onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                        >
                          <td className="px-2 py-3 text-slate-500">{idx + 1}</td>
                          <td className="px-2 py-3">
                            <span className="block font-mono font-bold text-cyan-300">{p.pumpTag}</span>
                            <span className="text-[10px] text-slate-500">{[p.location, p.make].filter(Boolean).join(" · ") || "—"}</span>
                          </td>
                          <td className="px-2 py-3 text-right tabular-nums text-slate-300">{fmt(r.flowM3h)}</td>
                          <td className="px-2 py-3 text-right tabular-nums text-slate-300">{fmt(r.head)}</td>
                          <td className="px-2 py-3 text-right tabular-nums text-slate-300">{fmt(p.inputPowerKw)}</td>
                          <td className="px-2 py-3 text-right tabular-nums text-slate-300">{fmt(r.hydraulicPowerKw, 3)}</td>
                          <td className="px-2 py-3 text-right"><EfficiencyValue value={r.pumpEfficiency} /></td>
                          <td className="px-2 py-3 text-[10px] text-slate-500">
                            {p.recordedBy ?? "—"}
                            <br />
                            {new Date(p.createdAt).toLocaleString("en-IN")}
                          </td>
                        </tr>
                        {expanded === p.id && (
                          <tr className="bg-slate-900/50">
                            <td colSpan={8} className="px-4 py-3">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-slate-300">
                                <Detail label="Type / size" value={p.typeSize} />
                                <Detail label="Rated head / flow" value={`${fmt(p.ratedHead)} m / ${fmt(p.ratedFlow)} m³/h`} />
                                <Detail label="Pressures (Pd / Ps)" value={`${fmt(p.dischargePressure)} / ${fmt(p.suctionPressure)} kg/cm²`} />
                                <Detail label="Pipe OD / ID" value={`${fmt(r.pipeOd)} / ${fmt(r.pipeId)} mm`} />
                                <Detail label="Velocity" value={`${fmt(r.velocity, 3)} m/s`} />
                                <Detail label="Motor eff. / Ps" value={`${fmt(p.motorEfficiency, 1)} % / ${fmt(r.shaftPowerKw, 3)} kW`} />
                                <Detail label="Frequency / valve open" value={`${fmt(p.frequencyHz, 1)} Hz / ${fmt(p.valveOpenPct, 0)} %`} />
                                <Detail label="Friction loss hf" value={`${fmt(r.frictionLossM, 3)} m`} />
                                {isTransit && <Detail label="Transducer" value={[p.transducerModel, p.transducerMounting, p.transducerSpacing ? `${p.transducerSpacing} mm` : null].filter(Boolean).join(", ")} />}
                                <div className="col-span-2"><Detail label="Description" value={p.description} /></div>
                                <div className="col-span-full pt-2 flex flex-wrap justify-end gap-2">
                                  <Button asChild variant="ghost" size="sm"><Link href={`/friction?pump=${p.id}`}>Friction loss</Link></Button>
                                  <Button variant="secondary" size="sm" onClick={(ev) => { ev.stopPropagation(); handleCopy(p); }}><Copy className="size-3.5" />Copy to new</Button>
                                  <Button variant="secondary" size="sm" onClick={(ev) => { ev.stopPropagation(); handleEdit(p); }}>Edit</Button>
                                  <Button variant="destructive" size="sm" onClick={(ev) => { ev.stopPropagation(); handleDelete(p.id); }}>Delete</Button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-slate-400 text-sm">No {isTransit ? "Transit" : "Doppler"} pump tests recorded yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="block text-[10px] uppercase text-slate-500">{label}</span>
      {value || "—"}
    </div>
  );
}
