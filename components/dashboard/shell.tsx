"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Building2, KanbanSquare, Table2, UploadCloud, MessageSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SnapshotSwitcher } from "./snapshot-switcher";
import { FilterChips } from "./filter-chips";

const NAV = [
  { href: "/pulse", label: "Pulse", icon: Activity },
  { href: "/branches", label: "Branches", icon: Building2 },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/cases", label: "Cases", icon: Table2 },
  { href: "/uploads", label: "Uploads", icon: UploadCloud },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [chatOpen, setChatOpen] = React.useState(false);

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

  return (
    <div className="flex min-h-screen bg-bg text-fg">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-20 flex h-screen w-56 flex-col border-r bg-surface">
        <div className="flex items-center gap-2 px-4 py-4">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-fg font-bold">T</div>
          <div>
            <div className="text-sm font-semibold leading-tight">Territory IQ</div>
            <div className="text-[10px] text-fg-subtle">New Business Command Center</div>
          </div>
        </div>
        <nav className="mt-2 flex-1 space-y-0.5 px-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href === "/pulse" && pathname === "/");
            return (
              <Link
                key={href}
                href={href}
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
        <div className="px-4 py-3 text-[10px] text-fg-subtle">DigitalVetri.AI · v1</div>
      </aside>

      {/* Main */}
      <div className="ml-56 flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b bg-bg/80 px-6 py-3 backdrop-blur">
          <SnapshotSwitcher />
          <div className="h-5 w-px bg-border" />
          <FilterChips />
          <div className="ml-auto">
            <button
              onClick={() => setChatOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-surface px-3 text-sm text-fg-muted hover:bg-surface-2"
            >
              <MessageSquare className="h-4 w-4" /> Ask Territory IQ <kbd className="ml-1 rounded bg-surface-2 px-1 text-[10px]">/</kbd>
            </button>
          </div>
        </header>
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>

      {/* Chat drawer — Phase 3 stub */}
      {chatOpen && (
        <div className="fixed inset-y-0 right-0 z-40 flex w-96 flex-col border-l bg-surface shadow-2xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium"><MessageSquare className="h-4 w-4 text-primary" /> Ask Territory IQ</div>
            <button onClick={() => setChatOpen(false)} className="text-fg-subtle hover:text-fg"><X className="h-4 w-4" /></button>
          </div>
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
            <MessageSquare className="h-8 w-8 text-fg-subtle" />
            <div className="text-sm text-fg-muted">The bot arrives in Phase 3.</div>
            <div className="text-xs text-fg-subtle">It will read the same snapshot & filters shown above and answer with verified numbers from the metric engine.</div>
          </div>
        </div>
      )}
    </div>
  );
}
