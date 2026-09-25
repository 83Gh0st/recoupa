import "dotenv/config";
import bcrypt from "bcryptjs";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { eq } from "drizzle-orm";
import * as schema from "../lib/db/schema";

neonConfig.webSocketConstructor = ws;

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local first.");
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  console.log("Seeding…");

  // Idempotent: if a previous run got partway through (e.g. a network blip),
  // clear it out first so this is always safe to re-run. Cascades to every
  // child row (users, clients, debtors, invoices, etc.) via the FK on tenantId.
  const [existing] = await db
    .select({ id: schema.tenants.id })
    .from(schema.tenants)
    .where(eq(schema.tenants.name, "Demo Recovery Agency"))
    .limit(1);
  if (existing) {
    console.log("Found a previous demo tenant — clearing it out first…");
    await db.delete(schema.tenants).where(eq(schema.tenants.id, existing.id));
  }

  const [tenant] = await db
    .insert(schema.tenants)
    .values({ name: "Demo Recovery Agency", currency: "USD" })
    .returning();

  await db.insert(schema.commissionTiers).values([
    { tenantId: tenant.id, label: "0–30 days", minDays: 0, maxDays: 30, pct: "4", sortOrder: 1 },
    { tenantId: tenant.id, label: "31–60 days", minDays: 31, maxDays: 60, pct: "8", sortOrder: 2 },
    { tenantId: tenant.id, label: "61–90 days", minDays: 61, maxDays: 90, pct: "12", sortOrder: 3 },
    { tenantId: tenant.id, label: "90+ days", minDays: 91, maxDays: null, pct: "18", sortOrder: 4 },
  ]);

  const password = "password123";
  const passwordHash = await bcrypt.hash(password, 10);

  const [owner] = await db
    .insert(schema.users)
    .values({ tenantId: tenant.id, name: "Owner Account", email: "owner@demo.com", passwordHash, role: "OWNER" })
    .returning();
  await db.insert(schema.users).values({
    tenantId: tenant.id, name: "Ops Manager", email: "manager@demo.com", passwordHash, role: "MANAGER",
  });
  const [collector] = await db
    .insert(schema.users)
    .values({ tenantId: tenant.id, name: "Collector One", email: "collector@demo.com", passwordHash, role: "COLLECTOR" })
    .returning();
  await db.insert(schema.users).values({
    tenantId: tenant.id, name: "Sales Rep One", email: "sales@demo.com", passwordHash, role: "SALES",
  });

  const [client] = await db
    .insert(schema.principalClients)
    .values({ tenantId: tenant.id, name: "Sample Principal Client Inc.", commissionPct: "10", contactPerson: "Jordan Lee" })
    .returning();

  await db.insert(schema.users).values({
    tenantId: tenant.id, name: "Client Portal Login", email: "client@demo.com", passwordHash, role: "CLIENT",
    principalClientId: client.id,
  });

  const [debtor] = await db
    .insert(schema.debtors)
    .values({
      tenantId: tenant.id,
      clientId: client.id,
      name: "Sample Debtor LLC",
      phone: "+1 555 0100",
      assignedUserId: collector.id,
      city: "Springfield",
    })
    .returning();

  await db.insert(schema.invoices).values({
    tenantId: tenant.id,
    debtorId: debtor.id,
    clientId: client.id,
    invoiceNumber: "INV-1001",
    invoiceDate: new Date(Date.now() - 45 * 86_400_000),
    dueDate: new Date(Date.now() - 15 * 86_400_000),
    amount: "5000.00",
    outstanding: "5000.00",
    commissionPct: "8",
    status: "OPEN",
  });

  console.log("");
  console.log("Seed complete. Sign in with any of:");
  console.log("  owner@demo.com / manager@demo.com / collector@demo.com / sales@demo.com / client@demo.com");
  console.log(`  password: ${password}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
