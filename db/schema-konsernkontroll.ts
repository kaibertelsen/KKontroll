
import {
  pgTable,
  varchar,
  integer,
  serial,
  timestamp,
  text,
  numeric,
  date,
  pgEnum,
  boolean,
  json
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* -------------------------------------------------
   ENUMS
---------------------------------------------------*/
export const userRoleEnum = pgEnum("user_role", ["controller", "leader"]);
export const reportStatusEnum = pgEnum("report_status", ["draft", "submitted", "approved"]);
export const budgetModeEnum = pgEnum("budget_mode", ["annual", "quarterly", "monthly"]);

/* -------------------------------------------------
   1. GROUPS (Konsern/Klient/Tenant)
---------------------------------------------------*/
export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(), 
  logoUrl: varchar("logo_url", { length: 255 }), 
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* -------------------------------------------------
   2. COMPANIES (Selskaper)
---------------------------------------------------*/
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").references(() => groups.id).notNull(),
  name: varchar("name", { length: 50 }).notNull(), 
  fullName: varchar("full_name", { length: 255 }), 
  manager: varchar("manager", { length: 255 }).notNull(), 
  
  // Sortering i Dashboard
  sortOrder: integer("sort_order").default(0),

  // Økonomiske nøkkeltall (Snapshot)
  revenue: integer("revenue").default(0).notNull(),
  expenses: integer("expenses").default(0).notNull(),
  resultYtd: integer("result_ytd").default(0).notNull(),
  
  // Budsjettlogikk
  budgetTotal: integer("budget_total").default(0).notNull(), 
  budgetMode: budgetModeEnum("budget_mode").default("annual"),
  budgetMonths: json("budget_months").$type<number[]>().default([0,0,0,0,0,0,0,0,0,0,0,0]),

  liquidity: integer("liquidity").default(0).notNull(),
  receivables: integer("receivables").default(0).notNull(), 
  accountsPayable: integer("accounts_payable").default(0).notNull(), 
  publicFees: integer("public_fees").default(0).notNull(), 
  salaryExpenses: integer("salary_expenses").default(0).notNull(), // New field
  
  liquidityDate: varchar("liquidity_date", { length: 20 }), 
  receivablesDate: varchar("receivables_date", { length: 20 }),
  accountsPayableDate: varchar("accounts_payable_date", { length: 20 }),
  publicFeesDate: varchar("public_fees_date", { length: 20 }),
  salaryExpensesDate: varchar("salary_expenses_date", { length: 20 }), // New field
  
  // Analyse
  trendHistory: numeric("trend_history", { precision: 5, scale: 2 }).default("0"), 
  
  // Risk Matrix History
  prevLiquidity: integer("prev_liquidity"),
  prevTrend: numeric("prev_trend", { precision: 5, scale: 2 }),

  // Cache fra siste rapport
  lastReportDate: varchar("last_report_date", { length: 20 }),
  lastReportBy: varchar("last_report_by", { length: 255 }),
  currentComment: text("current_comment"), 
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* -------------------------------------------------
   3. USERS (Brukere)
---------------------------------------------------*/
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  authId: varchar("auth_id", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull(),
  password: varchar("password", { length: 255 }), 
  fullName: varchar("full_name", { length: 255 }),
  role: userRoleEnum("role").default("leader").notNull(),
  groupId: integer("group_id").references(() => groups.id).notNull(),
  companyId: integer("company_id").references(() => companies.id), // Kept for legacy support, but usercompanyaccess is preferred
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* -------------------------------------------------
   3.5 USER_COMPANY_ACCESS (Many-to-Many)
   Renamed to "usercompanyaccess" to avoid issues
---------------------------------------------------*/
export const usercompanyaccess = pgTable("usercompanyaccess", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
});

/* -------------------------------------------------
   4. REPORTS (Rapporteringslogg)
---------------------------------------------------*/
export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  submittedByUserId: integer("submitted_by_user_id").references(() => users.id),
  authorName: varchar("author_name", { length: 255 }), 
  
  revenue: integer("revenue"),
  expenses: integer("expenses"),
  resultYtd: integer("result_ytd"),
  
  liquidity: integer("liquidity"),
  receivables: integer("receivables"),
  accountsPayable: integer("accounts_payable"),
  publicFees: integer("public_fees"), 
  salaryExpenses: integer("salary_expenses"), // New field
  
  liquidityDate: varchar("liquidity_date", { length: 20 }),
  receivablesDate: varchar("receivables_date", { length: 20 }),
  accountsPayableDate: varchar("accounts_payable_date", { length: 20 }),
  publicFeesDate: varchar("public_fees_date", { length: 20 }),
  salaryExpensesDate: varchar("salary_expenses_date", { length: 20 }), // New field
  pnlDate: varchar("pnl_date", { length: 20 }),

  comment: text("comment"),
  source: varchar("source", { length: 50 }).default("Manuell"), 
  
  status: reportStatusEnum("status").default("submitted"),
  
  approvedByUserId: integer("approved_by_user_id").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  
  reportDate: timestamp("report_date").defaultNow().notNull(),
});

/* -------------------------------------------------
   5. FORECASTS (Likviditetsprognose)
---------------------------------------------------*/
export const forecasts = pgTable("forecasts", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  month: varchar("month", { length: 10 }).notNull(), 
  estimatedReceivables: integer("estimated_receivables").default(0), 
  estimatedPayables: integer("estimated_payables").default(0), 
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* -------------------------------------------------
   6. LOGS (Aktivitetslogg)
---------------------------------------------------*/
export const logs = pgTable("logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  action: varchar("action", { length: 100 }).notNull(), // e.g. 'LOGIN', 'CREATE_COMPANY'
  entity: varchar("entity", { length: 100 }), // e.g. 'companies', 'reports'
  entityId: integer("entity_id"),
  details: text("details"), // JSON string or description
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* -------------------------------------------------
   RELATIONS
---------------------------------------------------*/

export const groupsRelations = relations(groups, ({ many }) => ({
  users: many(users),
  companies: many(companies),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  group: one(groups, {
    fields: [users.groupId],
    references: [groups.id],
  }),
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
  companyAccess: many(usercompanyaccess),
  reports: many(reports),
  logs: many(logs),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  group: one(groups, {
    fields: [companies.groupId],
    references: [groups.id],
  }),
  users: many(users),
  userAccess: many(usercompanyaccess),
  reports: many(reports),
  forecasts: many(forecasts),
}));

export const usercompanyaccessRelations = relations(usercompanyaccess, ({ one }) => ({
  user: one(users, {
    fields: [usercompanyaccess.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [usercompanyaccess.companyId],
    references: [companies.id],
  }),
}));

export const reportsRelations = relations(reports, ({ one }) => ({
  company: one(companies, {
    fields: [reports.companyId],
    references: [companies.id],
  }),
  author: one(users, {
    fields: [reports.submittedByUserId],
    references: [users.id],
  }),
  approver: one(users, {
    fields: [reports.approvedByUserId],
    references: [users.id],
  }),
}));

export const forecastsRelations = relations(forecasts, ({ one }) => ({
  company: one(companies, {
    fields: [forecasts.companyId],
    references: [companies.id],
  }),
}));

export const logsRelations = relations(logs, ({ one }) => ({
  user: one(users, {
    fields: [logs.userId],
    references: [users.id],
  }),
}));
