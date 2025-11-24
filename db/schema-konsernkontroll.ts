
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* -------------------------------------------------
   2. USERS (Brukere)
---------------------------------------------------*/
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  authId: varchar("auth_id", { length: 255 }).unique().notNull(), 
  email: varchar("email", { length: 255 }).notNull(),
  fullName: varchar("full_name", { length: 255 }),
  role: userRoleEnum("role").default("leader").notNull(),
  groupId: integer("group_id").references(() => groups.id).notNull(),
  companyId: integer("company_id").references(() => companies.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/* -------------------------------------------------
   3. COMPANIES (Selskaper)
---------------------------------------------------*/
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").references(() => groups.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(), 
  manager: varchar("manager", { length: 255 }).notNull(), 
  
  // Økonomiske nøkkeltall (Snapshot)
  revenue: integer("revenue").default(0).notNull(),
  expenses: integer("expenses").default(0).notNull(),
  resultYtd: integer("result_ytd").default(0).notNull(),
  
  // Budsjettlogikk
  budgetTotal: integer("budget_total").default(0).notNull(), 
  budgetMode: budgetModeEnum("budget_mode").default("annual"),
  budgetMonths: json("budget_months").$type<number[]>().default([0,0,0,0,0,0,0,0,0,0,0,0]),

  liquidity: integer("liquidity").default(0).notNull(),
  receivables: integer("receivables").default(0).notNull(), // Fordringer
  accountsPayable: integer("accounts_payable").default(0).notNull(), // Leverandørgjeld
  
  liquidityDate: varchar("liquidity_date", { length: 20 }), 
  receivablesDate: varchar("receivables_date", { length: 20 }),
  accountsPayableDate: varchar("accounts_payable_date", { length: 20 }),
  
  // Analyse
  trendHistory: numeric("trend_history", { precision: 5, scale: 2 }).default("0"), 
  
  // Cache fra siste rapport
  lastReportDate: varchar("last_report_date", { length: 20 }),
  lastReportBy: varchar("last_report_by", { length: 255 }),
  currentComment: text("current_comment"), 
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* -------------------------------------------------
   4. REPORTS (Rapporteringslogg)
---------------------------------------------------*/
export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  submittedByUserId: integer("submitted_by_user_id").references(() => users.id),
  authorName: varchar("author_name", { length: 255 }), 
  
  // Made these nullable to allow partial reporting
  revenue: integer("revenue"),
  expenses: integer("expenses"),
  resultYtd: integer("result_ytd"),
  
  liquidity: integer("liquidity"),
  receivables: integer("receivables"),
  accountsPayable: integer("accounts_payable"),
  
  liquidityDate: varchar("liquidity_date", { length: 20 }),
  receivablesDate: varchar("receivables_date", { length: 20 }),
  accountsPayableDate: varchar("accounts_payable_date", { length: 20 }),
  
  comment: text("comment"),
  source: varchar("source", { length: 50 }).default("Manuell"), 
  
  status: reportStatusEnum("status").default("submitted"),
  
  // Approval flow
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
  month: varchar("month", { length: 10 }).notNull(), // "YYYY-MM"
  estimatedReceivables: integer("estimated_receivables").default(0), // Forventet inn
  estimatedPayables: integer("estimated_payables").default(0), // Forventet ut
  updatedAt: timestamp("updated_at").defaultNow(),
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
  reports: many(reports),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  group: one(groups, {
    fields: [companies.groupId],
    references: [groups.id],
  }),
  users: many(users),
  reports: many(reports),
  forecasts: many(forecasts),
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
