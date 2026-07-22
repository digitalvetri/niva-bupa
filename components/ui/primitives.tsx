import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative overflow-hidden rounded-xl border bg-surface", className)} {...props} />;
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 pt-4", className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-medium text-fg-muted", className)} {...props} />;
}
export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "won" | "pending" | "action" | "review" | "primary" }) {
  const tones: Record<string, string> = {
    neutral: "bg-surface-2 text-fg-muted border-border",
    primary: "bg-primary/15 text-primary border-primary/30",
    won: "bg-[color:var(--won)]/15 text-[color:var(--won)] border-[color:var(--won)]/30",
    pending: "bg-[color:var(--pending)]/15 text-[color:var(--pending)] border-[color:var(--pending)]/30",
    action: "bg-[color:var(--action)]/15 text-[color:var(--action)] border-[color:var(--action)]/30",
    review: "bg-[color:var(--review)]/15 text-fg-muted border-[color:var(--review)]/30",
  };
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium", tones[tone], className)}
      {...props}
    />
  );
}

export function Button({
  className,
  variant = "default",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "outline" | "ghost"; size?: "sm" | "md" }) {
  const variants: Record<string, string> = {
    default: "bg-primary text-primary-fg hover:bg-primary/90",
    outline: "border bg-transparent text-fg hover:bg-surface-2",
    ghost: "bg-transparent text-fg-muted hover:bg-surface-2 hover:text-fg",
  };
  const sizes: Record<string, string> = { sm: "h-8 px-2.5 text-xs", md: "h-9 px-3.5 text-sm" };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-surface-2", className)} {...props} />;
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-9 w-full rounded-lg border bg-surface px-3 text-sm text-fg placeholder:text-fg-subtle focus:border-primary focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function Table({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn("w-full border-collapse text-sm", className)} {...props} />
    </div>
  );
}
export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn("border-b px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-fg-subtle", className)} {...props} />;
}
export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("border-b border-border/60 px-3 py-2 align-middle", className)} {...props} />;
}
