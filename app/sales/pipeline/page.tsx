import { db, schema } from "@/lib/db";
import { requireArea } from "@/lib/rbac";
import { and, eq, desc } from "drizzle-orm";
import { endOfDay } from "date-fns";
import Shell from "@/components/Shell";
import { Card, StatCard, PageHeader, Badge } from "@/components/ui";
import { formatDate } from "@/lib/format";
import Link from "next/link";

const STATUSES = ["NEW", "NO_ANSWER", "ENGAGED", "NEGOTIATING", "PROPOSAL_SENT", "MEETING_SET", "LOST", "CONVERTED"];

export default async function PipelinePage() {
  const session = await requireArea("salesPipeline");
  const { tenantId, role, id: userId } = session.user;
  const isSales = role === "SALES";

  const filter = isSales
    ? and(eq(schema.prospects.tenantId, tenantId), eq(schema.prospects.assignedUserId, userId))
    : eq(schema.prospects.tenantId, tenantId);

  const prospects = await db.select().from(schema.prospects).where(filter);

  const active = prospects.filter((p) => p.status !== "LOST" && p.status !== "CONVERTED").length;
  const converted = prospects.filter((p) => p.status === "CONVERTED").length;
  const today = endOfDay(new Date());
  const dueToday = prospects.filter((p) => p.nextFollowUpAt && new Date(p.nextFollowUpAt) <= today && p.status !== "LOST" && p.status !== "CONVERTED").length;

  const byStatus = STATUSES.map((s) => ({ status: s, count: prospects.filter((p) => p.status === s).length }));
  const maxCount = Math.max(1, ...byStatus.map((b) => b.count));

  const recentOutreach = await db
    .select({
      id: schema.outreachLogs.id,
      channel: schema.outreachLogs.channel,
      disposition: schema.outreachLogs.disposition,
      notes: schema.outreachLogs.notes,
      createdAt: schema.outreachLogs.createdAt,
      firmName: schema.prospects.firmName,
      prospectId: schema.prospects.id,
    })
    .from(schema.outreachLogs)
    .innerJoin(schema.prospects, eq(schema.outreachLogs.prospectId, schema.prospects.id))
    .where(eq(schema.outreachLogs.tenantId, tenantId))
    .orderBy(desc(schema.outreachLogs.createdAt))
    .limit(8);

  return (
    <Shell session={session}>
      <PageHeader title="Sales Pipeline" subtitle={isSales ? "Your prospects only." : "The full new-business pipeline."} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Active prospects" value={active} />
        <StatCard label="Follow-ups due today" value={dueToday} />
        <StatCard label="Converted" value={converted} />
        <StatCard label="Total pipeline" value={prospects.length} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-4">
          <div className="font-medium text-sm text-slate-800 mb-3">Status breakdown</div>
          <div className="space-y-2">
            {byStatus.filter((b) => b.count > 0).map((b) => (
              <div key={b.status} className="flex items-center gap-2">
                <div className="w-28 text-xs text-slate-500">{b.status.replaceAll("_", " ")}</div>
                <div className="flex-1 bg-slate-100 rounded-full h-2">
                  <div className="bg-brand h-2 rounded-full" style={{ width: `${(b.count / maxCount) * 100}%` }} />
                </div>
                <div className="w-6 text-xs text-slate-500 text-right">{b.count}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <div className="font-medium text-sm text-slate-800 mb-3">Recent outreach</div>
          {recentOutreach.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing logged yet.</p>
          ) : (
            <ul className="space-y-2">
              {recentOutreach.map((o) => (
                <li key={o.id} className="text-sm">
                  <Link href={`/sales/prospects/${o.prospectId}`} className="text-brand hover:underline">{o.firmName}</Link>
                  <span className="text-xs text-slate-400"> · {o.channel} · {formatDate(o.createdAt)}</span>
                  <div className="text-xs text-slate-500 truncate">{o.notes}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </Shell>
  );
}
