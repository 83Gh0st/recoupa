"use server";

import { z } from "zod";
import { db, schema } from "@/lib/db";
import { requireRole, requireUser } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { nextDebtorFollowUp } from "@/lib/followup";
import { suggestCommissionPct } from "@/lib/commission";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function fail(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

/* ------------------------------ Manual lead ----------------------------- */

const leadSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1).max(200),
  phone: z.string().min(1).max(40),
  altPhone: z.string().max(40).optional().or(z.literal("")),
  contactPerson: z.string().max(150).optional().or(z.literal("")),
  tradeLicenseNo: z.string().max(100).optional().or(z.literal("")),
  city: z.string().max(80).optional().or(z.literal("")),
  assignedUserId: z.string().uuid().optional().or(z.literal("")),
});

export async function createManualDebtor(formData: FormData) {
  const user = await requireRole(["OWNER", "MANAGER"]);
  const parsed = leadSchema.safeParse({
    clientId: formData.get("clientId"),
    name: formData.get("name"),
    phone: formData.get("phone"),
    altPhone: formData.get("altPhone"),
    contactPerson: formData.get("contactPerson"),
    tradeLicenseNo: formData.get("tradeLicenseNo"),
    city: formData.get("city"),
    assignedUserId: formData.get("assignedUserId"),
  });
  if (!parsed.success) fail("/debtors", parsed.error.issues[0]?.message ?? "Invalid input.");
  const d = parsed.data;

  const [created] = await db
    .insert(schema.debtors)
    .values({
      tenantId: user.tenantId,
      clientId: d.clientId,
      name: d.name,
      phone: d.phone,
      altPhone: d.altPhone || null,
      contactPerson: d.contactPerson || null,
      tradeLicenseNo: d.tradeLicenseNo || null,
      city: d.city || "Unspecified",
      assignedUserId: d.assignedUserId || null,
    })
    .returning();

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "DEBTOR_CREATED",
    entityType: "debtor",
    entityId: created.id,
  });

  revalidatePath("/debtors");
  redirect(`/debtors/${created.id}`);
}

/* --------------------------- Assign / manage ---------------------------- */

export async function assignDebtor(debtorId: string, userId: string) {
  const user = await requireRole(["OWNER", "MANAGER"]);
  await db
    .update(schema.debtors)
    .set({ assignedUserId: userId || null })
    .where(and(eq(schema.debtors.id, debtorId), eq(schema.debtors.tenantId, user.tenantId)));
  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "DEBTOR_ASSIGNED",
    entityType: "debtor",
    entityId: debtorId,
    detail: { userId },
  });
  revalidatePath("/debtors");
  revalidatePath(`/debtors/${debtorId}`);
}

const manageSchema = z.object({
  status: z.enum(["OPEN", "PROMISED", "DISPUTED", "NO_ANSWER", "DECLINED", "RESOLVED"]),
  assignedUserId: z.string().uuid().optional().or(z.literal("")),
  nextFollowUpAt: z.string().optional().or(z.literal("")),
});

export async function manageLead(debtorId: string, formData: FormData) {
  const user = await requireRole(["OWNER", "MANAGER"]);
  const parsed = manageSchema.safeParse({
    status: formData.get("status"),
    assignedUserId: formData.get("assignedUserId"),
    nextFollowUpAt: formData.get("nextFollowUpAt"),
  });
  if (!parsed.success) fail(`/debtors/${debtorId}`, "Invalid input.");
  const d = parsed.data;

  await db
    .update(schema.debtors)
    .set({
      status: d.status,
      assignedUserId: d.assignedUserId || null,
      nextFollowUpAt: d.nextFollowUpAt ? new Date(d.nextFollowUpAt) : null,
    })
    .where(and(eq(schema.debtors.id, debtorId), eq(schema.debtors.tenantId, user.tenantId)));

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "DEBTOR_MANAGED",
    entityType: "debtor",
    entityId: debtorId,
    detail: d,
  });

  revalidatePath(`/debtors/${debtorId}`);
  redirect(`/debtors/${debtorId}`);
}

export async function deleteLead(debtorId: string) {
  const user = await requireRole(["OWNER"]);
  await db
    .delete(schema.debtors)
    .where(and(eq(schema.debtors.id, debtorId), eq(schema.debtors.tenantId, user.tenantId)));
  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "DEBTOR_DELETED",
    entityType: "debtor",
    entityId: debtorId,
  });
  revalidatePath("/debtors");
  redirect("/debtors");
}

/* -------------------------------- Invoices -------------------------------- */

const invoiceSchema = z.object({
  invoiceNumber: z.string().min(1).max(80),
  invoiceDate: z.string().min(1),
  dueDate: z.string().optional().or(z.literal("")),
  amount: z.coerce.number().positive(),
  commissionPct: z.coerce.number().min(0).max(100),
});

export async function addInvoice(debtorId: string, formData: FormData) {
  const user = await requireRole(["OWNER", "MANAGER"]);
  const parsed = invoiceSchema.safeParse({
    invoiceNumber: formData.get("invoiceNumber"),
    invoiceDate: formData.get("invoiceDate"),
    dueDate: formData.get("dueDate"),
    amount: formData.get("amount"),
    commissionPct: formData.get("commissionPct"),
  });
  if (!parsed.success) fail(`/debtors/${debtorId}`, parsed.error.issues[0]?.message ?? "Invalid invoice.");
  const d = parsed.data;

  const [debtor] = await db.select().from(schema.debtors).where(eq(schema.debtors.id, debtorId)).limit(1);
  if (!debtor || debtor.tenantId !== user.tenantId) fail("/debtors", "Debtor not found.");

  const [dup] = await db
    .select()
    .from(schema.invoices)
    .where(
      and(
        eq(schema.invoices.tenantId, user.tenantId),
        eq(schema.invoices.clientId, debtor.clientId),
        eq(schema.invoices.invoiceNumber, d.invoiceNumber)
      )
    )
    .limit(1);
  if (dup) fail(`/debtors/${debtorId}`, "Invoice number already exists for this client.");

  await db.insert(schema.invoices).values({
    tenantId: user.tenantId,
    debtorId,
    clientId: debtor.clientId,
    invoiceNumber: d.invoiceNumber,
    invoiceDate: new Date(d.invoiceDate),
    dueDate: d.dueDate ? new Date(d.dueDate) : new Date(d.invoiceDate),
    amount: String(d.amount),
    outstanding: String(d.amount),
    commissionPct: String(d.commissionPct),
    status: "OPEN",
  });

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "INVOICE_ADDED",
    entityType: "debtor",
    entityId: debtorId,
    detail: { invoiceNumber: d.invoiceNumber, amount: d.amount },
  });

  revalidatePath(`/debtors/${debtorId}`);
  redirect(`/debtors/${debtorId}`);
}

export async function suggestedCommissionForDate(tenantId: string, invoiceDateIso: string, fallbackPct: number) {
  return suggestCommissionPct(tenantId, new Date(invoiceDateIso), fallbackPct);
}

/* --------------------------------- Calls ---------------------------------- */

const callSchema = z.object({
  personContacted: z.string().max(150).optional().or(z.literal("")),
  disposition: z.enum(["OPEN", "PROMISED", "DISPUTED", "NO_ANSWER", "DECLINED", "RESOLVED"]),
  disputeReason: z.enum(["PRICE_DISCREPANCY", "MISSING_DOCS", "DAMAGED_GOODS"]).optional().or(z.literal("")),
  promisedDate: z.string().optional().or(z.literal("")),
  promisedAmount: z.coerce.number().optional(),
  notes: z.string().min(1, "Notes are required").max(4000),
});

export async function logCall(debtorId: string, formData: FormData) {
  const user = await requireUser();
  const parsed = callSchema.safeParse({
    personContacted: formData.get("personContacted"),
    disposition: formData.get("disposition"),
    disputeReason: formData.get("disputeReason"),
    promisedDate: formData.get("promisedDate"),
    promisedAmount: formData.get("promisedAmount") || undefined,
    notes: formData.get("notes"),
  });
  if (!parsed.success) fail(`/debtors/${debtorId}`, parsed.error.issues[0]?.message ?? "Invalid call log.");
  const d = parsed.data;

  if (d.disposition === "DISPUTED" && !d.disputeReason) {
    fail(`/debtors/${debtorId}`, "Pick a dispute reason.");
  }

  await db.insert(schema.callLogs).values({
    tenantId: user.tenantId,
    debtorId,
    userId: user.id,
    personContacted: d.personContacted || null,
    disposition: d.disposition,
    disputeReason: (d.disputeReason as any) || null,
    promisedDate: d.promisedDate ? new Date(d.promisedDate) : null,
    promisedAmount: d.promisedAmount ? String(d.promisedAmount) : null,
    notes: d.notes,
  });

  const nextFollowUp = nextDebtorFollowUp(
    d.disposition,
    d.promisedDate ? new Date(d.promisedDate) : null
  );

  await db
    .update(schema.debtors)
    .set({
      status: d.disposition,
      disputeReason: d.disposition === "DISPUTED" ? (d.disputeReason as any) : null,
      nextFollowUpAt: nextFollowUp,
    })
    .where(eq(schema.debtors.id, debtorId));

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "CALL_LOGGED",
    entityType: "debtor",
    entityId: debtorId,
    detail: { disposition: d.disposition },
  });

  revalidatePath(`/debtors/${debtorId}`);
  revalidatePath("/queue");
  redirect(`/debtors/${debtorId}`);
}

/* -------------------------------- Cheques --------------------------------- */

const chequeSchema = z.object({
  type: z.enum(["POST_DATED", "CURRENT"]),
  chequeNumber: z.string().min(1).max(60),
  bankName: z.string().min(1).max(120),
  amount: z.coerce.number().positive(),
  chequeDate: z.string().min(1),
  maturityDate: z.string().optional().or(z.literal("")),
  depositDate: z.string().optional().or(z.literal("")),
  invoiceId: z.string().uuid().optional().or(z.literal("")),
  remarks: z.string().max(500).optional().or(z.literal("")),
});

export async function recordCheque(debtorId: string, formData: FormData) {
  const user = await requireUser();
  const parsed = chequeSchema.safeParse({
    type: formData.get("type"),
    chequeNumber: formData.get("chequeNumber"),
    bankName: formData.get("bankName"),
    amount: formData.get("amount"),
    chequeDate: formData.get("chequeDate"),
    maturityDate: formData.get("maturityDate"),
    depositDate: formData.get("depositDate"),
    invoiceId: formData.get("invoiceId"),
    remarks: formData.get("remarks"),
  });
  if (!parsed.success) fail(`/debtors/${debtorId}`, parsed.error.issues[0]?.message ?? "Invalid cheque.");
  const d = parsed.data;

  await db.insert(schema.cheques).values({
    tenantId: user.tenantId,
    debtorId,
    invoiceId: d.invoiceId || null,
    type: d.type,
    chequeNumber: d.chequeNumber,
    bankName: d.bankName,
    amount: String(d.amount),
    chequeDate: new Date(d.chequeDate),
    maturityDate: d.maturityDate ? new Date(d.maturityDate) : null,
    depositDate: d.depositDate ? new Date(d.depositDate) : null,
    remarks: d.remarks || null,
  });

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "CHEQUE_RECORDED",
    entityType: "debtor",
    entityId: debtorId,
  });

  revalidatePath(`/debtors/${debtorId}`);
  redirect(`/debtors/${debtorId}`);
}

export async function updateChequeStatus(debtorId: string, chequeId: string, status: string) {
  const user = await requireUser();
  const allowed = ["PENDING", "DEPOSITED", "CLEARED", "BOUNCED"];
  if (!allowed.includes(status)) fail(`/debtors/${debtorId}`, "Invalid cheque status.");

  await db
    .update(schema.cheques)
    .set({ status: status as any })
    .where(and(eq(schema.cheques.id, chequeId), eq(schema.cheques.tenantId, user.tenantId)));

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "CHEQUE_STATUS_UPDATED",
    entityType: "cheque",
    entityId: chequeId,
    detail: { status },
  });

  revalidatePath(`/debtors/${debtorId}`);
  redirect(`/debtors/${debtorId}`);
}

/* -------------------------------- Payments -------------------------------- */

const paymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.coerce.number().min(0.01),
  method: z.enum(["CASH", "BANK_TRANSFER", "CHEQUE", "POST_DATED_CHEQUE"]),
  chequeId: z.string().uuid().optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export async function recordPayment(debtorId: string, formData: FormData) {
  const user = await requireUser();
  const parsed = paymentSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    amount: formData.get("amount"),
    method: formData.get("method") || "BANK_TRANSFER",
    chequeId: formData.get("chequeId"),
    notes: formData.get("notes"),
  });
  if (!parsed.success) fail(`/debtors/${debtorId}`, parsed.error.issues[0]?.message ?? "Invalid payment.");
  const d = parsed.data;

  const [invoice] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, d.invoiceId)).limit(1);
  if (!invoice || invoice.tenantId !== user.tenantId) fail(`/debtors/${debtorId}`, "Invoice not found.");

  const outstanding = Number(invoice.outstanding);
  if (d.amount > outstanding) {
    fail(`/debtors/${debtorId}`, "Payment cannot exceed the invoice's remaining outstanding balance.");
  }

  const commissionAmount = d.amount * (Number(invoice.commissionPct) / 100);
  const newOutstanding = Math.max(0, outstanding - d.amount);
  const newStatus = newOutstanding <= 0 ? "SETTLED" : "PARTIAL";

  await db.insert(schema.payments).values({
    tenantId: user.tenantId,
    debtorId,
    invoiceId: d.invoiceId,
    amount: String(d.amount),
    method: d.method,
    chequeId: d.chequeId || null,
    commissionAmount: String(commissionAmount),
    notes: d.notes || null,
    recordedByUserId: user.id,
  });

  await db
    .update(schema.invoices)
    .set({ outstanding: String(newOutstanding), status: newStatus })
    .where(eq(schema.invoices.id, d.invoiceId));

  if (d.chequeId) {
    await db
      .update(schema.cheques)
      .set({ status: "CLEARED" })
      .where(eq(schema.cheques.id, d.chequeId));
  }

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "PAYMENT_RECORDED",
    entityType: "debtor",
    entityId: debtorId,
    detail: { invoiceId: d.invoiceId, amount: d.amount, commissionAmount },
  });

  revalidatePath(`/debtors/${debtorId}`);
  redirect(`/debtors/${debtorId}`);
}

export async function editPayment(debtorId: string, paymentId: string, formData: FormData) {
  const user = await requireRole(["OWNER", "MANAGER"]);
  const newAmount = Number(formData.get("amount"));
  if (!Number.isFinite(newAmount) || newAmount <= 0) fail(`/debtors/${debtorId}`, "Invalid amount.");

  const [payment] = await db.select().from(schema.payments).where(eq(schema.payments.id, paymentId)).limit(1);
  if (!payment || payment.tenantId !== user.tenantId) fail(`/debtors/${debtorId}`, "Payment not found.");
  const [invoice] = await db.select().from(schema.invoices).where(eq(schema.invoices.id, payment.invoiceId)).limit(1);
  if (!invoice) fail(`/debtors/${debtorId}`, "Invoice not found.");

  const delta = Number(payment.amount) - newAmount; // positive if new amount is smaller
  const newOutstanding = Math.max(0, Number(invoice.outstanding) + delta);
  const newCommission = newAmount * (Number(invoice.commissionPct) / 100);

  await db
    .update(schema.payments)
    .set({ amount: String(newAmount), commissionAmount: String(newCommission) })
    .where(eq(schema.payments.id, paymentId));

  await db
    .update(schema.invoices)
    .set({
      outstanding: String(newOutstanding),
      status: newOutstanding <= 0 ? "SETTLED" : Number(invoice.amount) === newOutstanding ? "OPEN" : "PARTIAL",
    })
    .where(eq(schema.invoices.id, invoice.id));

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "PAYMENT_EDITED",
    entityType: "payment",
    entityId: paymentId,
    detail: { oldAmount: payment.amount, newAmount },
  });

  revalidatePath(`/debtors/${debtorId}`);
  redirect(`/debtors/${debtorId}`);
}

export async function requestCorrection(debtorId: string, paymentId: string, formData: FormData) {
  const user = await requireUser();
  const proposedAmount = Number(formData.get("proposedAmount"));
  const reason = String(formData.get("reason") || "").trim();
  if (!Number.isFinite(proposedAmount) || proposedAmount <= 0 || !reason) {
    fail(`/debtors/${debtorId}`, "Proposed amount and reason are required.");
  }

  await db.insert(schema.paymentCorrections).values({
    tenantId: user.tenantId,
    paymentId,
    requestedByUserId: user.id,
    proposedAmount: String(proposedAmount),
    reason,
  });

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "CORRECTION_REQUESTED",
    entityType: "payment",
    entityId: paymentId,
    detail: { proposedAmount, reason },
  });

  revalidatePath(`/debtors/${debtorId}`);
  revalidatePath("/corrections");
  redirect(`/debtors/${debtorId}`);
}

/* ------------------------------- Documents -------------------------------- */

const documentSchema = z.object({
  fileName: z.string().min(1).max(200),
  invoiceId: z.string().uuid().optional().or(z.literal("")),
  docType: z.enum([
    "INVOICE",
    "CONTRACT",
    "CORRESPONDENCE",
    "SUPPORTING",
    "CHEQUE_COPY",
    "DELIVERY_NOTE",
    "PURCHASE_ORDER",
    "ID_DOCUMENT",
    "OTHER",
  ]),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export async function addDocument(debtorId: string, formData: FormData) {
  const user = await requireUser();
  const parsed = documentSchema.safeParse({
    fileName: formData.get("fileName"),
    invoiceId: formData.get("invoiceId"),
    docType: formData.get("docType") || "OTHER",
    notes: formData.get("notes"),
  });
  if (!parsed.success) fail(`/debtors/${debtorId}`, "File name / reference and type are required.");
  const d = parsed.data;

  await db.insert(schema.documents).values({
    tenantId: user.tenantId,
    debtorId,
    invoiceId: d.invoiceId || null,
    fileName: d.fileName,
    docType: d.docType,
    notes: d.notes || null,
    uploadedByUserId: user.id,
  });

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "DOCUMENT_ADDED",
    entityType: "debtor",
    entityId: debtorId,
  });

  revalidatePath(`/debtors/${debtorId}`);
  redirect(`/debtors/${debtorId}`);
}

export async function deleteDocument(debtorId: string, documentId: string) {
  const user = await requireUser();
  await db
    .delete(schema.documents)
    .where(and(eq(schema.documents.id, documentId), eq(schema.documents.tenantId, user.tenantId)));
  revalidatePath(`/debtors/${debtorId}`);
  redirect(`/debtors/${debtorId}`);
}
