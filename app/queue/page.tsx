import { db, schema } from "@/lib/db";
import { requireArea } from "@/lib/rbac";
import { and, eq, inArray, asc } from "drizzle-orm";
import Shell from "@/components/Shell";
import { Card, PageHeader, EmptyState, Badge } from "@/components/ui";
import { formatDate } from "@/lib/format";
import Link from "next/link";
import { endOfDay, startOfDay } from "date-fns";

export default async function QueuePage() {
  const session = await requireArea("queue");
  const { tenantId, role, id: userId } = session.user;
  const isCollector = role === "COLLECTOR";

  const base = [
    eq(schema.debtors.tenantId, tenantId),
    inArray(schema.debtors.status, ["OPEN", "PROMISED", "DISPUTED", "NO_ANSWER"]),
  ];
  if (isCollector) base.push(eq(schema.debtors.assignedUserId, userId));

  const debtors = await db
    .select({
      id: schema.debtors.id,
      name: schema.debtors.name,
      phone: schema.debtors.phone,
      status: schema.debtors.status,
      nextFollowUpAt: schema.debtors.nextFollowUpAt,
      assignedUserId: schema.debtors.assignedUserId,
      clientName: schema.principalClients.name,
      assignedName: schema.users.name,
    })
    .from(schema.debtors)
    .leftJoin(schema.principalClients, eq(schema.debtors.clientId, schema.principalClients.id))
    .leftJoin(schema.users, eq(schema.debtors.assignedUserId, schema.users.id))
    .where(and(...base))
    .orderBy(asc(schema.debtors.nextFollowUpAt));

  const scoped = isCollector ? debtors.filter((d) => d.assignedUserId === userId) : debtors.filter((d) => d.assignedUserId);

  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  const overdue = scoped.filter((d) => d.nextFollowUpAt && new Date(d.nextFollowUpAt) < todayStart);
  const dueToday = scoped.filter((d) => d.nextFollowUpAt && new Date(d.nextFollowUpAt) >= todayStart && new Date(d.nextFollowUpAt) <= todayEnd);
  const upcoming = scoped.filter((d) => d.nextFollowUpAt && new Date(d.nextFollowUpAt) > todayEnd);
  const unscheduled = scoped.filter((d) => !d.nextFollowUpAt);

  const groups = [
    { title: "Overdue - call now", color: "border-rose-300", dot: "bg-rose-500", items: overdue },
    { title: "Due today", color: "border-amber-300", dot: "bg-amber-500", items: dueToday },
    { title: "Upcoming", color: "border-sky-300", dot: "bg-sky-500", items: upcoming },
    { title: "No follow-up scheduled", color: "border-slate-300", dot: "bg-slate-400", items: unscheduled },
  ];

  const isEmpty = scoped.length === 0;

  return (
    <Shell session={session}>
      <PageHeader
        title="Calling Queue"
        subtitle={isCollector ? "Your active assigned debtors, prioritized." : "Every collector's active assigned book."}
      />

      {isEmpty ? (
        <EmptyState>
          Nothing here. {isCollector ? "Nothing is assigned to you yet, or every file is closed." : "No debtors are currently assigned."}
        </EmptyState>
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
                {g.items.map((d) => (
                  <Link key={d.id} href={`/debtors/${d.id}`}>
                    <Card className={`p-3 border-l-4 ${g.color} hover:shadow-md transition-shadow`}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-800">{d.name}</span>
                        <Badge value={d.status} />
                      </div>
                      <div className="text-xs text-slate-500 mt-1">{d.clientName} · {d.phone}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        {d.nextFollowUpAt ? `Follow-up: ${formatDate(d.nextFollowUpAt)}` : "No date set"}
                        {!isCollector && d.assignedName && <> · {d.assignedName}</>}
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
