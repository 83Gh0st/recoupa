import { db, schema } from "@/lib/db";
import { requireArea } from "@/lib/rbac";
import { eq, sql } from "drizzle-orm";
import Shell from "@/components/Shell";
import { Card, PageHeader, EmptyState, inputClass, labelClass, btnPrimary, tableClass, thClass, tdClass } from "@/components/ui";
import { money } from "@/lib/format";
import { createClient } from "./actions";
import Link from "next/link";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const session = await requireArea("clients");
  const { tenantId, role, currency } = session.user;
  const params = await searchParams;

  const isClientPortal = role === "CLIENT";

  // Per-client rollups via small follow-up queries - simple and reliable across PG versions.
  const clients = await db
    .select()
    .from(schema.principalClients)
    .where(eq(schema.principalClients.tenantId, tenantId));

  const rollups = await Promise.all(
    clients.map(async (c) => {
      const [d] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.debtors)
        .where(eq(schema.debtors.clientId, c.id));
      const [inv] = await db
        .select({
          count: sql<number>`count(*)`,
          receivable: sql<string>`coalesce(sum(${schema.invoices.amount}), 0)`,
          balance: sql<string>`coalesce(sum(${schema.invoices.outstanding}), 0)`,
        })
        .from(schema.invoices)
        .where(eq(schema.invoices.clientId, c.id));
      return { ...c, debtorCount: d?.count ?? 0, invoiceCount: inv?.count ?? 0, receivable: inv?.receivable ?? "0", balance: inv?.balance ?? "0" };
    })
  );

  const singleClientView = isClientPortal
    ? rollups.filter((c) => c.id === session.user.principalClientId)
    : rollups;

  return (
    <Shell session={session}>
      <PageHeader
        title="Principal Clients"
        subtitle="The companies who hired you to recover their overdue invoices."
      />

      {params.error && (
        <div className="mb-4 rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
          {params.error}
        </div>
      )}
      {params.success && (
        <div className="mb-4 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
          {params.success}
        </div>
      )}

      {!isClientPortal && (
        <Card className="p-4 mb-6">
          <details>
            <summary className="text-sm font-medium text-brand cursor-pointer select-none">
              + New principal client
            </summary>
            <form action={createClient} className="grid md:grid-cols-2 gap-3 mt-4">
              <div>
                <label className={labelClass}>Company name *</label>
                <input name="name" required maxLength={150} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Trade license no.</label>
                <input name="tradeLicenseNo" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Contact person</label>
                <input name="contactPerson" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input name="email" type="email" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input name="phone" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Recovery commission % (default)</label>
                <input name="commissionPct" type="number" step="0.01" min={0} max={100} defaultValue={10} className={inputClass} />
              </div>
              <div className="md:col-span-2">
                <button type="submit" className={btnPrimary}>Create client</button>
              </div>
            </form>
          </details>
        </Card>
      )}

      {singleClientView.length === 0 ? (
        <EmptyState>No principal clients yet. Create one above to get started.</EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Company</th>
                <th className={thClass}>Contact</th>
                <th className={thClass}>Debtors</th>
                <th className={thClass}>Invoices</th>
                <th className={thClass}>Receivable</th>
                <th className={thClass}>Balance</th>
                <th className={thClass}>Commission %</th>
                <th className={thClass}></th>
              </tr>
            </thead>
            <tbody>
              {singleClientView.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className={tdClass}>
                    <div className="font-medium text-slate-800">{c.name}</div>
                    <div className="text-xs text-slate-400">{c.tradeLicenseNo}</div>
                  </td>
                  <td className={tdClass}>
                    <div>{c.contactPerson}</div>
                    <div className="text-xs text-slate-400">{c.phone}</div>
                  </td>
                  <td className={tdClass}>{c.debtorCount}</td>
                  <td className={tdClass}>{c.invoiceCount}</td>
                  <td className={tdClass}>{money(c.receivable, currency)}</td>
                  <td className={tdClass}>{money(c.balance, currency)}</td>
                  <td className={tdClass}>{Number(c.commissionPct).toFixed(2)}%</td>
                  <td className={tdClass}>
                    {!isClientPortal && (
                      <Link href={`/clients/${c.id}/import`} className="text-brand hover:underline text-xs">
                        Import data →
                      </Link>
                    )}
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
