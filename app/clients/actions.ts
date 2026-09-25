"use server";

import { z } from "zod";
import { db, schema } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const clientSchema = z.object({
  name: z.string().min(1, "Company name is required").max(150),
  tradeLicenseNo: z.string().max(100).optional().or(z.literal("")),
  contactPerson: z.string().max(150).optional().or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  commissionPct: z.coerce.number().min(0).max(100),
});

function readClientForm(formData: FormData) {
  return clientSchema.safeParse({
    name: formData.get("name"),
    tradeLicenseNo: formData.get("tradeLicenseNo"),
    contactPerson: formData.get("contactPerson"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    commissionPct: formData.get("commissionPct") || 10,
  });
}

export async function createClient(formData: FormData) {
  const user = await requireRole(["OWNER", "MANAGER"]);
  const parsed = readClientForm(formData);
  if (!parsed.success) {
    redirect(`/clients?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input.")}`);
  }
  const data = parsed.data;

  const [created] = await db
    .insert(schema.principalClients)
    .values({
      tenantId: user.tenantId,
      name: data.name,
      tradeLicenseNo: data.tradeLicenseNo || null,
      contactPerson: data.contactPerson || null,
      email: data.email || null,
      phone: data.phone || null,
      commissionPct: String(data.commissionPct),
    })
    .returning();

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "CLIENT_CREATED",
    entityType: "principal_client",
    entityId: created.id,
    detail: { name: created.name },
  });

  revalidatePath("/clients");
  redirect("/clients?success=Client+created");
}

export async function updateClient(id: string, formData: FormData) {
  const user = await requireRole(["OWNER", "MANAGER"]);
  const parsed = readClientForm(formData);
  if (!parsed.success) {
    redirect(`/clients?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input.")}`);
  }
  const data = parsed.data;

  await db
    .update(schema.principalClients)
    .set({
      name: data.name,
      tradeLicenseNo: data.tradeLicenseNo || null,
      contactPerson: data.contactPerson || null,
      email: data.email || null,
      phone: data.phone || null,
      commissionPct: String(data.commissionPct),
    })
    .where(eq(schema.principalClients.id, id));

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "CLIENT_UPDATED",
    entityType: "principal_client",
    entityId: id,
  });

  revalidatePath("/clients");
  redirect("/clients?success=Client+updated");
}

export async function deleteClient(id: string) {
  const user = await requireRole(["OWNER"]);
  await db.delete(schema.principalClients).where(eq(schema.principalClients.id, id));
  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "CLIENT_DELETED",
    entityType: "principal_client",
    entityId: id,
  });
  revalidatePath("/clients");
  redirect("/clients?success=Client+deleted");
}
