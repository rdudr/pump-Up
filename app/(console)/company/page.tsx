"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";

const FIELDS = [
  { key: "companyName", label: "Company name", placeholder: "e.g. Bills Biotech Pvt. Ltd.", required: true },
  { key: "area", label: "Area / Zone", placeholder: "e.g. GIDC Phase 2" },
  { key: "district", label: "District", placeholder: "e.g. Gandhinagar" },
  { key: "state", label: "State", placeholder: "e.g. Gujarat" },
  { key: "pincode", label: "Pincode", placeholder: "e.g. 382355" },
] as const;

type Form = Record<(typeof FIELDS)[number]["key"], string>;

export default function CompanyPage() {
  const profile = useAppStore((s) => s.profile);
  // The store hydrates from IndexedDB after the first render; remount the form when it arrives
  return <CompanyForm key={profile?.updatedAt ?? "new"} />;
}

function CompanyForm() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const setProfile = useAppStore((s) => s.setProfile);
  const [form, setForm] = useState<Form>(() => ({
    companyName: profile?.companyName ?? "",
    area: profile?.area ?? "",
    district: profile?.district ?? "",
    state: profile?.state ?? "",
    pincode: profile?.pincode ?? "",
  }));

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.companyName.trim()) return toast.error("Company name is required");
    setProfile({
      id: profile?.id ?? crypto.randomUUID(),
      companyName: form.companyName.trim(),
      area: form.area.trim(),
      district: form.district.trim(),
      state: form.state.trim(),
      pincode: form.pincode.trim(),
      updatedAt: new Date().toISOString(),
    });
    toast.success("Company details saved");
    router.push("/transit");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company details</CardTitle>
        <CardDescription>The plant where the pumps are tested. This heads the Excel report and the email.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={save}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FIELDS.map((f) => (
              <div key={f.key} className={f.key === "companyName" ? "sm:col-span-2 lg:col-span-3" : undefined}>
                <Label htmlFor={f.key}>
                  {f.label}
                  {"required" in f && f.required && <span className="text-cyan-400"> *</span>}
                </Label>
                <Input
                  id={f.key}
                  className="mt-1"
                  value={form[f.key]}
                  placeholder={f.placeholder}
                  inputMode={f.key === "pincode" ? "numeric" : undefined}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit">Save &amp; start pump tests</Button>
            {profile?.updatedAt && (
              <span className="text-[11px] text-slate-500">
                Last saved {new Date(profile.updatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
