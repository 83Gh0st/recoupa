import { db, schema } from "@/lib/db";
import { requireArea } from "@/lib/rbac";
import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import Shell from "@/components/Shell";
import {
  Card,
  PageHeader,
  Badge,
  EmptyState,
  inputClass,
  labelClass,
  btnPrimary,
  btnSecondary,
  tableClass,
  thClass,
  tdClass,
} from "@/components/ui";
import { money, formatDate } from "@/lib/format";
import { suggestCommissionPct } from "@/lib/commission";
import {
  manageLead,
  deleteLead,
  addInvoice,
  logCall,
  recordCheque,
  updateChequeStatus,
  recordPayment,
  editPayment,
  requestCorrection,
  addDocument,
  deleteDocument,
} from "../actions";

const STATUSES = ["OPEN", "PROMISED", "DISPUTED", "NO_ANSWER", "DECLINED", "RESOLVED"];
const DISPUTE_REASONS = ["PRICE_DISCREPANCY", "MISSING_DOCS", "DAMAGED_GOODS"];
const DOC_TYPES = [
  "INVOICE",
  "CONTRACT",
  "CORRESPONDENCE",
  "SUPPORTING",
  "CHEQUE_COPY",
  "DELIVERY_NOTE",
  "PURCHASE_ORDER",
  "ID_DOCUMENT",
  "OTHER",
];

export default async function DebtorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireArea("debtors");
  const { id } = await params;
  const { error } = await searchParams;
  const { tenantId, role, currency, id: userId } = session.user;
  const isManager = role === "OWNER" || role === "MANAGER";
  const isCollector = role === "COLLECTOR";
  const canDelete = role === "OWNER";

  const [debtor] = await db
    .select()
    .from(schema.debtors)
    .where(and(eq(schema.debtors.id, id), eq(schema.debtors.tenantId, tenantId)))
    .limit(1);
  if (!debtor) notFound();
  if (isCollector && debtor.assignedUserId !== userId) notFound();

  const [client] = await db
    .select()
    .from(schema.principalClients)
    .where(eq(schema.principalClients.id, debtor.clientId))
    .limit(1);

  const invoices = await db
    .select()
    .from(schema.invoices)
    .where(eq(schema.invoices.debtorId, id))
    .orderBy(desc(schema.invoices.invoiceDate));

  const cheques = await db
    .select()
    .from(schema.cheques)
    .where(eq(schema.cheques.debtorId, id))
    .orderBy(desc(schema.cheques.createdAt));

  const payments = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.debtorId, id))
    .orderBy(desc(schema.payments.createdAt));

  const corrections = await db
    .select()
    .from(schema.paymentCorrections)
    .where(eq(schema.paymentCorrections.tenantId, tenantId));
  const correctionByPayment = new Map(corrections.map((c) => [c.paymentId, c]));

  const documents = await db
    .select()
    .from(schema.documents)
    .where(eq(schema.documents.debtorId, id))
    .orderBy(desc(schema.documents.createdAt));

  const calls = await db
    .select()
    .from(schema.callLogs)
    .where(eq(schema.callLogs.debtorId, id))
    .orderBy(desc(schema.callLogs.createdAt));

  const collectors = await db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(and(eq(schema.users.tenantId, tenantId), eq(schema.users.role, "COLLECTOR")));

  const totalInvoiced = invoices.reduce((s, i) => s + Number(i.amount), 0);
  const totalOutstanding = invoices.reduce((s, i) => s + Number(i.outstanding), 0);
  const totalCollected = totalInvoiced - totalOutstanding;
  const openInvoices = invoices.filter((i) => Number(i.outstanding) > 0);

  const suggestedPct = await suggestCommissionPct(
    tenantId,
    new Date(),
    client ? Number(client.commissionPct) : 10
  );

  const nextFollowUpValue = debtor.nextFollowUpAt
    ? new Date(debtor.nextFollowUpAt).toISOString().slice(0, 10)
    : "";

  const canManageDebtor = isManager;
  const canOperate = isManager || isCollector;

  return (
    <Shell session={session}>
      <div className="mb-2">
        <Link href="/debtors" className="text-xs text-slate-400 hover:text-slate-600">
          ← Back to Debtors
        </Link>
      </div>
      <PageHeader
        title={debtor.name}
        subtitle={`${client?.name ?? "-"} · ${debtor.phone}`}
        action={<Badge value={debtor.status} />}
      />

      {error && (
        <div className="mb-4 rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-xs text-slate-500">Total invoiced</div>
          <div className="text-xl font-semibold mt-1">{money(totalInvoiced, currency)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-slate-500">Collected</div>
          <div className="text-xl font-semibold mt-1 text-emerald-700">{money(totalCollected, currency)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-slate-500">Remaining</div>
          <div className="text-xl font-semibold mt-1 text-rose-700">{money(totalOutstanding, currency)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-slate-500">Next follow-up</div>
          <div className="text-xl font-semibold mt-1">{formatDate(debtor.nextFollowUpAt)}</div>
        </Card>
      </div>

      {canManageDebtor && (
        <Card className="p-4 mb-6">
          <div className="text-sm font-medium text-slate-800 mb-3">Manage lead</div>
          <form action={manageLead.bind(null, debtor.id)} className="grid md:grid-cols-4 gap-3 items-end">
            <div>
              <label className={labelClass}>Status</label>
              <select name="status" defaultValue={debtor.status} className={inputClass}>
                {STATUSES.map((st) => (
                  <option key={st} value={st}>{st.replaceAll("_", " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Agent</label>
              <select name="assignedUserId" defaultValue={debtor.assignedUserId ?? ""} className={inputClass}>
                <option value="">Unassigned</option>
                {collectors.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Next follow-up</label>
              <input type="date" name="nextFollowUpAt" defaultValue={nextFollowUpValue} className={inputClass} />
            </div>
            <div className="flex gap-2">
              <button type="submit" className={btnPrimary}>Save changes</button>
            </div>
          </form>
          {canDelete && (
            <form action={deleteLead.bind(null, debtor.id)} className="mt-3">
              <button
                type="submit"
                className="text-xs text-rose-600 hover:underline"
              >
                Delete lead (irreversible - also deletes call logs)
              </button>
            </form>
          )}
        </Card>
      )}

      {/* Statement of account */}
      <Card className="p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-slate-800">Statement of account</div>
        </div>
        {invoices.length === 0 ? (
          <EmptyState>No invoices yet - use Master Load or add an invoice below.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className={tableClass}>
              <thead>
                <tr>
                  <th className={thClass}>Invoice #</th>
                  <th className={thClass}>Invoice date</th>
                  <th className={thClass}>Due</th>
                  <th className={thClass}>Amount</th>
                  <th className={thClass}>Outstanding</th>
                  <th className={thClass}>Comm. %</th>
                  <th className={thClass}>Status</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className={tdClass}>{inv.invoiceNumber}</td>
                    <td className={tdClass}>{formatDate(inv.invoiceDate)}</td>
                    <td className={tdClass}>{formatDate(inv.dueDate)}</td>
                    <td className={tdClass}>{money(inv.amount, currency)}</td>
                    <td className={tdClass}>{money(inv.outstanding, currency)}</td>
                    <td className={tdClass}>{Number(inv.commissionPct).toFixed(2)}%</td>
                    <td className={tdClass}><Badge value={inv.status} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className={tdClass} colSpan={3}><strong>Totals</strong></td>
                  <td className={tdClass}><strong>{money(totalInvoiced, currency)}</strong></td>
                  <td className={tdClass}><strong>{money(totalOutstanding, currency)}</strong></td>
                  <td className={tdClass} colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {canManageDebtor && (
          <details className="mt-4">
            <summary className="text-sm font-medium text-brand cursor-pointer select-none">
              + Add invoice
            </summary>
            <form action={addInvoice.bind(null, debtor.id)} className="grid md:grid-cols-5 gap-3 mt-3">
              <div>
                <label className={labelClass}>Invoice number *</label>
                <input name="invoiceNumber" required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Invoice date *</label>
                <input type="date" name="invoiceDate" required defaultValue={new Date().toISOString().slice(0, 10)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Due date</label>
                <input type="date" name="dueDate" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Amount *</label>
                <input type="number" step="0.01" min="0.01" name="amount" required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Commission % (auto-suggested)</label>
                <input type="number" step="0.01" min="0" max="100" name="commissionPct" defaultValue={suggestedPct} className={inputClass} />
              </div>
              <div className="md:col-span-5">
                <button type="submit" className={btnPrimary}>Add invoice</button>
              </div>
            </form>
          </details>
        )}
      </Card>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        {/* Cheques */}
        <Card className="p-4">
          <div className="text-sm font-medium text-slate-800 mb-3">Cheques</div>
          {cheques.length === 0 ? (
            <p className="text-sm text-slate-400 mb-3">No cheques recorded.</p>
          ) : (
            <ul className="space-y-2 mb-3">
              {cheques.map((c) => (
                <li key={c.id} className="text-sm border border-slate-100 rounded-md p-2">
                  <div className="flex justify-between">
                    <span className="font-medium">#{c.chequeNumber} · {c.bankName}</span>
                    <Badge value={c.status} />
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {c.type === "POST_DATED" ? "Post-dated" : "Current"} · {money(c.amount, currency)} ·
                    {c.maturityDate ? ` matures ${formatDate(c.maturityDate)}` : ` dated ${formatDate(c.chequeDate)}`}
                  </div>
                  {canOperate && (
                    <div className="mt-1 flex gap-1">
                      {["PENDING", "DEPOSITED", "CLEARED", "BOUNCED"].map((st) => (
                        <form key={st} action={updateChequeStatus.bind(null, debtor.id, c.id, st)}>
                          <button
                            type="submit"
                            className={`text-[11px] px-1.5 py-0.5 rounded border ${
                              c.status === st ? "bg-slate-800 text-white border-slate-800" : "border-slate-200 text-slate-500 hover:bg-slate-50"
                            }`}
                          >
                            {st}
                          </button>
                        </form>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canOperate && (
            <details>
              <summary className="text-sm font-medium text-brand cursor-pointer select-none">+ Record cheque</summary>
              <form action={recordCheque.bind(null, debtor.id)} className="grid grid-cols-2 gap-2 mt-3">
                <select name="type" className={inputClass}>
                  <option value="CURRENT">Current-date</option>
                  <option value="POST_DATED">Post-dated (PDC)</option>
                </select>
                <input name="chequeNumber" placeholder="Cheque no. *" required className={inputClass} />
                <input name="bankName" placeholder="Bank name *" required className={inputClass} />
                <input type="number" step="0.01" name="amount" placeholder="Amount *" required className={inputClass} />
                <label className="text-xs text-slate-500 col-span-2 -mb-1">Cheque date</label>
                <input type="date" name="chequeDate" required className={inputClass} />
                <label className="text-xs text-slate-500 col-span-2 -mb-1">Maturity date (if PDC)</label>
                <input type="date" name="maturityDate" className={inputClass} />
                <select name="invoiceId" className={inputClass}>
                  <option value="">Unallocated</option>
                  {invoices.map((i) => (
                    <option key={i.id} value={i.id}>{i.invoiceNumber}</option>
                  ))}
                </select>
                <input name="remarks" placeholder="Remarks" className={inputClass} />
                <button type="submit" className={`${btnPrimary} col-span-2`}>Save cheque</button>
              </form>
            </details>
          )}
        </Card>

        {/* Payments */}
        <Card className="p-4">
          <div className="text-sm font-medium text-slate-800 mb-3">Payments</div>
          {payments.length === 0 ? (
            <p className="text-sm text-slate-400 mb-3">No payments recorded yet.</p>
          ) : (
            <ul className="space-y-2 mb-3">
              {payments.map((p) => {
                const inv = invoices.find((i) => i.id === p.invoiceId);
                const correction = correctionByPayment.get(p.id);
                return (
                  <li key={p.id} className="text-sm border border-slate-100 rounded-md p-2">
                    <div className="flex justify-between">
                      <span className="font-medium">{money(p.amount, currency)} - {inv?.invoiceNumber}</span>
                      <span className="text-xs text-slate-400">{formatDate(p.createdAt)}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {p.method.replaceAll("_", " ")} · commission {money(p.commissionAmount, currency)}
                    </div>
                    {correction && (
                      <div className="text-xs mt-1">
                        Correction requested → {money(correction.proposedAmount, currency)}{" "}
                        <Badge value={correction.status} />
                      </div>
                    )}
                    {isManager && (
                      <details className="mt-1">
                        <summary className="text-[11px] text-brand cursor-pointer select-none">Edit</summary>
                        <form action={editPayment.bind(null, debtor.id, p.id)} className="flex gap-1 mt-1">
                          <input type="number" step="0.01" name="amount" defaultValue={p.amount} className="text-xs rounded border border-slate-300 px-1.5 py-1 w-24" />
                          <button type="submit" className="text-[11px] px-2 py-1 rounded bg-brand text-white">Save</button>
                        </form>
                      </details>
                    )}
                    {isCollector && !correction && (
                      <details className="mt-1">
                        <summary className="text-[11px] text-brand cursor-pointer select-none">Request correction</summary>
                        <form action={requestCorrection.bind(null, debtor.id, p.id)} className="flex flex-col gap-1 mt-1">
                          <input type="number" step="0.01" name="proposedAmount" placeholder="Correct amount" required className="text-xs rounded border border-slate-300 px-1.5 py-1" />
                          <input name="reason" placeholder="Reason" required className="text-xs rounded border border-slate-300 px-1.5 py-1" />
                          <button type="submit" className="text-[11px] px-2 py-1 rounded bg-brand text-white self-start">Submit</button>
                        </form>
                      </details>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {canOperate && openInvoices.length > 0 && (
            <details>
              <summary className="text-sm font-medium text-brand cursor-pointer select-none">+ Record payment</summary>
              <form action={recordPayment.bind(null, debtor.id)} className="grid grid-cols-2 gap-2 mt-3">
                <select name="invoiceId" required className={`${inputClass} col-span-2`}>
                  <option value="">Select invoice…</option>
                  {openInvoices.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.invoiceNumber} - outstanding {money(i.outstanding, currency)} ({Number(i.commissionPct)}%)
                    </option>
                  ))}
                </select>
                <input type="number" step="0.01" min="0.01" name="amount" placeholder="Amount *" required className={inputClass} />
                <select name="method" className={inputClass}>
                  <option value="BANK_TRANSFER">Bank transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="POST_DATED_CHEQUE">Post-dated cheque</option>
                </select>
                <select name="chequeId" className={`${inputClass} col-span-2`}>
                  <option value="">No linked cheque</option>
                  {cheques.filter((c) => c.status === "PENDING" || c.status === "DEPOSITED").map((c) => (
                    <option key={c.id} value={c.id}>#{c.chequeNumber} - {money(c.amount, currency)}</option>
                  ))}
                </select>
                <input name="notes" placeholder="Notes (reference, etc.)" className={`${inputClass} col-span-2`} />
                <button type="submit" className={`${btnPrimary} col-span-2`}>Save payment</button>
              </form>
            </details>
          )}
        </Card>
      </div>

      {/* Documents */}
      <Card className="p-4 mb-6">
        <div className="text-sm font-medium text-slate-800 mb-3">Documents</div>
        {documents.length === 0 ? (
          <p className="text-sm text-slate-400 mb-3">No documents on file.</p>
        ) : (
          <ul className="divide-y divide-slate-100 mb-3">
            {documents.map((doc) => (
              <li key={doc.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{doc.fileName}</div>
                  <div className="text-xs text-slate-400">
                    <Badge value={doc.docType} /> {doc.notes && `· ${doc.notes}`}
                  </div>
                </div>
                {isManager && (
                  <form action={deleteDocument.bind(null, debtor.id, doc.id)}>
                    <button type="submit" className="text-xs text-rose-500 hover:underline">Remove</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        {canOperate && (
          <details>
            <summary className="text-sm font-medium text-brand cursor-pointer select-none">+ Add document</summary>
            <form action={addDocument.bind(null, debtor.id)} className="grid md:grid-cols-4 gap-2 mt-3">
              <input name="fileName" placeholder="File name / reference *" required className={inputClass} />
              <select name="docType" className={inputClass}>
                {DOC_TYPES.map((t) => (
                  <option key={t} value={t}>{t.replaceAll("_", " ")}</option>
                ))}
              </select>
              <select name="invoiceId" className={inputClass}>
                <option value="">Debtor only</option>
                {invoices.map((i) => (
                  <option key={i.id} value={i.id}>{i.invoiceNumber}</option>
                ))}
              </select>
              <input name="notes" placeholder="Notes" className={inputClass} />
              <button type="submit" className={`${btnPrimary} md:col-span-4`}>Save</button>
            </form>
          </details>
        )}
      </Card>

      {/* Call logging + history */}
      <Card className="p-4">
        <div className="text-sm font-medium text-slate-800 mb-3">Log a call outcome</div>
        {canOperate && (
          <form action={logCall.bind(null, debtor.id)} className="grid md:grid-cols-3 gap-3 mb-6">
            <input name="personContacted" placeholder="Person contacted" className={inputClass} />
            <select name="disposition" required className={inputClass}>
              <option value="OPEN">Open - still working the file</option>
              <option value="PROMISED">Promise to pay</option>
              <option value="DISPUTED">Dispute</option>
              <option value="NO_ANSWER">No answer</option>
              <option value="DECLINED">Not interested</option>
              <option value="RESOLVED">Settled</option>
            </select>
            <select name="disputeReason" className={inputClass}>
              <option value="">Dispute reason (if disputed)</option>
              {DISPUTE_REASONS.map((r) => (
                <option key={r} value={r}>{r.replaceAll("_", " ")}</option>
              ))}
            </select>
            <input type="date" name="promisedDate" placeholder="Promised date (if PTP)" className={inputClass} />
            <input type="number" step="0.01" name="promisedAmount" placeholder="Promised amount (optional)" className={inputClass} />
            <div className="md:col-span-3">
              <textarea
                name="notes"
                required
                maxLength={4000}
                rows={3}
                placeholder="Notes - who you spoke to, what was agreed, next action…"
                className={inputClass}
              />
            </div>
            <div className="md:col-span-3">
              <button type="submit" className={btnPrimary}>Save outcome</button>
            </div>
          </form>
        )}

        <div className="text-sm font-medium text-slate-800 mb-3">Call history</div>
        {calls.length === 0 ? (
          <p className="text-sm text-slate-400">No calls logged yet.</p>
        ) : (
          <ul className="space-y-3">
            {calls.map((c) => (
              <li key={c.id} className="border-l-2 border-slate-200 pl-3">
                <div className="flex items-center gap-2 text-sm">
                  <Badge value={c.disposition} />
                  <span className="text-xs text-slate-400">{formatDate(c.createdAt)}</span>
                  {c.personContacted && <span className="text-xs text-slate-400">· {c.personContacted}</span>}
                </div>
                <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{c.notes}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Shell>
  );
}
