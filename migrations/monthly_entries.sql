-- Migration: monthly_entries table
-- Run this once in your Neon database console.

CREATE TABLE IF NOT EXISTS monthly_entries (
  id               SERIAL PRIMARY KEY,
  company_id       INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  year             INTEGER NOT NULL,
  month            INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  revenue          BIGINT NOT NULL DEFAULT 0,
  expenses         BIGINT NOT NULL DEFAULT 0,
  liquidity        BIGINT NOT NULL DEFAULT 0,
  receivables      BIGINT NOT NULL DEFAULT 0,
  accounts_payable BIGINT NOT NULL DEFAULT 0,
  salary_expenses  BIGINT NOT NULL DEFAULT 0,
  public_fees      BIGINT NOT NULL DEFAULT 0,
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (company_id, year, month)
);
