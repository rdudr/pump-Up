"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/auth-store";
import { useAppStore } from "@/lib/store";
import { FileText } from "lucide-react";
import { useOnline } from "@/lib/use-client-state";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const profile = useAppStore((s) => s.profile);
  const pumps = useAppStore((s) => s.pumps);
  const wipeData = useAppStore((s) => s.wipeData);

  const hasSavedProgress = !!profile?.companyName || pumps.length > 0;
  const lastUpdated = profile?.updatedAt
    ? new Date(profile.updatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
    : null;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const isOnline = useOnline();

  // If already signed in, skip the login screen
  useEffect(() => {
    if (isAuthenticated()) router.replace("/dashboard");
  }, [isAuthenticated, router]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (login(username, password)) {
        toast.success(`Signed in${!isOnline ? " (offline)" : ""}`);
        router.push(profile?.companyName ? "/dashboard" : "/company");
        return;
      }
      toast.error("Invalid credentials - username or password incorrect");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_rgba(26,0,170,0.35),_transparent_55%),#020617] px-4 py-10">
      <Card className="w-full max-w-md border-white/10 bg-slate-950/60 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <CardHeader className="flex flex-col items-center text-center">
          <img src="/logo.png" alt="Pump-Up logo" className="h-28 w-28 mb-3 rounded-xl" />
          <CardTitle className="text-2xl">Pump-Up</CardTitle>
          <CardDescription>by Kisem IITGN — pump testing &amp; efficiency tool.</CardDescription>
          {!isOnline && (
            <div className="mt-3 px-3 py-2 bg-amber-500/20 border border-amber-500/30 rounded text-xs text-amber-200">
              ⚠️ Offline — you can still sign in and record tests
            </div>
          )}
        </CardHeader>

        {hasSavedProgress && (
          <div className="px-6 pb-4">
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4">
              <div className="flex items-start gap-3">
                <FileText className="size-5 text-cyan-300 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-cyan-100">Continue previous report?</div>
                  {profile?.companyName && (
                    <div className="text-xs text-slate-300 mt-1">
                      Company: <span className="text-cyan-300">{profile.companyName}</span>
                    </div>
                  )}
                  {lastUpdated && <div className="text-[10px] text-slate-400 mt-1">Last updated: {lastUpdated}</div>}
                  <div className="text-[10px] text-slate-500 mt-1">
                    {pumps.filter((p) => p.method === "TRANSIT").length} Transit tests,{" "}
                    {pumps.filter((p) => p.method === "DOPPLER").length} Doppler tests
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("Delete all saved progress and start fresh?")) wipeData();
                      }}
                      className="text-xs text-red-300 hover:bg-red-500/10 px-3"
                    >
                      Start New
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="username">Username / ID</Label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. RISHABH"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </Button>
            <p className="text-[10px] leading-relaxed text-slate-400">
              Works offline — your tests are saved on this device until you submit the report.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
