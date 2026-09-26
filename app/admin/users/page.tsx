import { db, schema } from "@/lib/db";
import { requireArea } from "@/lib/rbac";
import { eq } from "drizzle-orm";
import Shell from "@/components/Shell";
import { Card, PageHeader, Badge, inputClass, labelClass, btnPrimary, tableClass, thClass, tdClass } from "@/components/ui";
import { createUser, changeRole, toggleActive } from "./actions";

const ROLES = ["OWNER", "MANAGER", "COLLECTOR", "SALES", "CLIENT"];

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const session = await requireArea("adminUsers");
  const { tenantId, role: myRole, id: myId } = session.user;
  const sp = await searchParams;
  const isOwner = myRole === "OWNER";

  const users = await db.select().from(schema.users).where(eq(schema.users.tenantId, tenantId));
  const clients = await db.select().from(schema.principalClients).where(eq(schema.principalClients.tenantId, tenantId));
  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? "-";

  return (
    <Shell session={session}>
      <PageHeader title="Team" subtitle="Everyone with a login on this workspace." />

      {sp.error && <div className="mb-4 rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{sp.error}</div>}
      {sp.success && <div className="mb-4 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">{sp.success}</div>}

      <Card className="p-4 mb-6">
        <details>
          <summary className="text-sm font-medium text-brand cursor-pointer select-none">+ New user</summary>
          <NewUserForm isOwner={isOwner} clients={clients} />
        </details>
      </Card>

      <Card className="overflow-x-auto">
        <table className={tableClass}>
          <thead>
            <tr>
              <th className={thClass}>Name</th>
              <th className={thClass}>Email</th>
              <th className={thClass}>Role</th>
              <th className={thClass}>Client scope</th>
              <th className={thClass}>Status</th>
              <th className={thClass}></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className={tdClass}>{u.name}{u.id === myId && <span className="text-xs text-slate-400"> (you)</span>}</td>
                <td className={tdClass}>{u.email}</td>
                <td className={tdClass}>
                  {isOwner && u.id !== myId ? (
                    <form action={changeRole.bind(null, u.id)} className="flex items-center gap-1">
                      <select name="role" defaultValue={u.role} className="text-xs rounded border border-slate-200 px-1 py-0.5">
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button type="submit" className="text-xs text-brand hover:underline">Save</button>
                    </form>
                  ) : (
                    <Badge value={u.role} />
                  )}
                </td>
                <td className={tdClass}>{u.role === "CLIENT" ? clientName(u.principalClientId) : "-"}</td>
                <td className={tdClass}>{u.isActive ? <Badge value="RESOLVED" /> : <Badge value="DECLINED" />}</td>
                <td className={tdClass}>
                  {u.id !== myId && (
                    <form action={toggleActive.bind(null, u.id, !u.isActive)}>
                      <button type="submit" className="text-xs text-brand hover:underline">
                        {u.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </Shell>
  );
}

function NewUserForm({ isOwner, clients }: { isOwner: boolean; clients: { id: string; name: string }[] }) {
  const creatableRoles = isOwner ? ROLES : ["COLLECTOR", "SALES"];
  return (
    <form action={createUser} className="grid md:grid-cols-2 gap-3 mt-4">
      <div>
        <label className={labelClass}>Full name *</label>
        <input name="name" required maxLength={100} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Email *</label>
        <input name="email" type="email" required className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Password *</label>
        <input name="password" type="password" required minLength={6} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Role *</label>
        <select name="role" required className={inputClass}>
          {creatableRoles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div className="md:col-span-2">
        <label className={labelClass}>Client scope <span className="text-slate-400">(only used for Client Portal role)</span></label>
        <select name="principalClientId" className={inputClass}>
          <option value="">-</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div className="md:col-span-2">
        <button type="submit" className={btnPrimary}>Create user</button>
      </div>
    </form>
  );
}
