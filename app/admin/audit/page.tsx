import { db, schema } from "@/lib/db";
import { requireArea } from "@/lib/rbac";
import { and, eq, desc } from "drizzle-orm";
import Shell from "@/components/Shell";
import { Card, PageHeader, EmptyState, inputClass, tableClass, thClass, tdClass } from "@/components/ui";
import { formatDate } from "@/lib/format";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string }>;
}) {
  const session = await requireArea("adminAudit");
  const { tenantId } = session.user;
  const sp = await searchParams;

  const conditions = [eq(schema.auditLogs.tenantId, tenantId)];
  if (sp.action) conditions.push(eq(schema.auditLogs.action, sp.action));

  const rows = await db
    .select({
      id: schema.auditLogs.id,
      action: schema.auditLogs.action,
      entityType: schema.auditLogs.entityType,
      entityId: schema.auditLogs.entityId,
      detail: schema.auditLogs.detail,
      createdAt: schema.auditLogs.createdAt,
      userName: schema.users.name,
    })
    .from(schema.auditLogs)
    .leftJoin(schema.users, eq(schema.auditLogs.userId, schema.users.id))
    .where(and(...conditions))
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(300);

  return (
    <Shell session={session}>
      <PageHeader title="Audit Log" subtitle="Treat this as the source of truth for who changed what." />

      <Card className="p-3 mb-4">
        <form method="get" className="flex gap-2 items-center">
          <input name="action" defaultValue={sp.action} placeholder="Filter by action (e.g. PAYMENT_RECORDED)" className={inputClass + " max-w-xs"} />
          <button type="submit" className="text-xs text-brand hover:underline">Filter</button>
        </form>
      </Card>

      {rows.length === 0 ? (
        <EmptyState>No audit events yet.</EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>When</th>
                <th className={thClass}>Who</th>
                <th className={thClass}>Action</th>
                <th className={thClass}>Entity</th>
                <th className={thClass}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={tdClass}>{formatDate(r.createdAt)}</td>
                  <td className={tdClass}>{r.userName ?? "System"}</td>
                  <td className={tdClass}><code className="text-xs">{r.action}</code></td>
                  <td className={tdClass}>{r.entityType} {r.entityId && <span className="text-slate-400">#{r.entityId.slice(0, 8)}</span>}</td>
                  <td className={tdClass}>
                    {r.detail ? <code className="text-xs text-slate-500">{JSON.stringify(r.detail)}</code> : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </Shell>
  );
}
