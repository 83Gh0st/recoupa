import * as XLSX from "xlsx";

export type SalesRow = {
  rowNumber: number;
  sourceSheet: string;
  firmName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  notes?: string;
  errors: string[];
};

const HEADER_MAP: Record<string, keyof SalesRow> = {
  firm: "firmName",
  company: "firmName",
  "client name": "firmName",
  name: "firmName",
  "contact person": "contactPerson",
  poc: "contactPerson",
  contact: "phone", // bare "Contact" treated as phone per spec
  telephone: "phone",
  mobile: "phone",
  phone: "phone",
  email: "email",
  website: "website",
  url: "website",
  address: "address",
  location: "address",
  remarks: "notes",
  notes: "notes",
};

const BLANK_TOKENS = new Set(["", "n a", "n/a", "na", "nil", "-", "—"]);

function normalizeHeader(h: string) {
  return h.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function parseSalesWorkbook(buffer: ArrayBuffer) {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const rows: SalesRow[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
    if (raw.length === 0) continue;

    let headerRowIdx = -1;
    let colMap: Record<number, keyof SalesRow> = {};
    for (let r = 0; r < Math.min(6, raw.length); r++) {
      const candidate: Record<number, keyof SalesRow> = {};
      let hits = 0;
      (raw[r] ?? []).forEach((cell, idx) => {
        const norm = normalizeHeader(String(cell ?? ""));
        if (HEADER_MAP[norm]) {
          candidate[idx] = HEADER_MAP[norm];
          hits++;
        }
      });
      if (hits >= 2) {
        headerRowIdx = r;
        colMap = candidate;
        break;
      }
    }
    if (headerRowIdx === -1) continue;

    for (let r = headerRowIdx + 1; r < raw.length; r++) {
      const line = raw[r] ?? [];
      if (line.every((c) => String(c ?? "").trim() === "")) continue;

      const row: SalesRow = { rowNumber: r + 1, sourceSheet: sheetName, errors: [] };
      for (const [idxStr, field] of Object.entries(colMap)) {
        const value = line[Number(idxStr)];
        const str = String(value ?? "").trim();
        (row as any)[field] = BLANK_TOKENS.has(str.toLowerCase()) ? undefined : str;
      }
      // A row needs a firm name (or contact person used as name) plus one reachability field.
      if (!row.firmName && row.contactPerson) row.firmName = row.contactPerson;
      if (!row.firmName) row.errors.push("Missing firm/contact name");
      if (!row.phone && !row.email && !row.website && !row.address) {
        row.errors.push("No phone, email, website, or address");
      }
      rows.push(row);
    }
  }

  return { rows, headerFound: rows.length > 0 };
}
