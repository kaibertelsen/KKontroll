
export interface CompanyData {
  id: number;
  name: string; // Acronym e.g., VPS
  manager: string; // e.g., Kai
  resultYTD: number;
  budgetTotal: number; // Annual budget
  liquidity: number;
  liquidityDate: string; // Date for liquidity snapshot
  lastReportDate: string;
  lastReportBy: string;
  comment: string;
  trendHistory: number; // Percentage change vs same period last year (e.g. 12 for +12%)
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
  result: number;
  liquidity: number;
  source: string;
  approvedBy?: string;
  approvedAt?: string;
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