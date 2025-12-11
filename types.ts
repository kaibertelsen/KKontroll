







export interface CompanyData {
  id: number;
  name: string; 
  fullName?: string; 
  manager: string; 
  sortOrder?: number; // Added for ordering
  resultYTD: number;
  budgetTotal: number; 
  budgetMode: 'annual' | 'quarterly' | 'monthly';
  budgetMonths: number[]; 
  revenue: number; 
  expenses: number; 
  pnlDate?: string; 
  liquidity: number;
  receivables: number; 
  accountsPayable: number;
  publicFees: number; // New field for Offentlige Avgifter
  liquidityDate: string; 
  receivablesDate?: string; 
  accountsPayableDate?: string;
  publicFeesDate?: string; // New field
  lastReportDate: string;
  lastReportBy: string;
  comment: string;
  trendHistory: number; 
  
  prevLiquidity?: number;
  prevDeviation?: number;
}

export interface ComputedCompanyData extends CompanyData {
  calculatedBudgetYTD: number;
  calculatedDeviationPercent: number;
}

export interface UserData {
  id: number;
  email: string;
  password?: string; 
  fullName: string;
  role: 'controller' | 'leader';
  groupId: number;
  companyId?: number | null; // Legacy single company
  companyIds?: number[]; // New multi-company support
}

export interface ReportLogItem {
  id: number;
  companyId?: number;
  date: string;
  author: string;
  comment: string;
  status: 'submitted' | 'approved' | 'draft';
  
  result?: number | null;
  liquidity?: number | null;
  revenue?: number | null;
  expenses?: number | null;
  
  pnlDate?: string; 

  receivables?: number | null;
  accountsPayable?: number | null;
  publicFees?: number | null; // New field
  
  liquidityDate?: string;
  receivablesDate?: string;
  accountsPayableDate?: string;
  publicFeesDate?: string; // New field
  
  source: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface ForecastItem {
  id?: number;
  companyId: number;
  month: string; 
  monthName?: string; 
  estimatedReceivables: number;
  estimatedPayables: number;
}

export enum SortField {
  RESULT = 'RESULT',
  DEVIATION = 'DEVIATION',
  LIQUIDITY = 'LIQUIDITY',
  DEFAULT = 'DEFAULT' 
}

export enum ViewMode {
  GRID = 'GRID',
  ANALYTICS = 'ANALYTICS',
  CONTROL = 'CONTROL',
  ADMIN = 'ADMIN',
  USER_ADMIN = 'USER_ADMIN'
}

export type StatusType = 'success' | 'warning' | 'danger';