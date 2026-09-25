"use server";

import { z } from "zod";
import { db, schema } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { nextProspectFollowUp } from "@/lib/followup";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

const prospectSchema = z.object({
  firmName: z.string().min(1).max(200),
  contactPerson: z.string().max(150).optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().max(200).optional().or(z.literal("")),
  address: z.string().max(300).optional().or(z.literal("")),
  assignedUserId: z.string().uuid().optional().or(z.literal("")),
  nextFollowUpAt: z.string().optional().or(z.literal("")),
});

export async function createProspect(formData: FormData) {
  const user = await requireRole(["OWNER", "MANAGER"]);
  const parsed = prospectSchema.safeParse({
    firmName: formData.get("firmName"),
    contactPerson: formData.get("contactPerson"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    website: formData.get("website"),
    address: formData.get("address"),
    assignedUserId: formData.get("assignedUserId"),
    nextFollowUpAt: formData.get("nextFollowUpAt"),
  });
  if (!parsed.success) fail("/sales/prospects", parsed.error.issues[0]?.message ?? "Invalid input.");
  const d = parsed.data;

  if (!d.phone && !d.email && !d.website && !d.address) {
    fail("/sales/prospects", "Enter at least one way to reach them (phone, email, website, or address).");
  }

  const [created] = await db
    .insert(schema.prospects)
    .values({
      tenantId: user.tenantId,
      firmName: d.firmName,
      contactPerson: d.contactPerson || null,
      phone: d.phone || null,
      email: d.email || null,
      website: d.website || null,
      address: d.address || null,
      assignedUserId: d.assignedUserId || null,
      nextFollowUpAt: d.nextFollowUpAt ? new Date(d.nextFollowUpAt) : null,
      sourceSheet: "Manual",
    })
    .returning();

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "PROSPECT_CREATED",
    entityType: "prospect",
    entityId: created.id,
  });

  revalidatePath("/sales/prospects");
  redirect(`/sales/prospects/${created.id}`);
}

export async function assignProspect(prospectId: string, userId: string) {
  const user = await requireRole(["OWNER", "MANAGER"]);
  await db
    .update(schema.prospects)
    .set({ assignedUserId: userId || null })
    .where(and(eq(schema.prospects.id, prospectId), eq(schema.prospects.tenantId, user.tenantId)));
  revalidatePath("/sales/prospects");
}

const outreachSchema = z.object({
  channel: z.enum(["CALL", "EMAIL", "IN_PERSON", "WHATSAPP"]),
  disposition: z.enum([
    "NEW", "NO_ANSWER", "ENGAGED", "NEGOTIATING", "PROPOSAL_SENT", "MEETING_SET", "LOST", "CONVERTED",
  ]),
  personContacted: z.string().max(150).optional().or(z.literal("")),
  overrideFollowUp: z.string().optional().or(z.literal("")),
  notes: z.string().min(1, "Notes are required").max(4000),
});

export async function logOutreach(prospectId: string, formData: FormData) {
  const user = await requireUser();
  const parsed = outreachSchema.safeParse({
    channel: formData.get("channel"),
    disposition: formData.get("disposition"),
    personContacted: formData.get("personContacted"),
    overrideFollowUp: formData.get("overrideFollowUp"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) fail(`/sales/prospects/${prospectId}`, parsed.error.issues[0]?.message ?? "Invalid input.");
  const d = parsed.data;

  if (d.disposition === "CONVERTED") {
    fail(`/sales/prospects/${prospectId}`, "Use the Convert to client button, not a disposition, to convert a prospect.");
  }

  await db.insert(schema.outreachLogs).values({
    tenantId: user.tenantId,
    prospectId,
    userId: user.id,
    channel: d.channel,
    disposition: d.disposition,
    personContacted: d.personContacted || null,
    notes: d.notes,
  });

  const nextFollowUp = nextProspectFollowUp(
    d.disposition,
    d.overrideFollowUp ? new Date(d.overrideFollowUp) : null
  );

  await db
    .update(schema.prospects)
    .set({ status: d.disposition, nextFollowUpAt: nextFollowUp })
    .where(eq(schema.prospects.id, prospectId));

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "OUTREACH_LOGGED",
    entityType: "prospect",
    entityId: prospectId,
    detail: { disposition: d.disposition },
  });

  revalidatePath(`/sales/prospects/${prospectId}`);
  revalidatePath("/sales/queue");
  redirect(`/sales/prospects/${prospectId}`);
}

export async function convertToClient(prospectId: string) {
  const user = await requireRole(["OWNER", "MANAGER"]);

  const [prospect] = await db
    .select()
    .from(schema.prospects)
    .where(and(eq(schema.prospects.id, prospectId), eq(schema.prospects.tenantId, user.tenantId)))
    .limit(1);
  if (!prospect) fail("/sales/prospects", "Prospect not found.");

  const [client] = await db
    .insert(schema.principalClients)
    .values({
      tenantId: user.tenantId,
      name: prospect.firmName,
      contactPerson: prospect.contactPerson,
      email: prospect.email,
      phone: prospect.phone,
      commissionPct: "10",
    })
    .returning();

  await db
    .update(schema.prospects)
    .set({ status: "CONVERTED", nextFollowUpAt: null })
    .where(eq(schema.prospects.id, prospectId));

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "PROSPECT_CONVERTED",
    entityType: "prospect",
    entityId: prospectId,
    detail: { newClientId: client.id },
  });

  revalidatePath("/sales/prospects");
  revalidatePath("/clients");
  redirect(`/clients/${client.id}/import`);
}

export async function deleteProspect(prospectId: string) {
  const user = await requireRole(["OWNER"]);
  await db
    .delete(schema.prospects)
    .where(and(eq(schema.prospects.id, prospectId), eq(schema.prospects.tenantId, user.tenantId)));
  revalidatePath("/sales/prospects");
  redirect("/sales/prospects");
}
