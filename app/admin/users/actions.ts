"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function fail(message: string): never {
  redirect(`/admin/users?error=${encodeURIComponent(message)}`);
}

const MANAGER_CREATABLE_ROLES = ["COLLECTOR", "SALES"];
const ALL_ROLES = ["OWNER", "MANAGER", "COLLECTOR", "SALES", "CLIENT"];

const userSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["OWNER", "MANAGER", "COLLECTOR", "SALES", "CLIENT"]),
  principalClientId: z.string().uuid().optional().or(z.literal("")),
});

export async function createUser(formData: FormData) {
  const actor = await requireUser();
  if (actor.role !== "OWNER" && actor.role !== "MANAGER") fail("You do not have permission to perform this action.");

  const parsed = userSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
    principalClientId: formData.get("principalClientId"),
  });
  if (!parsed.success) fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  const d = parsed.data;

  if (actor.role === "MANAGER" && !MANAGER_CREATABLE_ROLES.includes(d.role)) {
    fail("Operations Managers can only create Collector or Sales accounts.");
  }
  if (d.role === "CLIENT" && !d.principalClientId) {
    fail("Pick which principal client this Client Portal login can view.");
  }

  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, d.email.toLowerCase())).limit(1);
  if (existing) fail("That email is already in use.");

  const passwordHash = await bcrypt.hash(d.password, 10);

  const [created] = await db
    .insert(schema.users)
    .values({
      tenantId: actor.tenantId,
      name: d.name,
      email: d.email.toLowerCase().trim(),
      passwordHash,
      role: d.role,
      principalClientId: d.role === "CLIENT" ? d.principalClientId || null : null,
    })
    .returning();

  await logAudit({
    tenantId: actor.tenantId,
    userId: actor.id,
    action: "USER_CREATED",
    entityType: "user",
    entityId: created.id,
    detail: { role: d.role },
  });

  revalidatePath("/admin/users");
  redirect("/admin/users?success=User+created");
}

export async function changeRole(userId: string, formData: FormData) {
  const actor = await requireUser();
  if (actor.role !== "OWNER") fail("Only the Owner can change roles.");
  if (userId === actor.id) fail("You cannot change your own role.");

  const role = String(formData.get("role"));
  if (!ALL_ROLES.includes(role)) fail("Invalid role.");

  await db
    .update(schema.users)
    .set({ role: role as any })
    .where(and(eq(schema.users.id, userId), eq(schema.users.tenantId, actor.tenantId)));

  await logAudit({
    tenantId: actor.tenantId,
    userId: actor.id,
    action: "USER_ROLE_CHANGED",
    entityType: "user",
    entityId: userId,
    detail: { role },
  });

  revalidatePath("/admin/users");
  redirect("/admin/users?success=Role+updated");
}

export async function toggleActive(userId: string, nextActive: boolean) {
  const actor = await requireUser();
  if (actor.role !== "OWNER" && actor.role !== "MANAGER") fail("You do not have permission to perform this action.");
  if (userId === actor.id) fail("You cannot deactivate your own account.");

  const [target] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  if (!target || target.tenantId !== actor.tenantId) fail("User not found.");
  if (actor.role === "MANAGER" && target.role !== "COLLECTOR" && target.role !== "SALES" && target.role !== "CLIENT") {
    fail("Operations Managers can only activate/deactivate Collector, Sales, or Client Portal accounts.");
  }

  await db.update(schema.users).set({ isActive: nextActive }).where(eq(schema.users.id, userId));

  await logAudit({
    tenantId: actor.tenantId,
    userId: actor.id,
    action: nextActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
    entityType: "user",
    entityId: userId,
  });

  revalidatePath("/admin/users");
}
