import { db, schema } from "@/lib/db";
import { requireArea } from "@/lib/rbac";
import { asc, eq } from "drizzle-orm";
import Shell from "@/components/Shell";
import { Card, PageHeader, inputClass, labelClass, btnPrimary, tableClass, thClass, tdClass } from "@/components/ui";
import { createTier, updateTier, deleteTier } from "./actions";

export default async function CommissionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const session = await requireArea("adminCommission");
  const sp = await searchParams;

  const tiers = await db
    .select()
    .from(schema.commissionTiers)
    .where(eq(schema.commissionTiers.tenantId, session.user.tenantId))
    .orderBy(asc(schema.commissionTiers.sortOrder));

  return (
    <Shell session={session}>
      <PageHeader
        title="Commission Rules"
        subtitle="Suggested commission % by invoice age. Pre-fills new invoices; existing invoices are unaffected."
      />

      {sp.error && <div className="mb-4 rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{sp.error}</div>}
      {sp.success && <div className="mb-4 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">{sp.success}</div>}

      <Card className="overflow-x-auto mb-6">
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Label</th>
              <th className={thClass}>Min days</th>
              <th className={thClass}>Max days</th>
              <th className={thClass}>Commission %</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((t) => (
              <tr key={t.id}>
                <td className={tdClass}>
                  <form action={updateTier.bind(null, t.id)} className="flex flex-wrap gap-1 items-center">
                    <input name="label" defaultValue={t.label} className="text-xs rounded border border-slate-200 px-1.5 py-1 w-28" />
                    <input type="number" name="minDays" defaultValue={t.minDays} className="text-xs rounded border border-slate-200 px-1.5 py-1 w-16" />
                    <input type="number" name="maxDays" defaultValue={t.maxDays ?? ""} placeholder="open" className="text-xs rounded border border-slate-200 px-1.5 py-1 w-16" />
                    <input type="number" step="0.01" name="pct" defaultValue={t.pct} className="text-xs rounded border border-slate-200 px-1.5 py-1 w-16" />
                    <input type="hidden" name="sortOrder" value={t.sortOrder} />
                    <button type="submit" className="text-xs text-brand hover:underline">Save</button>
                  </form>
                </td>
                <td className={tdClass}>{t.minDays}</td>
                <td className={tdClass}>{t.maxDays ?? "Open-ended"}</td>
                <td className={tdClass}>{Number(t.pct).toFixed(2)}%</td>
                <td className={tdClass}>
                  <form action={deleteTier.bind(null, t.id)}>
                    <button type="submit" className="text-xs text-rose-500 hover:underline">Remove</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-4">
        <div className="font-medium text-sm text-slate-800 mb-3">+ New tier</div>
        <form action={createTier} className="grid md:grid-cols-5 gap-3">
          <div>
            <label className={labelClass}>Label</label>
            <input name="label" required placeholder="e.g. 0–30 days" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Min days</label>
            <input type="number" name="minDays" required min={0} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Max days</label>
            <input type="number" name="maxDays" placeholder="Leave blank for open-ended" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Commission %</label>
            <input type="number" step="0.01" name="pct" required min={0} max={100} className={inputClass} />
          </div>
          <div className="flex items-end">
            <button type="submit" className={btnPrimary}>Add tier</button>
          </div>
        </form>
      </Card>
    </Shell>
  );
}
