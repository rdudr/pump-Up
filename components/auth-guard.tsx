"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { useIsClient } from "@/lib/use-client-state";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const isClient = useIsClient();
  const authed = useAuthStore((s) => s.isAuthenticated());
  const router = useRouter();
  const allowed = isClient && authed;

  useEffect(() => {
    if (isClient && !authed) router.replace("/login");
  }, [isClient, authed, router]);

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
