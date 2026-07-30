"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Activity, Building2, KanbanSquare, Table2, UploadCloud, MessageSquare, Boxes, Users, Settings, FileImage, Menu, X, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { SnapshotSwitcher } from "./snapshot-switcher";
import { ComparePicker } from "./compare-picker";
import { FilterChips } from "./filter-chips";
import { ChatDrawer } from "./chat-drawer";
import { ThemeToggle } from "./theme-toggle";
import { NivaBupaLogo } from "@/components/brand/niva-bupa-logo";

const NAV = [
  { href: "/pulse", label: "Pulse", icon: Activity },
  { href: "/branches", label: "Branches", icon: Building2 },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/products", label: "Products", icon: Boxes },
  { href: "/people", label: "People", icon: Users },
  { href: "/cases", label: "Cases", icon: Table2 },
  { href: "/reports", label: "Reports", icon: FileImage },
  { href: "/uploads", label: "Uploads", icon: UploadCloud },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [chatOpen, setChatOpen] = React.useState(false);
  const [navOpen, setNavOpen] = React.useState(false); // mobile off-canvas sidebar

  // Carry only the view context — the selected snapshot + compare — across sidebar navigation, so
  // switching screens keeps the chosen upload but does NOT drag along branch/stage/product filters.
  // (Sticky filters made e.g. a "branch=Erode" drill-down silently scope every page, so the
  // territory-wide Pulse showed one branch's numbers.) Filters stay scoped to where they're set.
  const navQuery = React.useMemo(() => {
    const q = new URLSearchParams();
    const snapshot = searchParams.get("snapshot");
    const compare = searchParams.get("compare");
    if (snapshot) q.set("snapshot", snapshot);
    if (compare) q.set("compare", compare);
    const s = q.toString();
    return s ? `?${s}` : "";
  }, [searchParams]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && (e.target as HTMLElement)?.tagName !== "INPUT" && (e.target as HTMLElement)?.tagName !== "TEXTAREA") {
        e.preventDefault();
        setChatOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Close the mobile drawer on navigation.
  React.useEffect(() => { setNavOpen(false); }, [pathname]);

  return (
    <div className="flex min-h-screen bg-bg text-fg">
      {/* Backdrop for the mobile drawer */}
      {navOpen && (
        <button
          aria-label="Close menu"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
        />
      )}

      {/* Sidebar — fixed on desktop, off-canvas drawer on mobile */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen w-64 max-w-[82vw] flex-col border-r bg-surface transition-transform duration-200 lg:w-56 lg:translate-x-0",
          navOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-start justify-between px-4 py-4">
          <div className="flex-1">
            <div className="rounded-lg bg-white px-3 py-2.5">
              <NivaBupaLogo className="h-9 w-auto" />
            </div>
            <div className="mt-2.5 border-t pt-2">
              <div className="text-sm font-semibold leading-tight text-fg">Territory IQ</div>
              <div className="text-[10px] text-fg-subtle">New Business Command Center</div>
            </div>
          </div>
          <button aria-label="Close menu" onClick={() => setNavOpen(false)} className="-mr-1 ml-2 rounded-lg p-1.5 text-fg-muted hover:bg-surface-2 lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href === "/pulse" && pathname === "/");
            return (
              <Link
                key={href}
                href={`${href}${navQuery}`}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                  active ? "bg-primary/15 text-primary" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto px-2 pb-2">
          <button
            onClick={async () => { await fetch("/api/logout", { method: "POST" }); window.location.href = "/login"; }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
          <div className="px-3 pt-2 text-[10px] text-fg-subtle">DigitalVetri.AI · v1</div>
        </div>
      </aside>

      {/* Main — min-w-0 lets the column shrink to the viewport so wide content (posters) scales
          to fit instead of forcing the whole layout wider than the screen. */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:ml-56">
        <header className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b bg-bg/80 px-3 py-2.5 backdrop-blur sm:gap-3 sm:px-6 sm:py-3">
          <button
            aria-label="Open menu"
            onClick={() => setNavOpen(true)}
            className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border bg-surface text-fg-muted hover:bg-surface-2 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <SnapshotSwitcher />
          <ComparePicker />
          <div className="hidden h-5 w-px bg-border sm:block" />
          <FilterChips />
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setChatOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-surface px-2.5 text-sm text-fg-muted hover:bg-surface-2 sm:px-3"
            >
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Ask Territory IQ</span>
              <kbd className="ml-1 hidden rounded bg-surface-2 px-1 text-[10px] sm:inline">/</kbd>
            </button>
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-4 sm:px-6 sm:py-6">{children}</main>
      </div>

      {/* Ask Territory IQ — Phase 3 chat drawer */}
      <ChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
