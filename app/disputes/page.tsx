import { db, schema } from "@/lib/db";
import { requireArea } from "@/lib/rbac";
import { and, eq, desc } from "drizzle-orm";
import Shell from "@/components/Shell";
import { Card, PageHeader, EmptyState, Badge, tableClass, thClass, tdClass } from "@/components/ui";
import { formatDate } from "@/lib/format";
import Link from "next/link";

const REASON_LABEL: Record<string, string> = {
  PRICE_DISCREPANCY: "Pricing discrepancy",
  MISSING_DOCS: "Missing POD / invoice",
  DAMAGED_GOODS: "Damaged goods",
};

export default async function DisputesPage() {
  const session = await requireArea("disputes");
  const { tenantId, role } = session.user;

  // A CLIENT-role account with no principal client linked (a setup mistake,
  // not a crash) - show a clear message instead of querying with a bad id.
  if (role === "CLIENT" && !session.user.principalClientId) {
    return (
      <Shell session={session}>
        <PageHeader title="Disputes" subtitle="Debtors currently flagged as disputed." />
        <EmptyState>
          Your account isn&apos;t linked to a client portfolio yet. Ask your Owner or Operations
          Manager to set this under Team.
        </EmptyState>
      </Shell>
    );
  }

  const conditions = [eq(schema.debtors.tenantId, tenantId), eq(schema.debtors.status, "DISPUTED")];
  if (role === "COLLECTOR") conditions.push(eq(schema.debtors.assignedUserId, session.user.id));
  if (role === "CLIENT") conditions.push(eq(schema.debtors.clientId, session.user.principalClientId!));

  const rows = await db
    .select({
      id: schema.debtors.id,
      name: schema.debtors.name,
      disputeReason: schema.debtors.disputeReason,
      nextFollowUpAt: schema.debtors.nextFollowUpAt,
      clientName: schema.principalClients.name,
      assignedName: schema.users.name,
    })
    .from(schema.debtors)
    .leftJoin(schema.principalClients, eq(schema.debtors.clientId, schema.principalClients.id))
    .leftJoin(schema.users, eq(schema.debtors.assignedUserId, schema.users.id))
    .where(and(...conditions))
    .orderBy(desc(schema.debtors.createdAt));

  const canOpen = role !== "CLIENT";

  return (
    <Shell session={session}>
      <PageHeader title="Disputes" subtitle="Debtors currently flagged as disputed." />
      {rows.length === 0 ? (
        <EmptyState>No open disputes - great news!</EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Debtor</th>
                <th className={thClass}>Client</th>
                <th className={thClass}>Reason</th>
                <th className={thClass}>Follow-up</th>
                <th className={thClass}>Agent</th>
                <th className={thClass}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={tdClass}><span className="font-medium">{r.name}</span></td>
                  <td className={tdClass}>{r.clientName}</td>
                  <td className={tdClass}>{r.disputeReason ? REASON_LABEL[r.disputeReason] : "-"}</td>
                  <td className={tdClass}>{formatDate(r.nextFollowUpAt)}</td>
                  <td className={tdClass}>{r.assignedName ?? "-"}</td>
                  <td className={tdClass}>
                    {canOpen && <Link href={`/debtors/${r.id}`} className="text-brand hover:underline text-xs">Review →</Link>}
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
