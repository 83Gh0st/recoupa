# Recoupa

A multi-tenant debt-recovery and sales-pipeline workspace: principal clients → debtors → invoices,
a prioritized calling queue with call outcomes and auto-scheduled follow-ups, cheque/PDC tracking,
payments with ageing-based commission calculation, disputes, payment corrections, a separate sales
pipeline (prospects → outreach → conversion to client), spreadsheet import for both books, role-based
access, and an audit trail.

This is an original implementation — its own schema, naming, copy, and code — built to be
functionally comparable to a class of software (agency debt-collection + sales CRMs), not a copy of
any specific product's text or design.

## Stack (all free-tier to start)

| Layer | Choice | Why |
|---|---|---|
| App | Next.js 16 (App Router, TypeScript) | one codebase for UI + API, deploys free on Vercel |
| DB | PostgreSQL via [Neon](https://neon.tech) | serverless Postgres, generous permanent free tier, pairs natively with Vercel |
| ORM | [Drizzle](https://orm.drizzle.team) | typed schema + migrations, no native binary — works in any serverless runtime |
| Auth | NextAuth (Credentials + JWT) | email/password, bcrypt-hashed, role + tenant baked into the session |
| Styling | Tailwind CSS v4 | no external font/CDN dependency, fast to iterate |
| Spreadsheet import | `xlsx` (SheetJS) | reads `.xlsx` / `.xls` / `.csv`, fuzzy header matching |

Nothing here requires a paid plan to run a real pilot. When you outgrow the free tiers, Neon and
Vercel both scale up on the same codebase — no migration needed.

## 1. Local setup

```bash
npm install --legacy-peer-deps   # a known npm/arborist bug needs this flag on some npm versions
cp .env.example .env.local
```

Create a free Postgres database at [neon.tech](https://neon.tech) (no credit card required), copy
its connection string into `DATABASE_URL` in `.env.local`, and generate a random `NEXTAUTH_SECRET`:

```bash
openssl rand -base64 32
```

Push the schema and seed demo data:

```bash
npm run db:push     # creates every table from lib/db/schema.ts
npm run seed         # one demo tenant, one login per role, a sample client/debtor/invoice
```

Then:

```bash
npm run dev
```

Open http://localhost:3000 and sign in with any of the seeded accounts (see the console output from
`npm run seed` — all share the password `password123`). **Change or remove these before going to
production.**

## 2. Deploying for free

1. Push this project to a GitHub repo.
2. Create a Neon project (if you haven't already) for production — keep it separate from any local/dev database.
3. Import the repo into [Vercel](https://vercel.com) (free Hobby plan).
4. In Vercel's project settings → Environment Variables, add `DATABASE_URL`, `NEXTAUTH_SECRET`, and
   `NEXTAUTH_URL` (your Vercel URL, e.g. `https://your-app.vercel.app`).
5. Deploy. On the first deploy, run the schema push once against the production database — either
   locally with `DATABASE_URL` pointed at production, or by wiring `db:push`/`db:migrate` into a
   one-off Vercel deploy step.
6. Run `npm run seed` once against production (or skip it and create your real tenant/users by hand
   through the app once you have one Owner account — see "Bootstrapping the first account" below).

Both Neon and Vercel's free tiers are meant for exactly this: a real, working pilot at zero cost,
scaling up later on the same setup.

### Bootstrapping the first account

The seed script is the easy path. If you'd rather not run it against production, insert one row by
hand (via `npm run db:studio`, which opens Drizzle's local DB browser): one `tenants` row, then one
`users` row with `role = 'OWNER'` and a bcrypt hash of your chosen password
(`node -e "console.log(require('bcryptjs').hashSync('yourpassword', 10))"`). From there, sign in and
create every other user through **Team**.

## 3. What's deliberately simplified vs. a full production system

These are honest tradeoffs made to ship a complete, working system across every module rather than a
deep implementation of only one or two:

- **File storage isn't wired up.** The Documents module stores a file name/reference and notes, not
  actual uploaded bytes — same as the source spec's "or type a file name/reference if the paper is
  stored elsewhere" option. To add real uploads: [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)
  or [Supabase Storage](https://supabase.com/storage) both have free tiers and a handful of lines of
  integration in `app/debtors/actions.ts`'s `addDocument`.
- **Tenant isolation is enforced in application code** (every query filters by `tenantId` from the
  session), not database-level Postgres Row-Level Security. That's a legitimate, common pattern for
  this scale, but RLS is a worthwhile hardening step before handling real customer data at scale.
- **Commission recalculation on a payment correction** recomputes that one payment's commission at
  the invoice's *current* commission %; it doesn't cascade-recalculate every historical payment on an
  invoice if you edit the invoice's commission % after the fact. Rare edge case, noted rather than
  built out.
- **The "Tenants" admin page lists every tenant** on the deployment (useful if you're running this
  for multiple agencies from one instance) rather than being scoped like everything else. Every other
  page is strictly scoped to the signed-in user's own tenant.
- **No automated tests yet.** Given the scope, priority went to a working, complete feature set.
  Adding Vitest/Playwright is a natural next step.

## 4. Project structure

```
lib/db/schema.ts        Full data model (Drizzle) — start here to understand the domain
lib/rbac.ts              Role/permission matrix + server-side guards
lib/commission.ts        Ageing-tier commission lookup
lib/followup.ts          Auto follow-up scheduling (both books)
lib/import/               Spreadsheet parsing for master load + sales mastersheet
app/(each module)/        page.tsx (server component) + actions.ts (server actions)
app/api/                  Two file-upload endpoints (import can't be a server action)
components/               Shell (nav), ui.tsx (shared primitives)
scripts/seed.ts           Demo data
```

Every mutation goes through a server action or API route that re-checks the role server-side
(`requireRole`/`requireArea` in `lib/rbac.ts`) — the sidebar hiding a link is a UX nicety, not the
security boundary.
