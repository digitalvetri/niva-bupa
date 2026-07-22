"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Building2, KanbanSquare, Table2, UploadCloud, MessageSquare, Boxes, Users, Settings } from "lucide-react";
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
  { href: "/uploads", label: "Uploads", icon: UploadCloud },
  { href: "/settings", label: "Settings", icon: Settings },
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
        <div className="px-4 py-4">
          <div className="rounded-lg bg-white px-3 py-2.5">
            <NivaBupaLogo className="h-9 w-auto" />
          </div>
          <div className="mt-2.5 border-t pt-2">
            <div className="text-sm font-semibold leading-tight text-fg">Territory IQ</div>
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
          <ComparePicker />
          <div className="h-5 w-px bg-border" />
          <FilterChips />
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
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

      {/* Ask Territory IQ — Phase 3 chat drawer */}
      <ChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
