import { requireSession } from "@/lib/rbac";
import { db, schema } from "@/lib/db";
import { and, eq, lte, gte, inArray, sql } from "drizzle-orm";
import { addDays, endOfDay } from "date-fns";
import Shell from "@/components/Shell";
import { Card, StatCard, PageHeader, Badge } from "@/components/ui";
import { money, formatDate } from "@/lib/format";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await requireSession();
  const { tenantId, role, currency } = session.user;
  const isCollector = role === "COLLECTOR";
  const isSales = role === "SALES";
  const scopeToSelf = isCollector ? session.user.id : null;

  const today = endOfDay(new Date());

  // ---- Collection KPIs ----
  const debtorFilter = scopeToSelf
    ? and(eq(schema.debtors.tenantId, tenantId), eq(schema.debtors.assignedUserId, scopeToSelf))
    : eq(schema.debtors.tenantId, tenantId);

  const [debtorCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.debtors)
    .where(debtorFilter);

  const invoiceFilter = eq(schema.invoices.tenantId, tenantId);
  const [invoiceTotals] = await db
    .select({
      count: sql<number>`count(*)`,
      receivable: sql<string>`coalesce(sum(${schema.invoices.amount}), 0)`,
      balance: sql<string>`coalesce(sum(${schema.invoices.outstanding}), 0)`,
    })
    .from(schema.invoices)
    .where(invoiceFilter);

  const [paymentTotals] = await db
    .select({
      collected: sql<string>`coalesce(sum(${schema.payments.amount}), 0)`,
      commission: sql<string>`coalesce(sum(${schema.payments.commissionAmount}), 0)`,
    })
    .from(schema.payments)
    .where(eq(schema.payments.tenantId, tenantId));

  const [followUpsDue] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.debtors)
    .where(
      and(
        debtorFilter,
        lte(schema.debtors.nextFollowUpAt, today),
        inArray(schema.debtors.status, ["OPEN", "PROMISED", "DISPUTED", "NO_ANSWER"])
      )
    );

  const pdcAlerts = await db
    .select({
      id: schema.cheques.id,
      chequeNumber: schema.cheques.chequeNumber,
      bankName: schema.cheques.bankName,
      amount: schema.cheques.amount,
      maturityDate: schema.cheques.maturityDate,
      debtorId: schema.cheques.debtorId,
      debtorName: schema.debtors.name,
    })
    .from(schema.cheques)
    .innerJoin(schema.debtors, eq(schema.cheques.debtorId, schema.debtors.id))
    .where(
      and(
        eq(schema.cheques.tenantId, tenantId),
        eq(schema.cheques.type, "POST_DATED"),
        inArray(schema.cheques.status, ["PENDING", "DEPOSITED"]),
        lte(schema.cheques.maturityDate, addDays(new Date(), 7))
      )
    )
    .limit(8);

  const disputeCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.debtors)
    .where(and(eq(schema.debtors.tenantId, tenantId), eq(schema.debtors.status, "DISPUTED")));

  // ---- Sales KPIs ----
  const prospectFilter = isSales
    ? and(eq(schema.prospects.tenantId, tenantId), eq(schema.prospects.assignedUserId, session.user.id))
    : eq(schema.prospects.tenantId, tenantId);

  const [prospectTotals] = await db
    .select({
      active: sql<number>`count(*) filter (where ${schema.prospects.status} not in ('LOST','CONVERTED'))`,
      converted: sql<number>`count(*) filter (where ${schema.prospects.status} = 'CONVERTED')`,
      dueToday: sql<number>`count(*) filter (where ${schema.prospects.nextFollowUpAt} <= ${today})`,
    })
    .from(schema.prospects)
    .where(prospectFilter);

  const showCollection = role !== "SALES";
  const showSales = role === "OWNER" || role === "MANAGER" || role === "SALES";

  return (
    <Shell session={session}>
      <PageHeader
        title="Dashboard"
        subtitle={
          isCollector
            ? "Showing your assigned cases only."
            : isSales
            ? "Showing your pipeline only."
            : "Full workspace overview."
        }
      />

      {showCollection && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label={isCollector ? "Assigned cases" : "Debtors"} value={debtorCount?.count ?? 0} />
            <StatCard label="Invoices" value={invoiceTotals?.count ?? 0} />
            <StatCard label="Receivable" value={money(invoiceTotals?.receivable, currency)} />
            <StatCard label="Balance outstanding" value={money(invoiceTotals?.balance, currency)} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard label="Collected (all time)" value={money(paymentTotals?.collected, currency)} />
            <StatCard label="Commission earned" value={money(paymentTotals?.commission, currency)} />
            <StatCard label="Follow-ups due today" value={followUpsDue?.count ?? 0} />
            <StatCard label="Open disputes" value={disputeCount[0]?.count ?? 0} />
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <Card className="p-4">
              <div className="font-medium text-sm text-slate-800 mb-3">
                PDC maturity — next 7 days
              </div>
              {pdcAlerts.length === 0 ? (
                <p className="text-sm text-slate-400">No post-dated cheques maturing soon.</p>
              ) : (
                <ul className="space-y-2">
                  {pdcAlerts.map((c) => (
                    <li key={c.id} className="flex items-center justify-between text-sm">
                      <Link href={`/debtors/${c.debtorId}`} className="text-brand hover:underline">
                        {c.debtorName} — #{c.chequeNumber}
                      </Link>
                      <span className="text-slate-500">
                        {money(c.amount, currency)} · {formatDate(c.maturityDate)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card className="p-4">
              <div className="font-medium text-sm text-slate-800 mb-3">Quick links</div>
              <div className="grid grid-cols-2 gap-2">
                <Link href="/queue" className="text-sm text-brand hover:underline">
                  Open calling queue →
                </Link>
                <Link href="/disputes" className="text-sm text-brand hover:underline">
                  Review disputes →
                </Link>
                <Link href="/corrections" className="text-sm text-brand hover:underline">
                  Payment corrections →
                </Link>
                <Link href="/clients" className="text-sm text-brand hover:underline">
                  Principal clients →
                </Link>
              </div>
            </Card>
          </div>
        </>
      )}

      {showSales && (
        <Card className="p-4">
          <div className="font-medium text-sm text-slate-800 mb-3">Sales pipeline</div>
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Active prospects" value={prospectTotals?.active ?? 0} />
            <StatCard label="Follow-ups due today" value={prospectTotals?.dueToday ?? 0} />
            <StatCard label="Converted" value={prospectTotals?.converted ?? 0} />
          </div>
        </Card>
      )}

      {role === "CLIENT" && (
        <p className="text-sm text-slate-500">
          You&apos;re viewing a read-only summary of your portfolio. Use{" "}
          <Badge value="OPEN" /> statuses and the Disputes page to track progress.
        </p>
      )}
    </Shell>
  );
}
