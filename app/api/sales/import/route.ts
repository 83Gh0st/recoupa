import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { db, schema } from "@/lib/db";
import { and, eq, ilike } from "drizzle-orm";
import { parseSalesWorkbook } from "@/lib/import/salesImport";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const user = await requireRole(["OWNER", "MANAGER"]);
  const form = await req.formData();
  const file = form.get("file");
  const mode = String(form.get("mode") || "preview");
  const assignUserId = (form.get("assignUserId") as string) || null;
  const skipExisting = form.get("skipExisting") !== "false";

  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const { rows, headerFound } = parseSalesWorkbook(buffer);

  if (!headerFound) {
    return NextResponse.json({
      error: "No prospect rows found. Expected columns such as firm/company name, contact, telephone, email or website.",
    });
  }

  const valid = rows.filter((r) => r.errors.length === 0);
  const errored = rows.filter((r) => r.errors.length > 0);

  const bySheet: Record<string, number> = {};
  for (const r of valid) bySheet[r.sourceSheet] = (bySheet[r.sourceSheet] || 0) + 1;

  if (mode === "preview") {
    return NextResponse.json({
      total: rows.length,
      validCount: valid.length,
      errorCount: errored.length,
      bySheet,
      errors: errored.slice(0, 50).map((r) => ({ row: r.rowNumber, sheet: r.sourceSheet, issues: r.errors })),
    });
  }

  let created = 0;
  let skipped = 0;
  for (const row of valid) {
    if (skipExisting) {
      const existing = await db
        .select({ id: schema.prospects.id })
        .from(schema.prospects)
        .where(and(eq(schema.prospects.tenantId, user.tenantId), ilike(schema.prospects.firmName, row.firmName!)))
        .limit(1);
      if (existing.length > 0) {
        skipped++;
        continue;
      }
    }
    await db.insert(schema.prospects).values({
      tenantId: user.tenantId,
      firmName: row.firmName!,
      contactPerson: row.contactPerson || null,
      phone: row.phone || null,
      email: row.email || null,
      website: row.website || null,
      address: row.address || null,
      sourceSheet: row.sourceSheet,
      assignedUserId: assignUserId,
    });
    created++;
  }

  await logAudit({
    tenantId: user.tenantId,
    userId: user.id,
    action: "SALES_IMPORT_COMMIT",
    entityType: "prospect",
    detail: { created, skipped },
  });

  return NextResponse.json({ imported: true, created, skipped });
}
