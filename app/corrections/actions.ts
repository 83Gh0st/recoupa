"use server";

import { db, schema } from "@/lib/db";
import { requireRole } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function reviewCorrection(correctionId: string, formData: FormData) {
  const user = await requireRole(["OWNER", "MANAGER"]);
  const decision = String(formData.get("decision"));
  const reviewNotes = String(formData.get("reviewNotes") || "").trim() || null;

  const [correction] = await db
    .select()
    .from(schema.paymentCorrections)
    .where(eq(schema.paymentCorrections.id, correctionId))
    .limit(1);
  if (!correction || correction.tenantId !== user.tenantId) {
    redirect("/corrections?error=Correction+not+found");
  }
  if (correction.status !== "PENDING") {
    redirect("/corrections?error=Already+reviewed");
  }

  if (decision === "APPROVED") {
    const [payment] = await db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.id, correction.paymentId))
      .limit(1);
    if (!payment) redirect("/corrections?error=Payment+not+found");

    const [invoice] = await db
      .select()
      .from(schema.invoices)
      .where(eq(schema.invoices.id, payment.invoiceId))
      .limit(1);
    if (!invoice) redirect("/corrections?error=Invoice+not+found");

    const newAmount = Number(correction.proposedAmount);
    const delta = Number(payment.amount) - newAmount;
    const newOutstanding = Math.max(0, Number(invoice.outstanding) + delta);
    const newCommission = newAmount * (Number(invoice.commissionPct) / 100);

    await db
      .update(schema.payments)
      .set({ amount: String(newAmount), commissionAmount: String(newCommission) })
      .where(eq(schema.payments.id, payment.id));

    await db
      .update(schema.invoices)
      .set({
        outstanding: String(newOutstanding),
        status: newOutstanding <= 0 ? "SETTLED" : Number(invoice.amount) === newOutstanding ? "OPEN" : "PARTIAL",
      })
      .where(eq(schema.invoices.id, invoice.id));
  }

  await db
    .update(schema.paymentCorrections)
    .set({
      status: decision === "APPROVED" ? "APPROVED" : "REJECTED",
      reviewedByUserId: user.id,
      reviewedAt: new Date(),
      reviewNotes,
    })
    .where(eq(schema.paymentCorrections.id, correctionId));

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "CORRECTION_REVIEWED",
    entityType: "payment_correction",
    entityId: correctionId,
    detail: { decision },
  });

  revalidatePath("/corrections");
  redirect("/corrections?success=Reviewed");
}
