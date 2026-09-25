import { db, schema } from "@/lib/db";
import { requireArea } from "@/lib/rbac";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Shell from "@/components/Shell";
import { PageHeader } from "@/components/ui";
import ImportClient from "./ImportClient";

export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireArea("clientImport");
  const { id } = await params;

  const [client] = await db
    .select()
    .from(schema.principalClients)
    .where(and(eq(schema.principalClients.id, id), eq(schema.principalClients.tenantId, session.user.tenantId)))
    .limit(1);
  if (!client) notFound();

  const collectors = await db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(and(eq(schema.users.tenantId, session.user.tenantId), eq(schema.users.role, "COLLECTOR")));

  return (
    <Shell session={session}>
      <PageHeader
        title={`Master load — ${client.name}`}
        subtitle="Upload a spreadsheet of debtors and invoices. Validate first, then commit."
      />
      <ImportClient clientId={client.id} collectors={collectors} />
    </Shell>
  );
}
