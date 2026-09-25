import { db, schema } from "@/lib/db";

export async function logAudit(params: {
  tenantId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  detail?: Record<string, unknown>;
}) {
  await db.insert(schema.auditLogs).values({
    tenantId: params.tenantId,
    userId: params.userId ?? null,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId ?? null,
    detail: params.detail ?? undefined,
  });
}
