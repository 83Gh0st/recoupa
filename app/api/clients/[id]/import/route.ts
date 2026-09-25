import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  parseMasterLoadWorkbook,
  validateMasterLoadRows,
  commitMasterLoadRows,
} from "@/lib/import/masterLoad";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["OWNER", "MANAGER"]);
  const { id: clientId } = await params;

  const [client] = await db
    .select()
    .from(schema.principalClients)
    .where(eq(schema.principalClients.id, clientId))
    .limit(1);
  if (!client || client.tenantId !== user.tenantId) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  const form = await req.formData();
  const file = form.get("file");
  const mode = String(form.get("mode") || "validate");
  const assignUserId = (form.get("assignUserId") as string) || null;

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const { rows, headerFound } = parseMasterLoadWorkbook(buffer);

  if (!headerFound || rows.length === 0) {
    return NextResponse.json({
      error:
        "No debtor/invoice rows found. Include debtor name, phone, invoice number and amount columns.",
    });
  }

  const { valid, duplicates, errored, total } = await validateMasterLoadRows(
    user.tenantId,
    clientId,
    rows
  );

  if (mode === "validate") {
    return NextResponse.json({
      total,
      validCount: valid.length,
      duplicateCount: duplicates.length,
      errorCount: errored.length,
      errors: errored.slice(0, 50).map((r) => ({ row: r.rowNumber, issues: r.errors })),
      duplicateRows: duplicates.slice(0, 50).map((r) => r.rowNumber),
    });
  }

  const result = await commitMasterLoadRows(
    user.tenantId,
    clientId,
    valid,
    Number(client.commissionPct),
    assignUserId
  );

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "MASTER_LOAD_COMMIT",
    entityType: "principal_client",
    entityId: clientId,
    detail: result,
  });

  return NextResponse.json({ committed: true, ...result });
}
