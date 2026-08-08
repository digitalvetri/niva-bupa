"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Table2, Trophy, Building2, CalendarDays, Grid3x3, List, Menu, X, LogOut, Database, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { NivaBupaLogo } from "@/components/brand/niva-bupa-logo";
import { useCoding } from "./provider";

const NAV = [
  { href: "/coding", label: "Dashboard", icon: LayoutDashboard },
  { href: "/coding/leads", label: "Leads", icon: Table2 },
  { href: "/coding/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/coding/branches", label: "Branch Dashboard", icon: Building2 },
  { href: "/coding/daily", label: "Daily Progress", icon: CalendarDays },
  { href: "/coding/pivot", label: "Pivot Table", icon: Grid3x3 },
  { href: "/coding/master", label: "Master Lists", icon: List },
];

function ModuleSwitcher() {
  return (
    <div className="mx-2 mt-2 grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1 text-xs font-medium">
      <Link href="/pulse" className="rounded-md py-1.5 text-center text-fg-muted hover:text-fg">New Business</Link>
      <span className="rounded-md bg-primary py-1.5 text-center text-primary-fg">Coding</span>
    </div>
  );
}

export function CodingShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = React.useState(false);
  const { snapshots, snapshotId, setSnapshotId } = useCoding();
  React.useEffect(() => { setNavOpen(false); }, [pathname]);
  const ready = snapshots.filter((s) => s.status === "READY");

  return (
    <div className="flex min-h-screen bg-bg text-fg">
      {navOpen && <button aria-label="Close menu" onClick={() => setNavOpen(false)} className="fixed inset-0 z-30 bg-black/50 lg:hidden" />}
      <aside className={cn("fixed left-0 top-0 z-40 flex h-screen w-64 max-w-[82vw] flex-col border-r bg-surface transition-transform duration-200 lg:w-56 lg:translate-x-0", navOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-start justify-between px-4 py-4">
          <div className="flex-1">
            <div className="rounded-lg bg-white px-3 py-2.5"><NivaBupaLogo className="h-9 w-auto" /></div>
            <div className="mt-2.5 border-t pt-2">
              <div className="text-sm font-semibold leading-tight text-fg">Mission 300</div>
              <div className="text-[10px] text-fg-subtle">Competitor Agent Recruitment</div>
            </div>
          </div>
          <button aria-label="Close menu" onClick={() => setNavOpen(false)} className="-mr-1 ml-2 rounded-lg p-1.5 text-fg-muted hover:bg-surface-2 lg:hidden"><X className="h-5 w-5" /></button>
        </div>
        <ModuleSwitcher />
        <nav className="mt-3 flex-1 space-y-0.5 overflow-y-auto px-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href} className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors", active ? "bg-primary/15 text-primary" : "text-fg-muted hover:bg-surface-2 hover:text-fg")}>
                <Icon className="h-4 w-4" /> {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto px-2 pb-2">
          <button onClick={async () => { await fetch("/api/logout", { method: "POST" }); window.location.href = "/login"; }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
          <div className="px-3 pt-2 text-[10px] text-fg-subtle">DigitalVetri.AI · v1</div>
        </div>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:ml-56">
        <header className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-bg/80 px-3 py-2.5 backdrop-blur sm:gap-3 sm:px-6 sm:py-3">
          <button aria-label="Open menu" onClick={() => setNavOpen(true)} className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border bg-surface text-fg-muted hover:bg-surface-2 lg:hidden"><Menu className="h-5 w-5" /></button>
          <div className="inline-flex items-center gap-2 rounded-lg border bg-surface px-3 text-sm">
            <Database className="h-4 w-4 text-fg-subtle" />
            {ready.length ? (
              <select value={snapshotId ?? ""} onChange={(e) => setSnapshotId(e.target.value)} className="h-9 max-w-[240px] truncate bg-transparent text-fg outline-none">
                {ready.map((s) => <option key={s.id} value={s.id}>{s.fileName} · {new Date(s.createdAt).toLocaleDateString()}</option>)}
              </select>
            ) : <span className="py-2 text-fg-subtle">No upload yet</span>}
          </div>
          <Link href="/pulse" className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-surface px-2.5 text-sm text-fg-muted hover:bg-surface-2"><ArrowLeftRight className="h-4 w-4" /><span className="hidden sm:inline">New Business</span></Link>
          <div className="ml-auto"><ThemeToggle /></div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-4 sm:px-6 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
