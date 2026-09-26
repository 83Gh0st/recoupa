import { db, schema } from "@/lib/db";
import { requireArea } from "@/lib/rbac";
import { and, eq, desc } from "drizzle-orm";
import Shell from "@/components/Shell";
import { Card, PageHeader, EmptyState, Badge, inputClass, btnPrimary, btnSecondary, tableClass, thClass, tdClass } from "@/components/ui";
import { money, formatDate } from "@/lib/format";
import { reviewCorrection } from "./actions";
import Link from "next/link";

export default async function CorrectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string; success?: string }>;
}) {
  const session = await requireArea("corrections");
  const { tenantId, role, currency } = session.user;
  const sp = await searchParams;
  const status = sp.status || "PENDING";
  const isManager = role === "OWNER" || role === "MANAGER";

  const conditions = [eq(schema.paymentCorrections.tenantId, tenantId)];
  if (status !== "ALL") conditions.push(eq(schema.paymentCorrections.status, status as any));
  if (role === "COLLECTOR") conditions.push(eq(schema.paymentCorrections.requestedByUserId, session.user.id));

  const rows = await db
    .select({
      id: schema.paymentCorrections.id,
      proposedAmount: schema.paymentCorrections.proposedAmount,
      reason: schema.paymentCorrections.reason,
      status: schema.paymentCorrections.status,
      createdAt: schema.paymentCorrections.createdAt,
      reviewNotes: schema.paymentCorrections.reviewNotes,
      originalAmount: schema.payments.amount,
      debtorId: schema.payments.debtorId,
      debtorName: schema.debtors.name,
      requestedByName: schema.users.name,
    })
    .from(schema.paymentCorrections)
    .leftJoin(schema.payments, eq(schema.paymentCorrections.paymentId, schema.payments.id))
    .leftJoin(schema.debtors, eq(schema.payments.debtorId, schema.debtors.id))
    .leftJoin(schema.users, eq(schema.paymentCorrections.requestedByUserId, schema.users.id))
    .where(and(...conditions))
    .orderBy(desc(schema.paymentCorrections.createdAt));

  return (
    <Shell session={session}>
      <PageHeader title="Payment Corrections" subtitle="Requested amendments to already-recorded payments." />

      {sp.error && <div className="mb-4 rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{sp.error}</div>}
      {sp.success && <div className="mb-4 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">{sp.success}</div>}

      <div className="flex gap-2 mb-4">
        {["PENDING", "APPROVED", "REJECTED", "ALL"].map((s) => (
          <Link
            key={s}
            href={`/corrections?status=${s}`}
            className={`text-xs px-2.5 py-1 rounded-full border ${status === s ? "bg-brand text-white border-brand" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}
          >
            {s}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState>No {status !== "ALL" ? status.toLowerCase() : ""} correction requests.</EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Debtor</th>
                <th className={thClass}>Original → Proposed</th>
                <th className={thClass}>Reason</th>
                <th className={thClass}>Requested by</th>
                <th className={thClass}>Status</th>
                {isManager && <th className={thClass}></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={tdClass}>
                    <Link href={`/debtors/${r.debtorId}`} className="text-brand hover:underline">{r.debtorName}</Link>
                    <div className="text-xs text-slate-400">{formatDate(r.createdAt)}</div>
                  </td>
                  <td className={tdClass}>{money(r.originalAmount, currency)} → {money(r.proposedAmount, currency)}</td>
                  <td className={tdClass}>{r.reason}{r.reviewNotes && <div className="text-xs text-slate-400 mt-0.5">Review note: {r.reviewNotes}</div>}</td>
                  <td className={tdClass}>{r.requestedByName ?? "-"}</td>
                  <td className={tdClass}><Badge value={r.status} /></td>
                  {isManager && (
                    <td className={tdClass}>
                      {r.status === "PENDING" && (
                        <form action={reviewCorrection.bind(null, r.id)} className="flex gap-2 items-center">
                          <input name="reviewNotes" placeholder="Note (optional)" className="text-xs rounded border border-slate-200 px-1.5 py-1 w-32" />
                          <button name="decision" value="APPROVED" className="text-xs px-2 py-1 rounded bg-emerald-600 text-white">Approve</button>
                          <button name="decision" value="REJECTED" className="text-xs px-2 py-1 rounded bg-rose-600 text-white">Reject</button>
                        </form>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </Shell>
  );
}
