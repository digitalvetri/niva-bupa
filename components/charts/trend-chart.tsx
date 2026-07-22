"use client";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { CHART } from "@/lib/theme";
import { formatINR } from "@/lib/metrics/format";
import type { TrendPoint } from "@/lib/metrics/metrics";

export function TrendChart({ data, height = 200 }: { data: TrendPoint[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
        <CartesianGrid stroke={CHART.grid} strokeDasharray="2 4" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: CHART.axis, fontSize: 11 }} tickFormatter={(d: string) => d.slice(5)} stroke={CHART.grid} minTickGap={24} />
        <YAxis tick={{ fill: CHART.axis, fontSize: 11 }} tickFormatter={(v: number) => formatINR(v)} stroke={CHART.grid} width={64} />
        <Tooltip
          cursor={{ stroke: CHART.axis, strokeDasharray: "3 3" }}
          contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "var(--fg-muted)" }}
          formatter={((v: unknown, name: unknown) => [formatINR(Number(v) || 0), String(name)]) as never}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "var(--fg-muted)" }} />
        <Line type="monotone" dataKey="logged" name="Logged" stroke={CHART.logged} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        <Line type="monotone" dataKey="issued" name="Issued" stroke={CHART.issued} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
