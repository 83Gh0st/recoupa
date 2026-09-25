import * as XLSX from "xlsx";
import { db, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";

export type MasterLoadRow = {
  rowNumber: number;
  debtorName?: string;
  phone?: string;
  altPhone?: string;
  contactPerson?: string;
  tradeLicenseNo?: string;
  city?: string;
  invoiceNumber?: string;
  invoiceDate?: string; // ISO
  dueDate?: string; // ISO
  amount?: number;
  outstanding?: number;
  collected?: number;
  commissionPct?: number;
  errors: string[];
  isDuplicate?: boolean;
};

const HEADER_MAP: Record<string, keyof MasterLoadRow> = {
  "debtor name": "debtorName",
  debtor: "debtorName",
  customer: "debtorName",
  "company name": "debtorName",
  "firm name": "debtorName",
  name: "debtorName",
  phone: "phone",
  mobile: "phone",
  telephone: "phone",
  contact: "phone",
  "alternate phone": "altPhone",
  "alt phone": "altPhone",
  "invoice number": "invoiceNumber",
  invoice: "invoiceNumber",
  inv: "invoiceNumber",
  "invoice date": "invoiceDate",
  "bill date": "invoiceDate",
  "due date": "dueDate",
  "maturity date": "dueDate",
  "payment due": "dueDate",
  "invoice amount": "amount",
  amount: "amount",
  "total amount": "amount",
  outstanding: "outstanding",
  balance: "outstanding",
  overdue: "outstanding",
  collected: "collected",
  paid: "collected",
  commission: "commissionPct",
  "comm %": "commissionPct",
  "commission %": "commissionPct",
  "contact person": "contactPerson",
  poc: "contactPerson",
  "trade license": "tradeLicenseNo",
  license: "tradeLicenseNo",
  city: "city",
  emirate: "city",
};

function normalizeHeader(h: string) {
  return h.toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();
}

const BLANK_TOKENS = new Set(["", "n a", "n/a", "na", "nil", "-", "—"]);

export function parseMasterLoadWorkbook(buffer: ArrayBuffer) {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: "",
  });

  let headerRowIdx = -1;
  let colMap: Record<number, keyof MasterLoadRow> = {};
  for (let r = 0; r < Math.min(6, raw.length); r++) {
    const candidate: Record<number, keyof MasterLoadRow> = {};
    let hits = 0;
    (raw[r] ?? []).forEach((cell, idx) => {
      const norm = normalizeHeader(String(cell ?? ""));
      if (HEADER_MAP[norm]) {
        candidate[idx] = HEADER_MAP[norm];
        hits++;
      }
    });
    if (hits >= 3) {
      headerRowIdx = r;
      colMap = candidate;
      break;
    }
  }

  if (headerRowIdx === -1) {
    return { rows: [] as MasterLoadRow[], headerFound: false };
  }

  const rows: MasterLoadRow[] = [];
  for (let r = headerRowIdx + 1; r < raw.length; r++) {
    const line = raw[r] ?? [];
    if (line.every((c) => String(c ?? "").trim() === "")) continue;

    const row: MasterLoadRow = { rowNumber: r + 1, errors: [] };
    for (const [idxStr, field] of Object.entries(colMap)) {
      const value = line[Number(idxStr)];
      if (field === "amount" || field === "outstanding" || field === "collected" || field === "commissionPct") {
        const n =
          typeof value === "number" ? value : parseFloat(String(value ?? "").replace(/[, ]/g, ""));
        (row as any)[field] = Number.isFinite(n) ? n : undefined;
      } else if (field === "invoiceDate" || field === "dueDate") {
        const d = value instanceof Date ? value : value ? new Date(String(value)) : undefined;
        (row as any)[field] = d && !Number.isNaN(d.getTime()) ? d.toISOString() : undefined;
      } else {
        const str = String(value ?? "").trim();
        (row as any)[field] = BLANK_TOKENS.has(str.toLowerCase()) ? undefined : str;
      }
    }
    rows.push(row);
  }
  return { rows, headerFound: true };
}

export async function validateMasterLoadRows(
  tenantId: string,
  clientId: string,
  rows: MasterLoadRow[]
) {
  const seenInFile = new Set<string>();
  const existing = await db
    .select({ invoiceNumber: schema.invoices.invoiceNumber })
    .from(schema.invoices)
    .where(and(eq(schema.invoices.tenantId, tenantId), eq(schema.invoices.clientId, clientId)));
  const existingSet = new Set(existing.map((e) => e.invoiceNumber.toLowerCase()));

  for (const row of rows) {
    row.errors = [];
    if (!row.debtorName) row.errors.push("Missing debtor name");
    if (!row.phone) row.errors.push("Missing phone");
    if (!row.invoiceNumber) row.errors.push("Missing invoice number");
    if (!row.invoiceDate) row.errors.push("Missing or invalid invoice date");
    if (!row.amount || row.amount <= 0) row.errors.push("Amount must be greater than 0");

    if (row.invoiceNumber) {
      const key = row.invoiceNumber.toLowerCase();
      if (seenInFile.has(key)) {
        row.isDuplicate = true;
        row.errors.push("Duplicate invoice number in this file");
      } else if (existingSet.has(key)) {
        row.isDuplicate = true;
        row.errors.push("Invoice number already exists for this client");
      } else {
        seenInFile.add(key);
      }
    }
  }

  const valid = rows.filter((r) => r.errors.length === 0);
  const duplicates = rows.filter((r) => r.isDuplicate);
  const errored = rows.filter((r) => r.errors.length > 0 && !r.isDuplicate);

  return { valid, duplicates, errored, total: rows.length };
}

export async function commitMasterLoadRows(
  tenantId: string,
  clientId: string,
  rows: MasterLoadRow[],
  defaultCommissionPct: number,
  assignUserId: string | null
) {
  let debtorsCreated = 0;
  let invoicesCreated = 0;

  for (const row of rows) {
    if (row.errors.length > 0 || !row.debtorName || !row.phone || !row.invoiceNumber || !row.amount || !row.invoiceDate) {
      continue;
    }

    let [debtor] = await db
      .select()
      .from(schema.debtors)
      .where(
        and(
          eq(schema.debtors.tenantId, tenantId),
          eq(schema.debtors.clientId, clientId),
          eq(schema.debtors.phone, row.phone)
        )
      )
      .limit(1);

    if (!debtor) {
      const [created] = await db
        .insert(schema.debtors)
        .values({
          tenantId,
          clientId,
          name: row.debtorName,
          phone: row.phone,
          altPhone: row.altPhone || null,
          contactPerson: row.contactPerson || null,
          tradeLicenseNo: row.tradeLicenseNo || null,
          city: row.city || "Unspecified",
          assignedUserId: assignUserId,
        })
        .returning();
      debtor = created;
      debtorsCreated++;
    } else if (row.contactPerson || row.tradeLicenseNo) {
      await db
        .update(schema.debtors)
        .set({
          contactPerson: row.contactPerson || debtor.contactPerson,
          tradeLicenseNo: row.tradeLicenseNo || debtor.tradeLicenseNo,
        })
        .where(eq(schema.debtors.id, debtor.id));
    }

    const amount = row.amount!;
    const collected = row.collected ?? 0;
    const outstanding = row.outstanding !== undefined ? row.outstanding : Math.max(0, amount - collected);
    const commissionPct = row.commissionPct ?? defaultCommissionPct;

    await db.insert(schema.invoices).values({
      tenantId,
      debtorId: debtor.id,
      clientId,
      invoiceNumber: row.invoiceNumber,
      invoiceDate: new Date(row.invoiceDate!),
      dueDate: row.dueDate ? new Date(row.dueDate) : new Date(row.invoiceDate!),
      amount: String(amount),
      outstanding: String(outstanding),
      commissionPct: String(commissionPct),
      status: outstanding <= 0 ? "SETTLED" : outstanding < amount ? "PARTIAL" : "OPEN",
    });
    invoicesCreated++;
  }

  return { debtorsCreated, invoicesCreated };
}
