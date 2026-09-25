import {
  pgTable,
  text,
  timestamp,
  numeric,
  integer,
  boolean,
  pgEnum,
  uuid,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* ---------------------------------------------------------------------- */
/*  Enums                                                                  */
/* ---------------------------------------------------------------------- */

export const roleEnum = pgEnum("role", [
  "OWNER", // full access, manages tenants
  "MANAGER", // runs day-to-day operations
  "COLLECTOR", // collection book only, own assigned debtors
  "SALES", // sales book only, own pipeline
  "CLIENT", // read-oriented client portal
]);

export const leadStatusEnum = pgEnum("lead_status", [
  "OPEN",
  "PROMISED", // promise to pay
  "DISPUTED",
  "NO_ANSWER",
  "DECLINED", // not proceeding
  "RESOLVED", // settled / closed won
]);

export const disputeReasonEnum = pgEnum("dispute_reason", [
  "PRICE_DISCREPANCY",
  "MISSING_DOCS",
  "DAMAGED_GOODS",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "OPEN",
  "PARTIAL",
  "SETTLED",
  "DISPUTED",
  "WRITE_OFF",
]);

export const chequeTypeEnum = pgEnum("cheque_type", ["POST_DATED", "CURRENT"]);

export const chequeStatusEnum = pgEnum("cheque_status", [
  "PENDING",
  "DEPOSITED",
  "CLEARED",
  "BOUNCED",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "CASH",
  "BANK_TRANSFER",
  "CHEQUE",
  "POST_DATED_CHEQUE",
]);

export const correctionStatusEnum = pgEnum("correction_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

export const documentTypeEnum = pgEnum("document_type", [
  "INVOICE",
  "CONTRACT",
  "CORRESPONDENCE",
  "SUPPORTING",
  "CHEQUE_COPY",
  "DELIVERY_NOTE",
  "PURCHASE_ORDER",
  "ID_DOCUMENT",
  "OTHER",
]);

export const prospectStatusEnum = pgEnum("prospect_status", [
  "NEW",
  "NO_ANSWER",
  "ENGAGED",
  "NEGOTIATING",
  "PROPOSAL_SENT",
  "MEETING_SET",
  "LOST",
  "CONVERTED",
]);

export const outreachChannelEnum = pgEnum("outreach_channel", [
  "CALL",
  "EMAIL",
  "IN_PERSON",
  "WHATSAPP",
]);

/* ---------------------------------------------------------------------- */
/*  Tenants & Users                                                        */
/* ---------------------------------------------------------------------- */

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  companyEmail: text("company_email"),
  companyPhone: text("company_phone"),
  currency: text("currency").notNull().default("USD"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  // Only set (and only meaningful) for role = CLIENT: scopes a client-portal
  // login to the one principal client portfolio they're allowed to view.
  principalClientId: uuid("principal_client_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ---------------------------------------------------------------------- */
/*  Collection book                                                        */
/* ---------------------------------------------------------------------- */

export const principalClients = pgTable("principal_clients", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  tradeLicenseNo: text("trade_license_no"),
  contactPerson: text("contact_person"),
  email: text("email"),
  phone: text("phone"),
  commissionPct: numeric("commission_pct", { precision: 5, scale: 2 })
    .notNull()
    .default("10"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const debtors = pgTable("debtors", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  clientId: uuid("client_id")
    .notNull()
    .references(() => principalClients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  altPhone: text("alt_phone"),
  contactPerson: text("contact_person"),
  tradeLicenseNo: text("trade_license_no"),
  city: text("city").notNull().default("Unspecified"),
  status: leadStatusEnum("status").notNull().default("OPEN"),
  disputeReason: disputeReasonEnum("dispute_reason"),
  assignedUserId: uuid("assigned_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  nextFollowUpAt: timestamp("next_follow_up_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  debtorId: uuid("debtor_id")
    .notNull()
    .references(() => debtors.id, { onDelete: "cascade" }),
  clientId: uuid("client_id")
    .notNull()
    .references(() => principalClients.id, { onDelete: "cascade" }),
  invoiceNumber: text("invoice_number").notNull(),
  invoiceDate: timestamp("invoice_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  outstanding: numeric("outstanding", { precision: 14, scale: 2 }).notNull(),
  commissionPct: numeric("commission_pct", { precision: 5, scale: 2 }).notNull(),
  status: invoiceStatusEnum("status").notNull().default("OPEN"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const callLogs = pgTable("call_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  debtorId: uuid("debtor_id")
    .notNull()
    .references(() => debtors.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  personContacted: text("person_contacted"),
  disposition: leadStatusEnum("disposition").notNull(),
  disputeReason: disputeReasonEnum("dispute_reason"),
  promisedDate: timestamp("promised_date"),
  promisedAmount: numeric("promised_amount", { precision: 14, scale: 2 }),
  notes: text("notes").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const cheques = pgTable("cheques", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  debtorId: uuid("debtor_id")
    .notNull()
    .references(() => debtors.id, { onDelete: "cascade" }),
  invoiceId: uuid("invoice_id").references(() => invoices.id, {
    onDelete: "set null",
  }),
  type: chequeTypeEnum("type").notNull(),
  chequeNumber: text("cheque_number").notNull(),
  bankName: text("bank_name").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  chequeDate: timestamp("cheque_date").notNull(),
  maturityDate: timestamp("maturity_date"),
  depositDate: timestamp("deposit_date"),
  status: chequeStatusEnum("status").notNull().default("PENDING"),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  debtorId: uuid("debtor_id")
    .notNull()
    .references(() => debtors.id, { onDelete: "cascade" }),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  method: paymentMethodEnum("method").notNull().default("BANK_TRANSFER"),
  chequeId: uuid("cheque_id").references(() => cheques.id, {
    onDelete: "set null",
  }),
  commissionAmount: numeric("commission_amount", {
    precision: 14,
    scale: 2,
  }).notNull(),
  notes: text("notes"),
  recordedByUserId: uuid("recorded_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const paymentCorrections = pgTable("payment_corrections", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  paymentId: uuid("payment_id")
    .notNull()
    .references(() => payments.id, { onDelete: "cascade" }),
  requestedByUserId: uuid("requested_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  proposedAmount: numeric("proposed_amount", {
    precision: 14,
    scale: 2,
  }).notNull(),
  reason: text("reason").notNull(),
  status: correctionStatusEnum("status").notNull().default("PENDING"),
  reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  debtorId: uuid("debtor_id")
    .notNull()
    .references(() => debtors.id, { onDelete: "cascade" }),
  invoiceId: uuid("invoice_id").references(() => invoices.id, {
    onDelete: "set null",
  }),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url"),
  docType: documentTypeEnum("doc_type").notNull().default("OTHER"),
  notes: text("notes"),
  uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ---------------------------------------------------------------------- */
/*  Sales book                                                             */
/* ---------------------------------------------------------------------- */

export const prospects = pgTable("prospects", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  firmName: text("firm_name").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  address: text("address"),
  sourceSheet: text("source_sheet"),
  status: prospectStatusEnum("status").notNull().default("NEW"),
  assignedUserId: uuid("assigned_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  nextFollowUpAt: timestamp("next_follow_up_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const outreachLogs = pgTable("outreach_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  prospectId: uuid("prospect_id")
    .notNull()
    .references(() => prospects.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  channel: outreachChannelEnum("channel").notNull(),
  disposition: prospectStatusEnum("disposition").notNull(),
  personContacted: text("person_contacted"),
  notes: text("notes").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ---------------------------------------------------------------------- */
/*  Settings & audit                                                      */
/* ---------------------------------------------------------------------- */

export const commissionTiers = pgTable("commission_tiers", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  minDays: integer("min_days").notNull(),
  maxDays: integer("max_days"), // null = open-ended (e.g. 90+)
  pct: numeric("pct", { precision: 5, scale: 2 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id")
    .notNull()
    .references(() => tenants.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  detail: jsonb("detail"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ---------------------------------------------------------------------- */
/*  Relations (for convenient nested queries)                             */
/* ---------------------------------------------------------------------- */

export const debtorsRelations = relations(debtors, ({ one, many }) => ({
  client: one(principalClients, {
    fields: [debtors.clientId],
    references: [principalClients.id],
  }),
  assignedUser: one(users, {
    fields: [debtors.assignedUserId],
    references: [users.id],
  }),
  invoices: many(invoices),
  callLogs: many(callLogs),
  cheques: many(cheques),
  payments: many(payments),
  documents: many(documents),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  debtor: one(debtors, { fields: [invoices.debtorId], references: [debtors.id] }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, {
    fields: [payments.invoiceId],
    references: [invoices.id],
  }),
  debtor: one(debtors, { fields: [payments.debtorId], references: [debtors.id] }),
}));

export const prospectsRelations = relations(prospects, ({ many }) => ({
  outreach: many(outreachLogs),
}));
