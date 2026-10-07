"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut, AlertTriangle, FileText, PlusCircle } from "lucide-react";
import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { useAuthStore } from "@/lib/auth-store";

export function LogoutButton() {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);

  const profile = useAppStore((s) => s.profile);
  const pumps = useAppStore((s) => s.pumps);
  const wipeData = useAppStore((s) => s.wipeData);
  const authLogout = useAuthStore((s) => s.logout);

  const hasProgress = !!profile?.companyName || pumps.length > 0;
  const lastUpdated = profile?.updatedAt
    ? new Date(profile.updatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
    : null;

  // Preserve data — the engineer can come back and continue
  const logoutPreservingData = () => {
    authLogout();
    setShowConfirm(false);
    router.push("/login");
  };

  // Wipe data — start fresh next time
  const logoutWipingData = () => {
    wipeData();
    authLogout();
    setShowConfirm(false);
    router.push("/login");
  };

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => (hasProgress ? setShowConfirm(true) : logoutPreservingData())}
        className="gap-1.5 border border-white/10 hover:bg-red-500/10 hover:text-red-400"
      >
        <LogOut className="size-4" />
        Log out
      </Button>

      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md px-4">
          <div className="bg-slate-900 border border-white/10 p-6 rounded-xl shadow-2xl max-w-md w-full">
            <div className="flex items-center gap-3 mb-4 text-amber-400">
              <AlertTriangle className="size-6" />
              <h3 className="text-lg font-semibold text-white">Saved Progress Found</h3>
            </div>
            <p className="text-sm text-slate-300 mb-2">You have work saved on this device. What would you like to do?</p>

            <div className="rounded-lg border border-white/10 bg-slate-950/50 p-3 mb-4 text-xs">
              {profile?.companyName && (
                <>
                  <div className="text-slate-400">Company:</div>
                  <div className="text-cyan-300 font-medium mb-2">{profile.companyName}</div>
                </>
              )}
              {lastUpdated && (
                <>
                  <div className="text-slate-400">Last updated:</div>
                  <div className="text-slate-200">{lastUpdated}</div>
                </>
              )}
              <div className="mt-2 text-slate-500">{pumps.length} pump test(s) recorded</div>
            </div>

            <div className="flex flex-col gap-2">
              <Button onClick={logoutPreservingData} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white gap-2 font-medium">
                <FileText className="size-4" />
                Logout & Continue Later
              </Button>
              <Button
                onClick={logoutWipingData}
                variant="secondary"
                className="w-full border border-red-500/30 text-red-300 hover:bg-red-500/10 gap-2"
              >
                <PlusCircle className="size-4" />
                Logout & Start New Report
              </Button>
              <Button onClick={() => setShowConfirm(false)} variant="ghost" className="w-full text-slate-400 hover:text-white">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
