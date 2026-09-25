"use server";

import { z } from "zod";
import { db, schema } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function fail(message: string): never {
  redirect(`/admin/commission?error=${encodeURIComponent(message)}`);
}

const tierSchema = z.object({
  label: z.string().min(1).max(60),
  minDays: z.coerce.number().int().min(0),
  maxDays: z.string().optional().or(z.literal("")),
  pct: z.coerce.number().min(0).max(100),
  sortOrder: z.coerce.number().int().default(0),
});

export async function createTier(formData: FormData) {
  const user = await requireRole(["OWNER", "MANAGER"]);
  const parsed = tierSchema.safeParse({
    label: formData.get("label"),
    minDays: formData.get("minDays"),
    maxDays: formData.get("maxDays"),
    pct: formData.get("pct"),
    sortOrder: formData.get("sortOrder") || 0,
  });
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  const d = parsed.data;

  await db.insert(schema.commissionTiers).values({
    tenantId: user.tenantId,
    label: d.label,
    minDays: d.minDays,
    maxDays: d.maxDays ? Number(d.maxDays) : null,
    pct: String(d.pct),
    sortOrder: d.sortOrder,
  });

  await logAudit({ tenantId: user.tenantId, userId: user.id, action: "COMMISSION_TIER_CREATED", entityType: "commission_tier" });
  revalidatePath("/admin/commission");
  redirect("/admin/commission?success=Tier+added");
}

export async function updateTier(tierId: string, formData: FormData) {
  const user = await requireRole(["OWNER", "MANAGER"]);
  const parsed = tierSchema.safeParse({
    label: formData.get("label"),
    minDays: formData.get("minDays"),
    maxDays: formData.get("maxDays"),
    pct: formData.get("pct"),
    sortOrder: formData.get("sortOrder") || 0,
  });
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  const d = parsed.data;

  await db
    .update(schema.commissionTiers)
    .set({
      label: d.label,
      minDays: d.minDays,
      maxDays: d.maxDays ? Number(d.maxDays) : null,
      pct: String(d.pct),
      sortOrder: d.sortOrder,
    })
    .where(and(eq(schema.commissionTiers.id, tierId), eq(schema.commissionTiers.tenantId, user.tenantId)));

  await logAudit({ tenantId: user.tenantId, userId: user.id, action: "COMMISSION_TIER_UPDATED", entityType: "commission_tier", entityId: tierId });
  revalidatePath("/admin/commission");
  redirect("/admin/commission?success=Tier+saved");
}

export async function deleteTier(tierId: string) {
  const user = await requireRole(["OWNER", "MANAGER"]);
  await db
    .delete(schema.commissionTiers)
    .where(and(eq(schema.commissionTiers.id, tierId), eq(schema.commissionTiers.tenantId, user.tenantId)));
  revalidatePath("/admin/commission");
  redirect("/admin/commission?success=Tier+removed");
}
