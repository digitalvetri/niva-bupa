"use client";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/primitives";
import { PageHeader } from "@/components/dashboard/kpi-card";
import { LoadingBlock, ErrorState, EmptyState } from "@/components/dashboard/states";
import { useMetric } from "@/components/dashboard/use-metric";
import { useDashboard } from "@/components/dashboard/provider";
import { BarList } from "@/components/charts/bar-list";
import { formatINR } from "@/lib/metrics/format";
import type { GroupRow, TicketRow, TenureRow } from "@/lib/metrics/metrics";

const asCount = (n: number) => `${n}`;
const tenureLabel = (y: number | null) => (y == null ? "Unknown" : `${y} year${y === 1 ? "" : "s"}`);

export default function ProductsPage() {
  const { snapshotId, loadingSnapshots } = useDashboard();
  const products = useMetric<GroupRow[]>("premium_by_product");
  const ticket = useMetric<TicketRow[]>("ticket_size_distribution");
  const tenure = useMetric<TenureRow[]>("tenure_mix");
  const planType = useMetric<GroupRow[]>("premium_by_plan_type");

  if (!snapshotId && !loadingSnapshots) return (<><PageHeader title="Products" /><EmptyState title="No snapshot yet" /></>);

  return (
    <>
      <PageHeader title="Products" subtitle="Product genre, ticket size, tenure & plan mix" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Premium by product genre" state={products}>
          {products.data && <BarList items={products.data.map((p) => ({ label: p.key, value: p.logged, count: p.cases }))} />}
        </Panel>
        <Panel title="Ticket-size distribution" state={ticket}>
          {ticket.data && <BarList valueFmt={asCount} items={ticket.data.map((t) => ({ label: t.band, value: t.cases, sub: formatINR(t.premium) }))} />}
        </Panel>
        <Panel title="Tenure mix" state={tenure}>
          {tenure.data && <BarList items={tenure.data.map((t) => ({ label: tenureLabel(t.tenureYears), value: t.premium, count: t.cases }))} />}
        </Panel>
        <Panel title="Plan type split" state={planType}>
          {planType.data && <BarList valueFmt={asCount} items={planType.data.map((p) => ({ label: p.key, value: p.cases }))} />}
        </Panel>
      </div>
    </>
  );
}

function Panel({ title, state, children }: { title: string; state: { loading: boolean; error: string | null }; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardBody>{state.loading ? <LoadingBlock className="h-40" /> : state.error ? <ErrorState message={state.error} /> : children}</CardBody>
    </Card>
  );
}
