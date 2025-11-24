
export interface CompanyData {
  id: number;
  name: string; // Acronym e.g., VPS
  manager: string; // e.g., Kai
  resultYTD: number;
  budgetTotal: number; // Annual budget (Calculated sum of months)
  budgetMode: 'annual' | 'quarterly' | 'monthly';
  budgetMonths: number[]; // Array of 12 numbers [Jan, Feb, ... Dec]
  revenue: number; // Omsetning
  expenses: number; // Kostnader
  liquidity: number;
  receivables: number; // Fordringer
  accountsPayable: number; // Leverandørgjeld
  liquidityDate: string; // Date for liquidity snapshot
  receivablesDate?: string; // Date for receivables snapshot
  accountsPayableDate?: string; // Date for payables snapshot
  lastReportDate: string;
  lastReportBy: string;
  comment: string;
  trendHistory: number; // Percentage change vs same period last year
}

export interface ComputedCompanyData extends CompanyData {
  calculatedBudgetYTD: number;
  calculatedDeviationPercent: number;
}

export interface UserData {
  id: number;
  authId: string;
  email: string;
  fullName: string;
  role: 'controller' | 'leader';
  groupId: number;
  companyId?: number | null; // Optional, for leaders
}

export interface ReportLogItem {
  id: number;
  date: string;
  author: string;
  comment: string;
  status: 'submitted' | 'approved' | 'draft';
  // All financials are now optional to support partial reporting
  result?: number | null;
  liquidity?: number | null;
  revenue?: number | null;
  expenses?: number | null;
  receivables?: number | null;
  accountsPayable?: number | null;
  
  liquidityDate?: string;
  receivablesDate?: string;
  accountsPayableDate?: string;
  
  source: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface ForecastItem {
  id?: number;
  companyId: number;
  month: string; // YYYY-MM
  estimatedReceivables: number;
  estimatedPayables: number;
}

export enum SortField {
  RESULT = 'RESULT',
  DEVIATION = 'DEVIATION',
  LIQUIDITY = 'LIQUIDITY',
  DEFAULT = 'DEFAULT' // ID order
}

export enum ViewMode {
  GRID = 'GRID',
  ANALYTICS = 'ANALYTICS',
  CONTROL = 'CONTROL',
  ADMIN = 'ADMIN',
  USER_ADMIN = 'USER_ADMIN'
}

export type StatusType = 'success' | 'warning' | 'danger';
