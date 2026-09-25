import { db, schema } from "@/lib/db";
import { requireArea } from "@/lib/rbac";
import { and, eq } from "drizzle-orm";
import Shell from "@/components/Shell";
import { PageHeader } from "@/components/ui";
import SalesImportClient from "./SalesImportClient";

export default async function SalesImportPage() {
  const session = await requireArea("salesImport");
  const { tenantId } = session.user;

  const reps = await db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(and(eq(schema.users.tenantId, tenantId), eq(schema.users.role, "SALES")));

  return (
    <Shell session={session}>
      <PageHeader
        title="Import Mastersheet"
        subtitle="Upload a workbook of prospects. Every sheet is read; each row becomes a prospect, not a debtor."
      />
      <SalesImportClient reps={reps} />
    </Shell>
  );
}
