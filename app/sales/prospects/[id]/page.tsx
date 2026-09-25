import { db, schema } from "@/lib/db";
import { requireArea } from "@/lib/rbac";
import { and, eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import Shell from "@/components/Shell";
import { Card, PageHeader, Badge, inputClass, labelClass, btnPrimary } from "@/components/ui";
import { formatDate } from "@/lib/format";
import Link from "next/link";
import { logOutreach, convertToClient, deleteProspect, assignProspect } from "../actions";

export default async function ProspectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireArea("prospects");
  const { tenantId, role, id: userId } = session.user;
  const { id } = await params;
  const { error } = await searchParams;
  const isManager = role === "OWNER" || role === "MANAGER";

  const [prospect] = await db
    .select()
    .from(schema.prospects)
    .where(and(eq(schema.prospects.id, id), eq(schema.prospects.tenantId, tenantId)))
    .limit(1);
  if (!prospect) notFound();
  if (role === "SALES" && prospect.assignedUserId !== userId) notFound();

  const salesReps = await db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(and(eq(schema.users.tenantId, tenantId), eq(schema.users.role, "SALES")));

  const logs = await db
    .select({
      id: schema.outreachLogs.id,
      channel: schema.outreachLogs.channel,
      disposition: schema.outreachLogs.disposition,
      personContacted: schema.outreachLogs.personContacted,
      notes: schema.outreachLogs.notes,
      createdAt: schema.outreachLogs.createdAt,
      userName: schema.users.name,
    })
    .from(schema.outreachLogs)
    .leftJoin(schema.users, eq(schema.outreachLogs.userId, schema.users.id))
    .where(eq(schema.outreachLogs.prospectId, id))
    .orderBy(desc(schema.outreachLogs.createdAt));

  const isConverted = prospect.status === "CONVERTED";

  return (
    <Shell session={session}>
      <div className="mb-2">
        <Link href="/sales/prospects" className="text-xs text-slate-400 hover:text-slate-600">← Back to Prospects</Link>
      </div>
      <PageHeader
        title={prospect.firmName}
        subtitle={[prospect.contactPerson, prospect.phone, prospect.email].filter(Boolean).join(" · ")}
        action={<Badge value={prospect.status} />}
      />

      {error && <div className="mb-4 rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {isManager && (
        <Card className="p-4 mb-6 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Assigned to</span>
            <form action={async (fd: FormData) => { "use server"; await assignProspect(prospect.id, String(fd.get("userId") || "")); }}>
              <select name="userId" defaultValue={prospect.assignedUserId || ""} className="text-xs rounded border border-slate-200 px-1.5 py-1">
                <option value="">Unassigned</option>
                {salesReps.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button type="submit" className="ml-1 text-xs text-brand hover:underline">Save</button>
            </form>
          </div>
          {!isConverted && (
            <form action={convertToClient.bind(null, prospect.id)}>
              <button type="submit" className={btnPrimary}>Convert to client →</button>
            </form>
          )}
          {role === "OWNER" && (
            <form action={deleteProspect.bind(null, prospect.id)}>
              <button type="submit" className="text-xs text-rose-600 hover:underline">Delete prospect</button>
            </form>
          )}
        </Card>
      )}

      {!isConverted && (
        <Card className="p-4 mb-6">
          <div className="font-medium text-sm text-slate-800 mb-3">Log outreach</div>
          <form action={logOutreach.bind(null, prospect.id)} className="grid md:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Channel *</label>
              <select name="channel" required className={inputClass}>
                <option value="CALL">Call</option>
                <option value="EMAIL">Email</option>
                <option value="IN_PERSON">In person</option>
                <option value="WHATSAPP">WhatsApp</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Disposition *</label>
              <select name="disposition" required className={inputClass}>
                <option value="NO_ANSWER">No answer</option>
                <option value="ENGAGED">Contacted / interested</option>
                <option value="NEGOTIATING">Follow-up / negotiation</option>
                <option value="PROPOSAL_SENT">Proposal sent</option>
                <option value="MEETING_SET">Meeting scheduled</option>
                <option value="LOST">Not interested</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Person contacted</label>
              <input name="personContacted" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Override follow-up date</label>
              <input type="date" name="overrideFollowUp" className={inputClass} />
            </div>
            <div className="md:col-span-2">
              <label className={labelClass}>Notes *</label>
              <textarea name="notes" required rows={3} maxLength={4000} className={inputClass} />
            </div>
            <div className="md:col-span-2">
              <button type="submit" className={btnPrimary}>Save outreach</button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-4">
        <div className="font-medium text-sm text-slate-800 mb-3">Outreach history</div>
        {logs.length === 0 ? (
          <p className="text-sm text-slate-400">Nothing logged yet.</p>
        ) : (
          <ul className="space-y-3">
            {logs.map((l) => (
              <li key={l.id} className="border-l-2 border-slate-200 pl-3 text-sm">
                <div className="flex items-center gap-2">
                  <Badge value={l.disposition} />
                  <span className="text-xs text-slate-400">{l.channel} · {formatDate(l.createdAt)} · {l.userName ?? "—"}</span>
                </div>
                <p className="mt-1 text-slate-700">{l.notes}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Shell>
  );
}
