import Link from "next/link";
import { getSession } from "@/lib/rbac";
import { Card, Badge, tableClass, thClass, tdClass } from "@/components/ui";

const SECTIONS = [
  { id: "overview", title: "What Recoupa is" },
  { id: "roles", title: "Roles & permissions" },
  { id: "signing-in", title: "Signing in & navigation" },
  { id: "clients", title: "Principal clients" },
  { id: "master-load", title: "Master load (spreadsheet import)" },
  { id: "debtors", title: "Debtors — search, assign, manual leads" },
  { id: "queue", title: "Calling queue" },
  { id: "debtor-profile", title: "Debtor profile" },
  { id: "call-outcomes", title: "Logging a call outcome" },
  { id: "invoices", title: "Adding invoices" },
  { id: "commission", title: "How commission works" },
  { id: "cheques", title: "Cheques & post-dated cheques" },
  { id: "payments", title: "Recording a payment" },
  { id: "corrections", title: "Edits & payment corrections" },
  { id: "documents", title: "Document vault" },
  { id: "disputes", title: "Disputes" },
  { id: "sales-pipeline", title: "Sales pipeline" },
  { id: "sales-import", title: "Import mastersheet (sales)" },
  { id: "prospects", title: "Prospects & outreach" },
  { id: "team", title: "Team (user management)" },
  { id: "tenants", title: "Tenants" },
  { id: "commission-rules", title: "Commission rules" },
  { id: "audit", title: "Audit log" },
  { id: "field-rules", title: "Global field rules" },
  { id: "faq", title: "FAQ & common mistakes" },
  { id: "checklists", title: "Daily checklists" },
];

function H({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 text-lg font-semibold text-slate-900 pt-10 first:pt-0">
      {children}
    </h2>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-sm leading-relaxed text-slate-600">{children}</p>;
}
function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      {children}
    </div>
  );
}

export default async function HandbookPage() {
  const session = await getSession();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 md:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="font-semibold text-brand-dark">Recoupa</Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-400 hidden sm:inline">Operator Handbook</span>
            {session ? (
              <Link href="/dashboard" className="text-brand hover:underline">← Back to app</Link>
            ) : (
              <Link href="/login" className="rounded-md bg-brand px-3 py-1.5 text-white hover:bg-brand-dark transition-colors">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 md:px-8 py-8 grid md:grid-cols-[220px_1fr] gap-10">
        <nav className="hidden md:block sticky top-8 self-start max-h-[calc(100vh-4rem)] overflow-y-auto">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">On this page</div>
          <ul className="space-y-1 text-sm">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-slate-500 hover:text-brand block py-0.5">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 pb-24">
          <h1 className="text-2xl font-semibold text-slate-900">Recoupa Operator Handbook</h1>
          <p className="mt-2 text-sm text-slate-500">
            The complete reference for running collection and sales operations in Recoupa — what
            each screen does, which role can do what, and how the automatic bits (follow-ups,
            commission, statuses) actually work.
          </p>

          <H id="overview">What Recoupa is</H>
          <P>
            Recoupa is a workspace for running two connected books of business for a debt-recovery
            agency:
          </P>
          <ul className="mt-2 list-disc pl-5 text-sm text-slate-600 space-y-1">
            <li><b>Collection</b> — the recovery book. Principal clients hand you overdue invoices
              owed by their customers (debtors). You call debtors, log outcomes, track cheques,
              record payments, and your agency earns a commission on what's collected.</li>
            <li><b>Sales</b> — the new-business book. Prospects come in (imported from a
              spreadsheet or entered by hand), get worked through outreach, and — once signed — get
              converted into a principal client, which then feeds the Collection book.</li>
          </ul>
          <P>
            Every workspace is a <b>tenant</b>: one company's fully isolated data. Every client,
            debtor, invoice, prospect, and login belongs to exactly one tenant, and nobody ever sees
            another tenant's data — enforced on every single query, not just hidden in the menu.
          </P>

          <H id="roles">Roles & permissions</H>
          <P>Your role is shown next to your name in the sidebar. Menu items you can't use are hidden entirely.</P>
          <Card className="mt-3 overflow-x-auto">
            <table className={tableClass}>
              <thead><tr><th className={thClass}>Role</th><th className={thClass}>Shown as</th><th className={thClass}>Can do</th></tr></thead>
              <tbody>
                <tr><td className={tdClass}><code>OWNER</code></td><td className={tdClass}>Owner</td><td className={tdClass}>Everything: create any role, delete clients/debtors/prospects, edit payments directly, manage tenants, full audit log.</td></tr>
                <tr><td className={tdClass}><code>MANAGER</code></td><td className={tdClass}>Operations Manager</td><td className={tdClass}>Run day-to-day ops: clients, master load, assign debtors/prospects, create Collector/Sales users, approve corrections. Can't delete clients or touch Owner/Manager accounts.</td></tr>
                <tr><td className={tdClass}><code>COLLECTOR</code></td><td className={tdClass}>Collector</td><td className={tdClass}>Collection book only, assigned debtors only. Logs calls, records cheques/payments/documents, requests corrections. Can't create clients or users.</td></tr>
                <tr><td className={tdClass}><code>SALES</code></td><td className={tdClass}>Sales Rep</td><td className={tdClass}>Sales book only, own pipeline only. Logs outreach. Can't see debtors, payments, or the collection ledger.</td></tr>
                <tr><td className={tdClass}><code>CLIENT</code></td><td className={tdClass}>Client Portal</td><td className={tdClass}>Read-oriented view of their own portfolio (Principal Clients + Disputes only). No calling queue, no user admin.</td></tr>
              </tbody>
            </table>
          </Card>
          <Note>
            Every mutation is re-checked server-side regardless of what the sidebar shows. If an
            action isn't allowed for your role, the server simply refuses it.
          </Note>

          <H id="signing-in">Signing in & navigation</H>
          <P>
            Sign in with the email and password your Owner or Manager gave you. There's no
            self-registration — accounts are created under <b>Team</b>. An inactive account, or an
            account on a deactivated tenant, can't sign in at all.
          </P>
          <P>
            The sidebar is grouped: <b>Overview</b> (Dashboard), <b>Collection</b> (Calling Queue,
            Debtors, Disputes, Principal Clients, Payment Corrections), <b>Sales</b> (Pipeline,
            Outreach Queue, Prospects, Import Sheet), and <b>Admin</b> (Team, Tenants, Commission
            Rules, Audit Log) — each item only shown to roles allowed to open it.
          </P>

          <H id="clients">Principal clients</H>
          <P>
            These are the companies who hired your agency to recover money — not the companies who
            owe it. Owner/Manager create them with a name, optional contact details, and a
            <b> default recovery commission %</b> (starting at 10%, editable per client) that new
            invoices inherit unless overridden.
          </P>
          <P>
            The list shows live rollups — debtor count, invoice count, receivable, and balance —
            computed straight from the invoices table, so they're always in sync. Only an Owner can
            delete a client, and doing so removes every debtor, invoice, and call log under it.
          </P>

          <H id="master-load">Master load (spreadsheet import)</H>
          <P>
            From a client's row, Owner/Manager can upload a debtor + invoice spreadsheet
            (<code>.xlsx</code>, <code>.xls</code>, <code>.csv</code>). Headers are matched loosely
            — case and punctuation don't matter, and the header row can be anywhere in the first six
            rows. Recognized columns:
          </P>
          <Card className="mt-3 overflow-x-auto">
            <table className={tableClass}>
              <thead><tr><th className={thClass}>Column (any of)</th><th className={thClass}>Required?</th></tr></thead>
              <tbody>
                <tr><td className={tdClass}>Debtor / Debtor name / Customer / Company name / Firm name / Name</td><td className={tdClass}>Required</td></tr>
                <tr><td className={tdClass}>Phone / Mobile / Telephone / Contact</td><td className={tdClass}>Required</td></tr>
                <tr><td className={tdClass}>Invoice / Invoice number / Inv</td><td className={tdClass}>Required, unique per client</td></tr>
                <tr><td className={tdClass}>Invoice date / Bill date</td><td className={tdClass}>Required</td></tr>
                <tr><td className={tdClass}>Amount / Invoice amount / Total amount</td><td className={tdClass}>Required, &gt; 0</td></tr>
                <tr><td className={tdClass}>Due date / Maturity date / Payment due</td><td className={tdClass}>Optional — defaults to invoice date</td></tr>
                <tr><td className={tdClass}>Outstanding / Balance / Overdue</td><td className={tdClass}>Optional — defaults to the full amount</td></tr>
                <tr><td className={tdClass}>Collected / Paid</td><td className={tdClass}>Optional</td></tr>
                <tr><td className={tdClass}>Commission / Comm % / Commission %</td><td className={tdClass}>Optional — defaults to the client's %</td></tr>
                <tr><td className={tdClass}>Contact person, Trade license, City, Alt phone</td><td className={tdClass}>Optional</td></tr>
              </tbody>
            </table>
          </Card>
          <P>
            One row = one invoice — repeat the debtor's name and phone on every line for that
            debtor. Click <b>Validate (dry run)</b> first: it reports valid / duplicate / errored
            row counts without writing anything. Only once you're happy, click <b>Commit N valid
            row(s)</b>. A debtor is matched to an existing one by phone number within that client;
            duplicate invoice numbers (in the file or already in the system) are always skipped.
          </P>

          <H id="debtors">Debtors — search, assign, manual leads</H>
          <P>
            Filter by search text, status, client, and (for Owner/Manager) agent, including
            "Unassigned only" to find debtors nobody's working yet. Collectors only ever see their
            own assigned book here and in the queue.
          </P>
          <P>
            Owner/Manager can also add a debtor by hand for a quick lead — but a manual lead has no
            invoices yet, so nothing is owed until you add one (or run Master Load). Payments always
            apply against a real invoice, never a lead total, so add the invoice before a collector
            tries to receipt money.
          </P>

          <H id="queue">Calling queue</H>
          <P>
            The collector's prioritized worklist: every active assigned debtor (not Declined, not
            Resolved), grouped into <b>Overdue — call now</b>, <b>Due today</b>, <b>Upcoming</b>, and
            <b> No follow-up scheduled</b>, sorted by follow-up date. Managers see the same grouping
            across every collector's book. An empty queue means nothing is assigned to you, or every
            assigned file is closed.
          </P>

          <H id="debtor-profile">Debtor profile</H>
          <P>
            Everything about one debtor lives on one page: summary tiles (total overdue, collected,
            remaining, next follow-up), the statement of account, cheques and payments side by side,
            the document vault, the call-logging form, and full call history — in that order, top to
            bottom.
          </P>

          <H id="call-outcomes">Logging a call outcome</H>
          <P>
            Every contact gets logged here — notes are required (up to 4,000 characters). Saving
            updates the debtor's status and automatically schedules the next follow-up:
          </P>
          <Card className="mt-3 overflow-x-auto">
            <table className={tableClass}>
              <thead><tr><th className={thClass}>Disposition</th><th className={thClass}>Meaning</th><th className={thClass}>Auto next follow-up</th></tr></thead>
              <tbody>
                <tr><td className={tdClass}><Badge value="OPEN" /></td><td className={tdClass}>Still working the file, no promise yet</td><td className={tdClass}>In 2 days</td></tr>
                <tr><td className={tdClass}><Badge value="PROMISED" /></td><td className={tdClass}>Promise to pay</td><td className={tdClass}>On the promised date (or +3 days if none given)</td></tr>
                <tr><td className={tdClass}><Badge value="DISPUTED" /></td><td className={tdClass}>Commercial dispute — also lands on Disputes</td><td className={tdClass}>In 3 days</td></tr>
                <tr><td className={tdClass}><Badge value="NO_ANSWER" /></td><td className={tdClass}>No answer / ringing out</td><td className={tdClass}>Tomorrow</td></tr>
                <tr><td className={tdClass}><Badge value="DECLINED" /></td><td className={tdClass}>Not proceeding / refuses to engage</td><td className={tdClass}>None — leaves the queue</td></tr>
                <tr><td className={tdClass}><Badge value="RESOLVED" /></td><td className={tdClass}>Account settled</td><td className={tdClass}>None — leaves the queue</td></tr>
              </tbody>
            </table>
          </Card>
          <Note>
            Don't mark a file <b>Resolved</b> as a shortcut. Record the actual payment first — the
            invoice's outstanding balance should already be at zero before you close the file.
          </Note>

          <H id="invoices">Adding invoices</H>
          <P>
            Owner/Manager can add one or more invoices from a debtor's profile. Enter the invoice
            number (unique per client), amount, invoice date, and due date. The commission % field
            pre-fills automatically from the ageing tier that matches how old the invoice already
            is — you can still edit it per invoice before saving, or click the field again to
            re-suggest it.
          </P>

          <H id="commission">How commission works</H>
          <P>
            Commission % lives on the <i>invoice</i>, not on the client or the ledger overall — it's
            inherited from the client's default, overridable per invoice, and overridable again by a
            Commission column in a spreadsheet import. When a payment is recorded, <code>commission
            = payment amount × that invoice's commission %</code>, computed once at the moment the
            payment is saved.
          </P>

          <H id="cheques">Cheques & post-dated cheques</H>
          <P>
            Record a cheque as either <b>Post-dated (PDC)</b> or <b>Current-date</b>, with its
            number, bank, amount, cheque date, and — for PDCs — a maturity date. The Dashboard
            surfaces every PDC maturing within 7 days as an alert. Status moves through
            <b> Pending → Deposited → Cleared</b> (or <b>Bounced</b>). A cheque on its own is not a
            payment — recording the actual payment (optionally linked to that cheque, which marks it
            Cleared automatically) is what moves the balance.
          </P>

          <H id="payments">Recording a payment</H>
          <P>
            Pick an invoice with an outstanding balance greater than zero, an amount (can't exceed
            what's left on that invoice), a method, and optionally a cheque to link. Commission is
            calculated automatically from that invoice's %. The invoice status becomes
            <b> Partial</b> or <b>Settled</b> depending on whether anything is left.
          </P>

          <H id="corrections">Edits & payment corrections</H>
          <P>
            Owner/Manager can edit a payment's amount directly from the debtor profile — balance and
            commission recalculate immediately, and it's captured in the audit log. Collectors don't
            get a direct edit button: instead they <b>Request a correction</b> (proposed amount +
            reason), which lands on the <b>Payment Corrections</b> page for a Manager or Owner to
            <b> Approve</b> (applies the new amount) or <b>Reject</b>. Never record a second payment
            to "fix" a mistaken one.
          </P>

          <H id="documents">Document vault</H>
          <P>
            Attach a document to a debtor (and optionally a specific invoice) with a type — Invoice,
            Contract, Correspondence, Supporting, Cheque copy, Delivery note, Purchase order, ID
            document, or Other. If real file storage isn't wired up on your deployment, log a file
            name / reference instead so the paper trail isn't lost.
          </P>

          <H id="disputes">Disputes</H>
          <P>
            Every debtor currently in <Badge value="DISPUTED" /> status shows up here with its
            reason — <b>Pricing discrepancy</b>, <b>Missing POD / invoice</b>, or <b>Damaged
            goods</b> — so it can be worked as a queue of its own. Client Portal logins see this page
            read-only, scoped to their own portfolio.
          </P>

          <H id="sales-pipeline">Sales pipeline</H>
          <P>
            The Sales overview: active prospects, follow-ups due today, converted count, and total
            pipeline, plus a status breakdown and a feed of recent outreach. Sales Reps see only
            their own numbers; Owner/Manager see the whole book.
          </P>

          <H id="sales-import">Import mastersheet (sales)</H>
          <P>
            Owner/Manager upload a workbook of prospects — every sheet is read, and the sheet name
            is stored as the row's source. Recognized columns: Firm/Company/Client name/Name,
            Contact person/POC (a bare "Contact" column is treated as a phone number), Telephone/
            Mobile/Phone, Email, Website/URL, Address/Location, Remarks/Notes. A row needs a firm (or
            contact) name plus at least one way to reach them. <b>Preview</b> first, then
            <b> Import</b> — optionally skipping firms that already exist, and optionally assigning
            every imported row to one rep.
          </P>

          <H id="prospects">Prospects & outreach</H>
          <P>
            Log outreach with a channel (Call, Email, In person, WhatsApp) and a disposition; notes
            are required. Follow-up auto-schedules by disposition — No answer (+1 day), Contacted /
            interested (+2), Follow-up / negotiation (+3), Proposal sent (+5), Meeting scheduled
            (+7, or set the real meeting date as an override) — or leaves the queue entirely on Not
            interested. When a deal is signed, Owner/Manager click <b>Convert to client</b>, which
            creates the Principal Client record and drops straight into its Master Load screen so
            you can load the debtor invoices immediately.
          </P>

          <H id="team">Team (user management)</H>
          <P>
            Owner can create any role; Manager can create Collector or Sales accounts only. A Client
            Portal account must be linked to exactly one principal client — that's the only
            portfolio it will ever see. Owner can change anyone's role (except their own) and
            activate/deactivate any account (except their own); Manager can only activate/deactivate
            Collector, Sales, and Client Portal accounts.
          </P>

          <H id="tenants">Tenants</H>
          <P>
            Each tenant is one company's fully isolated workspace. Owner can create a new tenant
            (it starts empty, with sane default commission tiers, ready for you to add its first
            users) and deactivate a tenant — which immediately blocks every one of its users from
            signing in. You can't deactivate your own tenant.
          </P>

          <H id="commission-rules">Commission rules</H>
          <P>
            Set the suggested commission % per ageing bucket (by minimum/maximum days past due).
            Leave the max blank for the final open-ended bucket. Changing a tier only affects
            invoices added <i>after</i> the change — existing invoices keep whatever % they were
            given.
          </P>

          <H id="audit">Audit log</H>
          <P>
            Every meaningful action — logins aside — is recorded here: who did what, to which
            record, and when. Treat it as the source of truth when reconciling a disagreement about
            who changed something.
          </P>

          <H id="field-rules">Global field rules</H>
          <ul className="mt-2 list-disc pl-5 text-sm text-slate-600 space-y-1">
            <li>All money is two-decimal, never negative.</li>
            <li>Commission % is between 0 and 100.</li>
            <li>Required text fields can't be just blank spaces.</li>
            <li>An invoice number must be unique per principal client.</li>
            <li>Notes on a call outcome are always required — write enough that a colleague could pick up the file cold.</li>
          </ul>

          <H id="faq">FAQ & common mistakes</H>
          <div className="mt-2 space-y-3 text-sm">
            <div><b className="text-slate-800">Queue is empty.</b><P>The debtor is unassigned, assigned to someone else, or already Declined/Resolved. Managers: filter Debtors by "Unassigned only" and assign.</P></div>
            <div><b className="text-slate-800">Can't record a payment.</b><P>No invoice with an outstanding balance exists yet. Add an invoice, or run Master Load, first.</P></div>
            <div><b className="text-slate-800">Import says no rows found.</b><P>Fix the header row — it needs to be recognizable within the first six rows, with debtor/firm name plus the other required columns.</P></div>
            <div><b className="text-slate-800">"You do not have permission…"</b><P>Your role can't do that action. Ask an Owner or Manager, or use the right account.</P></div>
            <div><b className="text-slate-800">Cheque bounced.</b><P>Set its status to Bounced — do not record a payment against it. Log the call as Open or Promised instead and keep the paperwork.</P></div>
          </div>

          <H id="checklists">Daily checklists</H>
          <div className="mt-3 grid md:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="font-medium text-sm text-slate-800 mb-2">Collector</div>
              <ul className="text-sm text-slate-600 list-disc pl-4 space-y-1">
                <li>Check the Dashboard for follow-ups due and PDC alerts</li>
                <li>Work the queue — Overdue, then Due today</li>
                <li>Log every attempt with real notes</li>
                <li>Record the cheque, then the payment, same day money arrives</li>
                <li>Request a correction — never double-post</li>
              </ul>
            </Card>
            <Card className="p-4">
              <div className="font-medium text-sm text-slate-800 mb-2">Operations Manager</div>
              <ul className="text-sm text-slate-600 list-disc pl-4 space-y-1">
                <li>Set up new clients and their commission %</li>
                <li>Validate, then commit Master Load</li>
                <li>Assign unassigned debtors</li>
                <li>Review Disputes and Payment Corrections daily</li>
                <li>Preview, import, assign, and convert sales wins</li>
              </ul>
            </Card>
            <Card className="p-4">
              <div className="font-medium text-sm text-slate-800 mb-2">Sales Rep</div>
              <ul className="text-sm text-slate-600 list-disc pl-4 space-y-1">
                <li>Outreach Queue first</li>
                <li>Log channel + disposition + notes every time</li>
                <li>Override the follow-up date for real booked meetings</li>
                <li>Ask a manager to convert once a deal is signed</li>
              </ul>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
