"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { UploadButton } from "@/components/layout/upload-button";
import { cn } from "@/lib/utils";
import { Building2, Gauge, LayoutDashboard, Menu, Radio, Waves, X } from "lucide-react";
import { useState } from "react";
import { useOnline } from "@/lib/use-client-state";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/company", label: "Company", icon: Building2 },
  { href: "/transit", label: "Pump Test — Transit", icon: Radio },
  { href: "/doppler", label: "Pump Test — Doppler", icon: Waves },
  { href: "/friction", label: "Friction Loss", icon: Gauge },
];

function Brand({ compact = false }: { compact?: boolean }) {
  return compact ? (
    <div className="flex items-center gap-2">
      <img src="/logo.png" alt="Pump-Up logo" className="h-8 w-8 rounded" />
      <span className="text-sm font-semibold text-cyan-300">Pump-Up</span>
    </div>
  ) : (
    <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4 backdrop-blur-md flex flex-col items-center text-center">
      <img src="/logo.png" alt="Pump-Up logo" className="h-24 w-24 mb-3 rounded-lg" />
      <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">Pump-Up</div>
      <p className="mt-2 text-xs text-slate-400">by Kisem IITGN</p>
    </div>
  );
}

export function ConsoleShell({
  user,
  children,
}: {
  user: { id?: string; displayName?: string; username?: string } | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/dashboard";
  const isOnline = useOnline();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = (onClick?: () => void, mobile = false) =>
    nav.map((item) => {
      const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
      const Icon = item.icon;
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onClick}
          className={cn(
            "flex items-center gap-2 rounded-lg border border-transparent text-sm transition-colors",
            mobile ? "gap-3 px-4 py-3" : "px-3 py-2",
            active ? "border-cyan-500/25 bg-cyan-500/10 text-cyan-50" : "text-slate-300 hover:border-white/10 hover:bg-white/5",
          )}
        >
          <Icon className="size-4 opacity-80" />
          {item.label}
        </Link>
      );
    });

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_rgba(26,0,170,0.22),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(15,23,42,1),_#020617)] text-slate-100">
      {/* Mobile slide-in drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-slate-950 border-r border-white/10 shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <Brand compact />
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Close menu"
                className="flex items-center justify-center h-9 w-9 rounded-md text-slate-300 hover:bg-white/5"
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1 p-3">{navLinks(() => setIsMobileMenuOpen(false), true)}</nav>
          </aside>
        </div>
      )}

      <div className="mx-auto flex max-w-[1600px] gap-6 px-4 py-6 lg:px-8">
        <aside className="hidden w-56 shrink-0 flex-col gap-6 lg:flex">
          <Brand />
          <nav className="flex flex-col gap-1">{navLinks()}</nav>
          {/* Chevrons from the logo — a small brand accent */}
          <div className="flex flex-col items-center gap-0.5 opacity-60" aria-hidden>
            {["border-brand-yellow", "border-brand-yellow", "border-brand-red", "border-brand-red"].map((c, i) => (
              <span key={i} className={cn("block h-3 w-3 rotate-45 border-l-[3px] border-t-[3px]", c)} />
            ))}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <header className="flex flex-col gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Signed in</p>
                <div className={cn("w-2 h-2 rounded-full", isOnline ? "bg-green-400" : "bg-amber-400")} />
                <span className={cn("text-[10px] font-medium", isOnline ? "text-green-300" : "text-amber-300")}>
                  {isOnline ? "Online" : "Offline"}
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-50">{user?.displayName ?? user?.username ?? "User"}</p>
              <p className="text-xs text-slate-500">{user?.username ?? user?.id}</p>
              {!isOnline && (
                <p className="text-xs text-amber-300/80 mt-1">⚠ Working offline — the report will send when you are back online</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Open menu"
                className="lg:hidden flex items-center justify-center h-9 w-9 rounded-md border border-white/10 bg-slate-950/60 text-slate-100 hover:bg-white/5"
              >
                <Menu className="size-5" />
              </button>
              <UploadButton />
              <LogoutButton />
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
