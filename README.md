![Recoupa Debtor Profile](./debtor-profile.png)
# Recoupa

A workspace for running a debt collection agency: the debtors you're chasing, the invoices behind them, the calls you make, the cheques and payments that come in, and the commission your agency earns on top of it. There's a second, smaller book for sales too: prospects, outreach, and converting a signed deal into a real client.

I built this after looking at how these agencies actually run their day (a lot of spreadsheets, a lot of "who called this guy last"), and wanted to see what it looks like as a proper multi-tenant app instead. Two roles do the calling and closing, two roles manage the operation, and one role lets the client peek at their own numbers without touching anything.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue) ![Postgres](https://img.shields.io/badge/Postgres-Neon-336791) ![Drizzle](https://img.shields.io/badge/ORM-Drizzle-c5f74f)

## What it actually does

**Collection side**
- Principal clients (the companies who hired you) → debtors (who owe them) → invoices
- A calling queue that sorts itself into overdue, due today, upcoming, and unscheduled
- Call logging with required notes, and the next follow-up date gets set automatically based on what happened on the call
- Cheque and post-dated cheque tracking, with maturity alerts on the dashboard
- Payments that calculate commission on the spot, based on how old the invoice is
- A disputes queue, and a proper approval flow for correcting a payment someone entered wrong
- Spreadsheet import for loading a whole portfolio at once, with a dry run before anything gets committed

**Sales side**
- Prospects imported from a spreadsheet or added by hand
- An outreach queue that works the same way the calling queue does
- Logged outreach with auto-scheduled follow-ups
- One click to convert a won prospect into a real client, which drops you straight into loading their invoices

**Underneath both**
- Five roles (Owner, Operations Manager, Collector, Sales Rep, Client Portal), each seeing only what they should, checked server-side on every request, not just hidden in a menu
- Full multi-tenancy, every table scoped by tenant, so one deployment can run several agencies with zero data leaking between them
- An audit log of who did what and when
- An in-app operator handbook at `/handbook` documenting all of it


![Recoupa Dashboard](./dashboard.png)

## Stack

Next.js 16 with the App Router, TypeScript, Tailwind. Postgres through Neon, queried with Drizzle. Auth is NextAuth with credentials and a JWT session carrying the role and tenant. Spreadsheet parsing runs on `xlsx`. The landing page uses Framer Motion for the scroll animations and Lucide for icons.


## Running it locally

```bash
npm install --legacy-peer-deps
cp .env.example .env.local
```

Grab a free Postgres database at [neon.tech](https://neon.tech), drop the connection string into `DATABASE_URL`, and generate a secret for NextAuth:

```bash
openssl rand -base64 32
```

Then push the schema and seed some demo data:

```bash
npm run db:push
npm run seed
```

`npm run seed` prints five logins when it's done, one per role, all sharing the same password. Sign in with any of them after running:

```bash
npm run dev
```



## How it's organized

```
lib/db/schema.ts     the whole data model, start here if you want to understand the domain
lib/rbac.ts           role and permission checks, used server-side on every action
lib/commission.ts     ageing tier lookup for commission percentage
lib/followup.ts       auto follow-up scheduling for both books
lib/import/           spreadsheet parsing for master load and the sales mastersheet
app/*/actions.ts       server actions, each one re-checks the role before doing anything
scripts/seed.ts       demo data
```
