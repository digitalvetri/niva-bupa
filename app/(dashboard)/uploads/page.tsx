"use client";
import * as React from "react";
import { FileText, AlertTriangle, Info, XCircle, X } from "lucide-react";
import { Card, Table, Th, Td, Badge, Button } from "@/components/ui/primitives";
import { PageHeader } from "@/components/dashboard/kpi-card";
import { UploadDropzone } from "@/components/dashboard/upload-dropzone";
import { EmptyState, LoadingBlock } from "@/components/dashboard/states";
import { useDashboard, type SnapshotMeta } from "@/components/dashboard/provider";

type Issue = { id: string; rowNumber: number | null; severity: string; message: string };

export default function UploadsPage() {
  const { snapshots, loadingSnapshots, snapshotId, setParam } = useDashboard();
  const [issuesFor, setIssuesFor] = React.useState<SnapshotMeta | null>(null);

  return (
    <>
      <PageHeader title="Uploads" subtitle="Every upload is an immutable snapshot" />
      <div className="mb-6"><UploadDropzone /></div>

      <Card>
        {loadingSnapshots ? (
          <div className="p-4"><LoadingBlock className="h-40" /></div>
        ) : snapshots.length === 0 ? (
          <div className="p-4"><EmptyState title="No uploads yet" hint="Drop your first NB report above." /></div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>File</Th><Th>Status</Th><Th className="text-right">Cases</Th><Th>Period</Th><Th>Uploaded</Th><Th className="text-right">Issues</Th><Th></Th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s) => (
                <tr key={s.id} className={s.id === snapshotId ? "bg-surface-2/50" : ""}>
                  <Td>
                    <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-fg-subtle" /><span className="max-w-[280px] truncate">{s.fileName}</span></div>
                  </Td>
                  <Td>
                    <Badge tone={s.status === "READY" ? "won" : s.status === "FAILED" ? "action" : "pending"}>{s.status}</Badge>
                  </Td>
                  <Td className="text-right tabular-nums">{s._count.cases}</Td>
                  <Td className="text-xs text-fg-muted tabular-nums">
                    {s.periodStart ? `${s.periodStart.slice(0, 10)} → ${s.periodEnd?.slice(0, 10)}` : "—"}
                  </Td>
                  <Td className="text-xs text-fg-muted tabular-nums">{new Date(s.createdAt).toLocaleString()}</Td>
                  <Td className="text-right">
                    {s._count.issues > 0 ? <button onClick={() => setIssuesFor(s)} className="text-primary underline-offset-2 hover:underline tabular-nums">{s._count.issues}</button> : <span className="text-fg-subtle">0</span>}
                  </Td>
                  <Td className="text-right">
                    {s.status === "READY" && s.id !== snapshotId && (
                      <Button size="sm" variant="outline" onClick={() => setParam("snapshot", s.id)}>View</Button>
                    )}
                    {s.id === snapshotId && <span className="text-xs text-primary">active</span>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {issuesFor && <IssuesDrawer snapshot={issuesFor} onClose={() => setIssuesFor(null)} />}
    </>
  );
}

function IssuesDrawer({ snapshot, onClose }: { snapshot: SnapshotMeta; onClose: () => void }) {
  const [issues, setIssues] = React.useState<Issue[] | null>(null);
  React.useEffect(() => {
    fetch(`/api/reports/${snapshot.id}/issues`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setIssues(j.issues ?? []));
  }, [snapshot.id]);

  const icon = (sev: string) => (sev === "error" ? <XCircle className="h-4 w-4 text-action" /> : sev === "warn" ? <AlertTriangle className="h-4 w-4 text-pending" /> : <Info className="h-4 w-4 text-fg-subtle" />);

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-[28rem] flex-col border-l bg-surface shadow-2xl">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="min-w-0"><div className="truncate text-sm font-medium">Ingestion issues</div><div className="truncate text-xs text-fg-subtle">{snapshot.fileName}</div></div>
        <button onClick={onClose} className="text-fg-subtle hover:text-fg"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {issues == null ? <LoadingBlock className="h-40" /> : issues.length === 0 ? <EmptyState title="No issues" /> : (
          <ul className="space-y-1.5">
            {issues.map((i) => (
              <li key={i.id} className="flex items-start gap-2 rounded-lg border bg-surface-2/50 px-3 py-2 text-sm">
                {icon(i.severity)}
                <div><div className="text-fg">{i.message}</div>{i.rowNumber != null && <div className="text-xs text-fg-subtle">row {i.rowNumber}</div>}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
