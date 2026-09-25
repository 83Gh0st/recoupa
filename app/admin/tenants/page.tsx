import { db, schema } from "@/lib/db";
import { requireArea } from "@/lib/rbac";
import { sql } from "drizzle-orm";
import Shell from "@/components/Shell";
import { Card, PageHeader, Badge, inputClass, labelClass, btnPrimary, tableClass, thClass, tdClass } from "@/components/ui";
import { createTenant, toggleTenantActive } from "./actions";

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const session = await requireArea("adminTenants");
  const sp = await searchParams;

  const tenants = await db.select().from(schema.tenants);
  const userCounts = await db
    .select({ tenantId: schema.users.tenantId, count: sql<number>`count(*)` })
    .from(schema.users)
    .groupBy(schema.users.tenantId);
  const countFor = (id: string) => userCounts.find((u) => u.tenantId === id)?.count ?? 0;

  return (
    <Shell session={session}>
      <PageHeader
        title="Tenants"
        subtitle="Every isolated company workspace on this deployment. A user only ever sees their own tenant's data."
      />

      {sp.error && <div className="mb-4 rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{sp.error}</div>}
      {sp.success && <div className="mb-4 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">{sp.success}</div>}

      <Card className="p-4 mb-6">
        <details>
          <summary className="text-sm font-medium text-brand cursor-pointer select-none">+ New tenant</summary>
          <form action={createTenant} className="grid md:grid-cols-2 gap-3 mt-4">
            <div>
              <label className={labelClass}>Company name *</label>
              <input name="name" required maxLength={150} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Currency code</label>
              <input name="currency" placeholder="USD" maxLength={6} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Company email</label>
              <input name="companyEmail" type="email" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Company phone</label>
              <input name="companyPhone" className={inputClass} />
            </div>
            <div className="md:col-span-2 text-xs text-slate-400">
              Starts empty with default commission tiers — create its users under Team afterward.
            </div>
            <div className="md:col-span-2">
              <button type="submit" className={btnPrimary}>Create tenant</button>
            </div>
          </form>
        </details>
      </Card>

      <Card className="overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Company</th>
              <th className={thClass}>Currency</th>
              <th className={thClass}>Users</th>
              <th className={thClass}>Status</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id}>
                <td className={tdClass}>
                  <div className="font-medium">{t.name}{t.id === session.user.tenantId && <span className="text-xs text-slate-400"> (yours)</span>}</div>
                  <div className="text-xs text-slate-400">{t.companyEmail}</div>
                </td>
                <td className={tdClass}>{t.currency}</td>
                <td className={tdClass}>{countFor(t.id)}</td>
                <td className={tdClass}>{t.isActive ? <Badge value="RESOLVED" /> : <Badge value="DECLINED" />}</td>
                <td className={tdClass}>
                  <form action={toggleTenantActive.bind(null, t.id, !t.isActive)}>
                    <button type="submit" className="text-xs text-brand hover:underline">
                      {t.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </Shell>
  );
}
