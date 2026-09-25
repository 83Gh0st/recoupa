import { db, schema } from "@/lib/db";
import { asc, eq } from "drizzle-orm";

export async function getCommissionTiers(tenantId: string) {
  return db
    .select()
    .from(schema.commissionTiers)
    .where(eq(schema.commissionTiers.tenantId, tenantId))
    .orderBy(asc(schema.commissionTiers.sortOrder));
}

export function pickTierForAge(
  tiers: { minDays: number; maxDays: number | null; pct: string }[],
  ageDays: number
): number | null {
  const sorted = [...tiers].sort((a, b) => a.minDays - b.minDays);
  for (const t of sorted) {
    if (ageDays >= t.minDays && (t.maxDays === null || ageDays <= t.maxDays)) {
      return Number(t.pct);
    }
  }
  return null;
}

/** Suggests a commission % for a fresh invoice based on how old it already is. */
export async function suggestCommissionPct(
  tenantId: string,
  invoiceDate: Date,
  fallbackPct: number
): Promise<number> {
  const tiers = await getCommissionTiers(tenantId);
  const ageDays = Math.max(
    0,
    Math.floor((Date.now() - invoiceDate.getTime()) / 86_400_000)
  );
  const pct = pickTierForAge(tiers, ageDays);
  return pct ?? fallbackPct;
}
