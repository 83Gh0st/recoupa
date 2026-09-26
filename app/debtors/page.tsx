import { db, schema } from "@/lib/db";
import { requireArea } from "@/lib/rbac";
import { and, eq, ilike, or, isNull, desc } from "drizzle-orm";
import Shell from "@/components/Shell";
import {
  Card, PageHeader, EmptyState, Badge, inputClass, labelClass, btnPrimary,
  tableClass, thClass, tdClass,
} from "@/components/ui";
import { formatDate } from "@/lib/format";
import { createManualDebtor } from "./actions";
import AssignSelect from "./AssignSelect";
import Link from "next/link";

export default async function DebtorsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string; status?: string; clientId?: string; agentId?: string; error?: string;
  }>;
}) {
  const session = await requireArea("debtors");
  const { tenantId, role } = session.user;
  const sp = await searchParams;
  const isCollector = role === "COLLECTOR";

  const clients = await db
    .select({ id: schema.principalClients.id, name: schema.principalClients.name })
    .from(schema.principalClients)
    .where(eq(schema.principalClients.tenantId, tenantId));

  const collectors = await db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(and(eq(schema.users.tenantId, tenantId), eq(schema.users.role, "COLLECTOR")));

  const conditions = [eq(schema.debtors.tenantId, tenantId)];
  if (isCollector) conditions.push(eq(schema.debtors.assignedUserId, session.user.id));
  if (sp.q) {
    conditions.push(
      or(
        ilike(schema.debtors.name, `%${sp.q}%`),
        ilike(schema.debtors.phone, `%${sp.q}%`),
        ilike(schema.debtors.contactPerson, `%${sp.q}%`)
      )!
    );
  }
  if (sp.status) conditions.push(eq(schema.debtors.status, sp.status as any));
  if (sp.clientId) conditions.push(eq(schema.debtors.clientId, sp.clientId));
  if (!isCollector && sp.agentId === "unassigned") conditions.push(isNull(schema.debtors.assignedUserId));
  else if (!isCollector && sp.agentId) conditions.push(eq(schema.debtors.assignedUserId, sp.agentId));

  const rows = await db
    .select({
      id: schema.debtors.id,
      name: schema.debtors.name,
      phone: schema.debtors.phone,
      status: schema.debtors.status,
      nextFollowUpAt: schema.debtors.nextFollowUpAt,
      clientName: schema.principalClients.name,
      assignedUserId: schema.debtors.assignedUserId,
      assignedUserName: schema.users.name,
    })
    .from(schema.debtors)
    .leftJoin(schema.principalClients, eq(schema.debtors.clientId, schema.principalClients.id))
    .leftJoin(schema.users, eq(schema.debtors.assignedUserId, schema.users.id))
    .where(and(...conditions))
    .orderBy(desc(schema.debtors.createdAt))
    .limit(200);

  return (
    <Shell session={session}>
      <PageHeader
        title="Debtors"
        subtitle={isCollector ? "Your assigned book." : "Every debtor across every principal client."}
      />

      {sp.error && (
        <div className="mb-4 rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
          {sp.error}
        </div>
      )}

      <Card className="p-4 mb-6">
        <form className="grid md:grid-cols-5 gap-3 items-end" method="get">
          <div className="md:col-span-2">
            <label className={labelClass}>Search</label>
            <input name="q" defaultValue={sp.q} placeholder="Name, phone, contact…" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select name="status" defaultValue={sp.status || ""} className={inputClass}>
              <option value="">All</option>
              {["OPEN", "PROMISED", "DISPUTED", "NO_ANSWER", "DECLINED", "RESOLVED"].map((s) => (
                <option key={s} value={s}>{s.replaceAll("_", " ")}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Client</label>
            <select name="clientId" defaultValue={sp.clientId || ""} className={inputClass}>
              <option value="">All</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {!isCollector && (
            <div>
              <label className={labelClass}>Agent</label>
              <select name="agentId" defaultValue={sp.agentId || ""} className={inputClass}>
                <option value="">All</option>
                <option value="unassigned">Unassigned only</option>
                {collectors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <button type="submit" className={btnPrimary + " w-full"}>Filter</button>
          </div>
        </form>
      </Card>

      {!isCollector && (
        <Card className="p-4 mb-6">
          <details>
            <summary className="text-sm font-medium text-brand cursor-pointer select-none">
              + New lead (manual debtor)
            </summary>
            <form action={createManualDebtor} className="grid md:grid-cols-2 gap-3 mt-4">
              <div>
                <label className={labelClass}>Principal client *</label>
                <select name="clientId" required className={inputClass}>
                  <option value="">Select…</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Debtor name *</label>
                <input name="name" required maxLength={200} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Phone *</label>
                <input name="phone" required placeholder="+1 555…" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Alternate phone</label>
                <input name="altPhone" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Contact person</label>
                <input name="contactPerson" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Trade license no.</label>
                <input name="tradeLicenseNo" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>City</label>
                <input name="city" placeholder="Unspecified" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Assign agent</label>
                <select name="assignedUserId" className={inputClass}>
                  <option value="">Leave unassigned</option>
                  {collectors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="md:col-span-2 text-xs text-slate-400">
                This creates a lead only. Add invoices on the debtor&apos;s page (or use Master Load) before
                recording payments - payments always apply against a real invoice.
              </div>
              <div className="md:col-span-2">
                <button type="submit" className={btnPrimary}>Create lead</button>
              </div>
            </form>
          </details>
        </Card>
      )}

      {rows.length === 0 ? (
        <EmptyState>No debtors match these filters.</EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Debtor</th>
                <th className={thClass}>Client</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Next follow-up</th>
                <th className={thClass}>Agent</th>
                <th className={thClass}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className={tdClass}>
                    <Link href={`/debtors/${r.id}`} className="font-medium text-slate-800 hover:text-brand">
                      {r.name}
                    </Link>
                    <div className="text-xs text-slate-400">{r.phone}</div>
                  </td>
                  <td className={tdClass}>{r.clientName}</td>
                  <td className={tdClass}><Badge value={r.status} /></td>
                  <td className={tdClass}>{formatDate(r.nextFollowUpAt)}</td>
                  <td className={tdClass}>
                    {isCollector ? (
                      r.assignedUserName || "-"
                    ) : (
                      <AssignSelect debtorId={r.id} collectors={collectors} assignedUserId={r.assignedUserId} />
                    )}
                  </td>
                  <td className={tdClass}>
                    <Link href={`/debtors/${r.id}`} className="text-brand hover:underline text-xs">Open →</Link>
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
