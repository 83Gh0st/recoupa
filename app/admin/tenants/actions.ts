"use server";

import { z } from "zod";
import { db, schema } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function fail(message: string): never {
  redirect(`/admin/tenants?error=${encodeURIComponent(message)}`);
}

const tenantSchema = z.object({
  name: z.string().min(1).max(150),
  companyEmail: z.string().email().optional().or(z.literal("")),
  companyPhone: z.string().max(40).optional().or(z.literal("")),
  currency: z.string().min(3).max(6).optional().or(z.literal("")),
});

export async function createTenant(formData: FormData) {
  const user = await requireRole(["OWNER"]);
  const parsed = tenantSchema.safeParse({
    name: formData.get("name"),
    companyEmail: formData.get("companyEmail"),
    companyPhone: formData.get("companyPhone"),
    currency: formData.get("currency"),
  });
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  const d = parsed.data;

  const [tenant] = await db
    .insert(schema.tenants)
    .values({
      name: d.name,
      companyEmail: d.companyEmail || null,
      companyPhone: d.companyPhone || null,
      currency: (d.currency || "USD").toUpperCase(),
    })
    .returning();

  // Seed default commission tiers so the new tenant isn't empty of sane defaults.
  await db.insert(schema.commissionTiers).values([
    { tenantId: tenant.id, label: "0–30 days", minDays: 0, maxDays: 30, pct: "4", sortOrder: 1 },
    { tenantId: tenant.id, label: "31–60 days", minDays: 31, maxDays: 60, pct: "8", sortOrder: 2 },
    { tenantId: tenant.id, label: "61–90 days", minDays: 61, maxDays: 90, pct: "12", sortOrder: 3 },
    { tenantId: tenant.id, label: "90+ days", minDays: 91, maxDays: null, pct: "18", sortOrder: 4 },
  ]);

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "TENANT_CREATED",
    entityType: "tenant",
    entityId: tenant.id,
  });

  revalidatePath("/admin/tenants");
  redirect("/admin/tenants?success=Tenant+created");
}

export async function toggleTenantActive(tenantId: string, nextActive: boolean) {
  const user = await requireRole(["OWNER"]);
  if (tenantId === user.tenantId && !nextActive) {
    fail("You cannot deactivate your own tenant.");
  }

  await db.update(schema.tenants).set({ isActive: nextActive }).where(eq(schema.tenants.id, tenantId));

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: nextActive ? "TENANT_ACTIVATED" : "TENANT_DEACTIVATED",
    entityType: "tenant",
    entityId: tenantId,
  });

  revalidatePath("/admin/tenants");
}
