"use client";

import React, { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { importWorkbook } from "@/lib/import-workbook";
import { useAuthStore } from "@/lib/auth-store";
import { toast } from "sonner";
import * as XLSX from "xlsx";

/** Imports a Pump-Up Excel export (e.g. a teammate's report) without creating duplicates. */
export function UploadButton() {
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const state = useAppStore.getState();
      const { pumps, profile, summary } = importWorkbook(wb, state.pumps, useAuthStore.getState().displayName || "Unknown");
      state.replacePumps(pumps);

      // Only fill the company profile if this device has none yet
      if (profile?.companyName && !state.profile?.companyName) {
        state.setProfile({
          id: crypto.randomUUID(),
          companyName: profile.companyName ?? "",
          area: profile.area ?? "",
          district: profile.district ?? "",
          state: profile.state ?? "",
          pincode: profile.pincode ?? "",
          updatedAt: new Date().toISOString(),
        });
      }

      toast.success(
        `Import successful — ${summary.added} pump test(s) added, ${summary.updated} updated. No duplicate records were created.`,
        { duration: 6000 },
      );
    } catch (err) {
      console.error("[IMPORT ERROR]", err);
      toast.error(`Import failed: ${err instanceof Error ? err.message : "Invalid Excel file"}`);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={importing}
        className="gap-1.5 border border-white/10"
      >
        {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {importing ? "Importing…" : "Import Excel"}
      </Button>
    </>
  );
}
