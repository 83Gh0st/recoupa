import { db, schema } from "@/lib/db";
import { requireArea } from "@/lib/rbac";
import { and, eq, ilike, or, desc } from "drizzle-orm";
import Shell from "@/components/Shell";
import { Card, PageHeader, EmptyState, Badge, inputClass, labelClass, btnPrimary, tableClass, thClass, tdClass } from "@/components/ui";
import { createProspect } from "./actions";
import Link from "next/link";

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; source?: string; error?: string }>;
}) {
  const session = await requireArea("prospects");
  const { tenantId, role } = session.user;
  const sp = await searchParams;
  const isSales = role === "SALES";

  const salesReps = await db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(and(eq(schema.users.tenantId, tenantId), eq(schema.users.role, "SALES")));

  const conditions = [eq(schema.prospects.tenantId, tenantId)];
  if (isSales) conditions.push(eq(schema.prospects.assignedUserId, session.user.id));
  if (sp.q) {
    conditions.push(
      or(
        ilike(schema.prospects.firmName, `%${sp.q}%`),
        ilike(schema.prospects.contactPerson, `%${sp.q}%`),
        ilike(schema.prospects.phone, `%${sp.q}%`),
        ilike(schema.prospects.email, `%${sp.q}%`)
      )!
    );
  }
  if (sp.status) conditions.push(eq(schema.prospects.status, sp.status as any));

  const rows = await db
    .select({
      id: schema.prospects.id,
      firmName: schema.prospects.firmName,
      contactPerson: schema.prospects.contactPerson,
      phone: schema.prospects.phone,
      status: schema.prospects.status,
      sourceSheet: schema.prospects.sourceSheet,
      assignedName: schema.users.name,
    })
    .from(schema.prospects)
    .leftJoin(schema.users, eq(schema.prospects.assignedUserId, schema.users.id))
    .where(and(...conditions))
    .orderBy(desc(schema.prospects.createdAt))
    .limit(200);

  return (
    <Shell session={session}>
      <PageHeader title="Prospects" subtitle={isSales ? "Your own pipeline." : "Every prospect in the sales book."} />

      {sp.error && <div className="mb-4 rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{sp.error}</div>}

      <Card className="p-4 mb-6">
        <form className="grid md:grid-cols-4 gap-3 items-end" method="get">
          <div className="md:col-span-2">
            <label className={labelClass}>Search</label>
            <input name="q" defaultValue={sp.q} placeholder="Firm, contact, phone, email…" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select name="status" defaultValue={sp.status || ""} className={inputClass}>
              <option value="">All</option>
              {["NEW", "NO_ANSWER", "ENGAGED", "NEGOTIATING", "PROPOSAL_SENT", "MEETING_SET", "LOST", "CONVERTED"].map((s) => (
                <option key={s} value={s}>{s.replaceAll("_", " ")}</option>
              ))}
            </select>
          </div>
          <div>
            <button type="submit" className={btnPrimary + " w-full"}>Filter</button>
          </div>
        </form>
      </Card>

      {!isSales && (
        <Card className="p-4 mb-6">
          <details>
            <summary className="text-sm font-medium text-brand cursor-pointer select-none">+ New prospect</summary>
            <form action={createProspect} className="grid md:grid-cols-2 gap-3 mt-4">
              <div>
                <label className={labelClass}>Firm name *</label>
                <input name="firmName" required maxLength={200} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Contact person</label>
                <input name="contactPerson" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input name="phone" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input name="email" type="email" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Website</label>
                <input name="website" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Address</label>
                <input name="address" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Assign to</label>
                <select name="assignedUserId" className={inputClass}>
                  <option value="">Leave unassigned</option>
                  {salesReps.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>First follow-up</label>
                <input type="date" name="nextFollowUpAt" className={inputClass} />
              </div>
              <div className="md:col-span-2 text-xs text-slate-400">Enter at least one way to reach them.</div>
              <div className="md:col-span-2">
                <button type="submit" className={btnPrimary}>Create prospect</button>
              </div>
            </form>
          </details>
        </Card>
      )}

      {rows.length === 0 ? (
        <EmptyState>No prospects match these filters.</EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className={tableClass}>
            <thead>
              <tr>
                <th className={thClass}>Firm</th>
                <th className={thClass}>Contact</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>Source</th>
                <th className={thClass}>Rep</th>
                <th className={thClass}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={tdClass}>
                    <Link href={`/sales/prospects/${r.id}`} className="font-medium text-slate-800 hover:text-brand">{r.firmName}</Link>
                  </td>
                  <td className={tdClass}>{r.contactPerson}<div className="text-xs text-slate-400">{r.phone}</div></td>
                  <td className={tdClass}><Badge value={r.status} /></td>
                  <td className={tdClass}>{r.sourceSheet}</td>
                  <td className={tdClass}>{r.assignedName ?? "—"}</td>
                  <td className={tdClass}><Link href={`/sales/prospects/${r.id}`} className="text-brand hover:underline text-xs">Open →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </Shell>
  );
}
