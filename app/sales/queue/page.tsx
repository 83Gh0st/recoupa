import { db, schema } from "@/lib/db";
import { requireArea } from "@/lib/rbac";
import { and, eq, inArray, asc } from "drizzle-orm";
import { startOfDay, endOfDay } from "date-fns";
import Shell from "@/components/Shell";
import { Card, PageHeader, EmptyState, Badge } from "@/components/ui";
import { formatDate } from "@/lib/format";
import Link from "next/link";

export default async function SalesQueuePage() {
  const session = await requireArea("salesQueue");
  const { tenantId, role, id: userId } = session.user;
  const isSales = role === "SALES";

  const conditions = [
    eq(schema.prospects.tenantId, tenantId),
    inArray(schema.prospects.status, ["NEW", "NO_ANSWER", "ENGAGED", "NEGOTIATING", "PROPOSAL_SENT", "MEETING_SET"]),
  ];
  if (isSales) conditions.push(eq(schema.prospects.assignedUserId, userId));

  const prospects = await db
    .select({
      id: schema.prospects.id,
      firmName: schema.prospects.firmName,
      phone: schema.prospects.phone,
      status: schema.prospects.status,
      nextFollowUpAt: schema.prospects.nextFollowUpAt,
      assignedUserId: schema.prospects.assignedUserId,
      assignedName: schema.users.name,
    })
    .from(schema.prospects)
    .leftJoin(schema.users, eq(schema.prospects.assignedUserId, schema.users.id))
    .where(and(...conditions))
    .orderBy(asc(schema.prospects.nextFollowUpAt));

  const scoped = isSales ? prospects : prospects.filter((p) => p.assignedUserId);

  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const groups = [
    { title: "Overdue", color: "border-rose-300", dot: "bg-rose-500", items: scoped.filter((p) => p.nextFollowUpAt && new Date(p.nextFollowUpAt) < todayStart) },
    { title: "Due today", color: "border-amber-300", dot: "bg-amber-500", items: scoped.filter((p) => p.nextFollowUpAt && new Date(p.nextFollowUpAt) >= todayStart && new Date(p.nextFollowUpAt) <= todayEnd) },
    { title: "Upcoming", color: "border-sky-300", dot: "bg-sky-500", items: scoped.filter((p) => p.nextFollowUpAt && new Date(p.nextFollowUpAt) > todayEnd) },
    { title: "Unscheduled", color: "border-slate-300", dot: "bg-slate-400", items: scoped.filter((p) => !p.nextFollowUpAt) },
  ];

  return (
    <Shell session={session}>
      <PageHeader title="Outreach Queue" subtitle={isSales ? "Your active prospects, prioritized." : "Every rep's active assigned prospects."} />
      {scoped.length === 0 ? (
        <EmptyState>Nothing here right now.</EmptyState>
      ) : (
        <div className="space-y-8">
          {groups.filter((g) => g.items.length > 0).map((g) => (
            <div key={g.title}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`h-2 w-2 rounded-full ${g.dot}`} />
                <h2 className="text-sm font-semibold text-slate-700">{g.title}</h2>
                <span className="text-xs text-slate-400">({g.items.length})</span>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {g.items.map((p) => (
                  <Link key={p.id} href={`/sales/prospects/${p.id}`}>
                    <Card className={`p-3 border-l-4 ${g.color} hover:shadow-md transition-shadow`}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-800">{p.firmName}</span>
                        <Badge value={p.status} />
                      </div>
                      <div className="text-xs text-slate-500 mt-1">{p.phone}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        {p.nextFollowUpAt ? `Follow-up: ${formatDate(p.nextFollowUpAt)}` : "No date set"}
                        {!isSales && p.assignedName && <> · {p.assignedName}</>}
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
