import React, { useState, useEffect, useMemo } from 'react';
import { ComputedCompanyData, ReportLogItem, ForecastItem, CompanyData, MonthlyEntryData } from '../types';
import { formatCurrency } from '../constants';
import { ArrowLeft, Building2, User, History, TrendingUp, TrendingDown, Target, Wallet, AlertCircle, Plus, Save, X, CheckCircle, Clock, Edit, Unlock, BarChart3, ArrowUpRight, ArrowDownRight, Activity, LineChart, Calendar, Trash2, Eye, Landmark, RefreshCw, Banknote, FolderOpen } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, Line, ComposedChart 
} from 'recharts';

interface CompanyDetailViewProps {
  company: ComputedCompanyData;
  reports: ReportLogItem[];
  forecasts: ForecastItem[];
  userRole: 'controller' | 'leader';
  onBack: () => void;
  onReportSubmit: (report: any) => void;
  onApproveReport: (reportId: number) => void;
  onUnlockReport?: (reportId: number) => void; 
  onDeleteReport: (reportId: number) => void; 
  onForecastSubmit: (forecasts: ForecastItem[]) => void;
  onUpdateCompany: (company: CompanyData) => void;
  onRefresh?: () => Promise<void>;
  hasProjectsModule?: boolean;
  onOpenProjects?: () => void;
  onSaveMonthlyEntry?: (entry: MonthlyEntryData) => Promise<void>;
}

const toInputDate = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('-')) return dateStr; 
    const parts = dateStr.split('.');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return '';
};

const fromInputDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const CompanyDetailView: React.FC<CompanyDetailViewProps> = ({ company, reports, forecasts, userRole, onBack, onReportSubmit, onApproveReport, onUnlockReport, onDeleteReport, onForecastSubmit, onUpdateCompany, onRefresh, hasProjectsModule, onOpenProjects, onSaveMonthlyEntry }) => {
  
  console.log("CompanyDetailView rendering for:", company.name);

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<ReportLogItem | null>(null);
  
  const [isForecastModalOpen, setIsForecastModalOpen] = useState(false);
  const [forecastForm, setForecastForm] = useState<ForecastItem[]>([]);

  // Refresh State
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Full-year chart toggle
  const [showFullYear, setShowFullYear] = useState(false);

  // Forenklet Rapport Modal State
  const [isForenkletOpen, setIsForenkletOpen] = useState(false);
  const [forenkletSaving, setForenkletSaving] = useState(false);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [forenkletForm, setForenkletForm] = useState({
    year: currentYear,
    month: currentMonth,
    revenue: 0,
    expenses: 0,
    liquidity: 0,
    receivables: 0,
    accountsPayable: 0,
    salaryExpenses: 0,
    publicFees: 0,
  });

  const handleForenkletSubmit = async () => {
    if (!onSaveMonthlyEntry) return;
    setForenkletSaving(true);
    try {
      await onSaveMonthlyEntry({
        companyId: company.id,
        year: forenkletForm.year,
        month: forenkletForm.month,
        revenue: forenkletForm.revenue,
        expenses: forenkletForm.expenses,
        liquidity: forenkletForm.liquidity,
        receivables: forenkletForm.receivables,
        accountsPayable: forenkletForm.accountsPayable,
        salaryExpenses: forenkletForm.salaryExpenses,
        publicFees: forenkletForm.publicFees,
      });
      setIsForenkletOpen(false);
    } finally {
      setForenkletSaving(false);
    }
  };

  // Budget Modal State
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [budgetFormData, setBudgetFormData] = useState<{
      budgetType: 'standard' | 'scenario';
      entryMode: 'annual' | 'quarterly' | 'monthly';
      annual: number;
      quarterly: number[];
      monthly: number[];
      scenarioLowAnnual: number;
      scenarioHighAnnual: number;
      scenarioLowQuarterly: number[];
      scenarioHighQuarterly: number[];
      scenarioLowMonthly: number[];
      scenarioHighMonthly: number[];
  }>({
      budgetType: 'standard',
      entryMode: 'annual',
      annual: 0,
      quarterly: [0,0,0,0],
      monthly: Array(12).fill(0),
      scenarioLowAnnual: 0,
      scenarioHighAnnual: 0,
      scenarioLowQuarterly: [0,0,0,0],
      scenarioHighQuarterly: [0,0,0,0],
      scenarioLowMonthly: Array(12).fill(0),
      scenarioHighMonthly: Array(12).fill(0),
  });

  // Initialize Budget Form Data — only when modal OPENS (not on every company update)
  useEffect(() => {
      if (!isBudgetModalOpen) return;

      const bMonths = company.budgetMonths || Array(12).fill(0);
      const total = company.budgetTotal || 0;
      const q = [0,0,0,0];
      for(let i=0; i<12; i++) q[Math.floor(i/3)] += Number(bMonths[i]) || 0;

      const isScenario = company.budgetType === 'scenario';

      // If scenario: use saved low/high. Otherwise: pre-fill realist with standard budget.
      const lowMonths = isScenario
          ? (company.budgetMonthsLow || Array(12).fill(0)).map(Number)
          : [...bMonths];
      const highMonths = (company.budgetMonthsHigh || Array(12).fill(0)).map(Number);
      const lowTotal = lowMonths.reduce((a: number, b: number) => a + b, 0);
      const highTotal = highMonths.reduce((a: number, b: number) => a + b, 0);
      const lowQ = [0,0,0,0];
      const highQ = [0,0,0,0];
      for(let i=0; i<12; i++) { lowQ[Math.floor(i/3)] += lowMonths[i]; highQ[Math.floor(i/3)] += highMonths[i]; }

      setBudgetFormData({
          budgetType: isScenario ? 'scenario' : 'standard',
          entryMode: company.budgetMode || 'annual',
          annual: total,
          monthly: [...bMonths],
          quarterly: q,
          scenarioLowAnnual: isScenario ? lowTotal : total,
          scenarioHighAnnual: highTotal,
          scenarioLowQuarterly: isScenario ? lowQ : [...q],
          scenarioHighQuarterly: highQ,
          scenarioLowMonthly: [...lowMonths],
          scenarioHighMonthly: [...highMonths],
      });
  }, [isBudgetModalOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const distributeAnnual = (annual: number): number[] => {
      const perMonth = Math.round(annual / 12);
      const months = Array(12).fill(perMonth);
      months[11] += annual - perMonth * 12;
      return months;
  };

  const distributeQuarterly = (quarters: number[]): number[] => {
      const months = Array(12).fill(0);
      for (let q = 0; q < 4; q++) {
          const perMonth = Math.round(quarters[q] / 3);
          months[q*3] = perMonth;
          months[q*3+1] = perMonth;
          months[q*3+2] = quarters[q] - perMonth * 2;
      }
      return months;
  };

  const handleBudgetSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const { budgetType, entryMode } = budgetFormData;

      if (budgetType === 'scenario') {
          let lowMonths: number[], highMonths: number[];
          if (entryMode === 'annual') {
              lowMonths = distributeAnnual(budgetFormData.scenarioLowAnnual);
              highMonths = distributeAnnual(budgetFormData.scenarioHighAnnual);
          } else if (entryMode === 'quarterly') {
              lowMonths = distributeQuarterly(budgetFormData.scenarioLowQuarterly);
              highMonths = distributeQuarterly(budgetFormData.scenarioHighQuarterly);
          } else {
              lowMonths = [...budgetFormData.scenarioLowMonthly];
              highMonths = [...budgetFormData.scenarioHighMonthly];
          }
          const lowTotal = lowMonths.reduce((a,b) => a+b, 0);
          const highTotal = highMonths.reduce((a,b) => a+b, 0);
          const midTotal = (lowTotal + highTotal) / 2;
          const midMonths = lowMonths.map((v, i) => Math.round((v + highMonths[i]) / 2));
          onUpdateCompany({
              ...company,
              budgetType: 'scenario',
              budgetMode: entryMode,
              budgetTotal: midTotal,
              budgetMonths: midMonths,
              budgetMonthsLow: lowMonths,
              budgetMonthsHigh: highMonths,
          });
          setIsBudgetModalOpen(false);
          return;
      }

      let finalMonths = Array(12).fill(0);
      let finalTotal = 0;
      if (entryMode === 'annual') {
          finalTotal = budgetFormData.annual;
          finalMonths = distributeAnnual(finalTotal);
      } else if (entryMode === 'quarterly') {
          finalMonths = distributeQuarterly(budgetFormData.quarterly);
          finalTotal = finalMonths.reduce((a,b) => a+b, 0);
      } else {
          finalMonths = [...budgetFormData.monthly];
          finalTotal = finalMonths.reduce((a,b) => a+b, 0);
      }

      onUpdateCompany({
          ...company,
          budgetType: 'standard',
          budgetTotal: finalTotal,
          budgetMode: entryMode,
          budgetMonths: finalMonths,
          budgetMonthsLow: Array(12).fill(0),
          budgetMonthsHigh: Array(12).fill(0),
      });
      setIsBudgetModalOpen(false);
  };

  const handleRefresh = async () => {
      if (onRefresh) {
          setIsRefreshing(true);
          await onRefresh();
          setTimeout(() => setIsRefreshing(false), 500); // Visual delay
      }
  };

  // --- HISTORY CHART DATA GENERATION ---
  const historyData = useMemo(() => {
      const data = [];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des'];
      
      // SAFE PARSING OF BUDGET DATA
      let bMonths: number[] = [];
      // @ts-ignore
      const raw = company.budgetMonths || company.budget_months;

      if (Array.isArray(raw)) {
          bMonths = raw.map(x => Number(x) || 0);
      } else if (typeof raw === 'object' && raw !== null) {
          // Handle object case {0: 100, 1: 200}
          bMonths = Object.values(raw).map(Number);
      } else if (typeof raw === 'string') {
          // Handle Postgres Array string "{100,200}" or JSON "[100,200]"
          let cleanStr = raw.trim();
          if (cleanStr.startsWith('{') && cleanStr.endsWith('}')) {
              cleanStr = cleanStr.replace('{', '[').replace('}', ']');
          }
          try {
              const parsed = JSON.parse(cleanStr);
              if (Array.isArray(parsed)) bMonths = parsed.map(Number);
          } catch(e) {
              // Fallback split
              const parts = cleanStr.replace(/[\[\]\{\}]/g, '').split(',');
              if (parts.length > 0) bMonths = parts.map(Number);
          }
      }

      if (bMonths.length !== 12) bMonths = Array(12).fill(0);

      // Force distribute total if months are empty or invalid
      const total = Number(company.budgetTotal || 0);
      const sum = bMonths.reduce((a, b) => a + b, 0);

      if ((sum === 0 || isNaN(sum)) && total > 0) {
          const perMonth = Math.round(total / 12);
          bMonths = Array(12).fill(perMonth);
          bMonths[11] += (total - (perMonth * 12));
      }

      const now = new Date();
      const currentMonthIndex = now.getMonth(); 
      
      const avgResultPerMonth = company.resultYTD / (currentMonthIndex + 1);
      
      const isScenario = company.budgetType === 'scenario';
      const bMonthsLow: number[] = (isScenario && company.budgetMonthsLow) ? company.budgetMonthsLow.map(x => Number(x) || 0) : Array(12).fill(0);
      const bMonthsHigh: number[] = (isScenario && company.budgetMonthsHigh) ? company.budgetMonthsHigh.map(x => Number(x) || 0) : Array(12).fill(0);

      for (let i = 0; i <= currentMonthIndex; i++) {
        const variance = 0.8 + Math.random() * 0.4;
        const result = Math.round(avgResultPerMonth * variance);
        const budget = Math.round(Number(bMonths[i]) || 0);

        const prevResult = i > 0 ? data[i-1].cumResult : 0;
        const prevBudget = i > 0 ? data[i-1].cumBudget : 0;
        const prevBudgetLow = i > 0 ? (data[i-1].cumBudgetLow ?? 0) : 0;
        const prevBudgetHigh = i > 0 ? (data[i-1].cumBudgetHigh ?? 0) : 0;

        const liquidity = Math.round(company.liquidity * (0.9 + Math.random() * 0.2));

        data.push({
          month: months[i],
          result: result,
          budget: budget,
          cumResult: prevResult + result,
          cumBudget: prevBudget + budget,
          cumBudgetLow: isScenario ? prevBudgetLow + Math.round(Number(bMonthsLow[i]) || 0) : undefined,
          cumBudgetHigh: isScenario ? prevBudgetHigh + Math.round(Number(bMonthsHigh[i]) || 0) : undefined,
          liquidity: liquidity,
          type: 'history'
        });
      }
      
      if(data.length > 0) {
          data[data.length - 1].cumResult = company.resultYTD;
          data[data.length - 1].liquidity = company.liquidity;
      }
      return data;
  }, [company]);

  // --- FULL YEAR CHART DATA ---
  const fullYearData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des'];
    const now = new Date();
    const currentMonthIndex = now.getMonth();

    let bMonths: number[] = [];
    // @ts-ignore
    const raw = company.budgetMonths || company.budget_months;
    if (Array.isArray(raw)) bMonths = raw.map(x => Number(x) || 0);
    else if (typeof raw === 'string') {
      let s = raw.trim().replace('{', '[').replace('}', ']');
      try { const p = JSON.parse(s); if (Array.isArray(p)) bMonths = p.map(Number); } catch { bMonths = s.replace(/[\[\]\{\}]/g,'').split(',').map(Number); }
    }
    if (bMonths.length !== 12) bMonths = Array(12).fill(0);
    const total = Number(company.budgetTotal || 0);
    const sum = bMonths.reduce((a, b) => a + b, 0);
    if ((sum === 0 || isNaN(sum)) && total > 0) {
      const per = Math.round(total / 12);
      bMonths = Array(12).fill(per);
      bMonths[11] += total - per * 12;
    }

    const isScenario = company.budgetType === 'scenario';
    const bMonthsLow: number[] = (isScenario && company.budgetMonthsLow) ? company.budgetMonthsLow.map(x => Number(x) || 0) : Array(12).fill(0);
    const bMonthsHigh: number[] = (isScenario && company.budgetMonthsHigh) ? company.budgetMonthsHigh.map(x => Number(x) || 0) : Array(12).fill(0);

    // Build from historyData for past months, extend with budget-only for future
    const data: any[] = historyData.map(d => ({ ...d }));

    let prevCumBudget = data.length > 0 ? data[data.length - 1].cumBudget : 0;
    let prevCumLow = data.length > 0 ? (data[data.length - 1].cumBudgetLow ?? 0) : 0;
    let prevCumHigh = data.length > 0 ? (data[data.length - 1].cumBudgetHigh ?? 0) : 0;

    for (let i = currentMonthIndex + 1; i < 12; i++) {
      prevCumBudget += Math.round(Number(bMonths[i]) || 0);
      prevCumLow += isScenario ? Math.round(Number(bMonthsLow[i]) || 0) : 0;
      prevCumHigh += isScenario ? Math.round(Number(bMonthsHigh[i]) || 0) : 0;
      data.push({
        month: months[i],
        result: null,
        cumResult: null,
        cumBudget: prevCumBudget,
        cumBudgetLow: isScenario ? prevCumLow : undefined,
        cumBudgetHigh: isScenario ? prevCumHigh : undefined,
        type: 'forecast',
      });
    }
    return data;
  }, [historyData, company]);

  // --- FORECAST CHART DATA PREPARATION ---
  const forecastChartData = useMemo(() => {
      const combinedData = historyData.map(d => ({
          name: d.month,
          liquidity: d.liquidity,
          forecast: null as number | null,
          type: 'history'
      }));

      const now = new Date();
      let runningLiquidity = company.liquidity; 

      const futureData = [];
      for (let i = 1; i <= 6; i++) {
          const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
          const monthStr = futureDate.toISOString().slice(0, 7); 
          const monthName = futureDate.toLocaleString('no-NO', { month: 'short' });
          
          const forecastItem = forecasts.find(f => f.month === monthStr);
          const estIn = forecastItem ? forecastItem.estimatedReceivables : 0;
          const estOut = forecastItem ? forecastItem.estimatedPayables : 0;
          
          runningLiquidity = runningLiquidity + estIn - estOut;

          futureData.push({
              name: monthName,
              liquidity: null as number | null,
              forecast: runningLiquidity,
              type: 'forecast'
          });
      }

      if(futureData.length > 0) {
          const lastHistory = combinedData[combinedData.length - 1];
          lastHistory.forecast = lastHistory.liquidity;
      }

      return [...combinedData, ...futureData];
  }, [historyData, company.liquidity, forecasts]);

  // Working Capital Formula: (Liquidity + Receivables) - (Payables + PublicFees)
  const statusValue = (company.receivables + company.liquidity) - (company.accountsPayable + (company.publicFees || 0));

  // --- REPORTING FORM LOGIC ---
  const [reportingMode, setReportingMode] = useState<'ytd' | 'monthly'>('ytd');
  
  const [formData, setFormData] = useState<{
      revenue: string | number;
      expenses: string | number;
      resultYTD: string | number;
      pnlDate: string; 
      liquidity: string | number;
      receivables: string | number;
      accountsPayable: string | number;
      publicFees: string | number; 
      salaryExpenses: string | number; // Added
      liquidityDate: string;
      receivablesDate: string;
      accountsPayableDate: string;
      publicFeesDate: string;
      salaryExpensesDate: string; // Added
      comment: string;
      source: string;
      reportDate: string;
  }>({
      revenue: '',
      expenses: '',
      resultYTD: '',
      pnlDate: new Date().toLocaleDateString('no-NO'), 
      liquidity: '',
      receivables: '',
      accountsPayable: '',
      publicFees: '', 
      salaryExpenses: '', // Added
      liquidityDate: new Date().toLocaleDateString('no-NO'),
      receivablesDate: new Date().toLocaleDateString('no-NO'),
      accountsPayableDate: new Date().toLocaleDateString('no-NO'),
      publicFeesDate: new Date().toLocaleDateString('no-NO'),
      salaryExpensesDate: new Date().toLocaleDateString('no-NO'), // Added
      comment: '',
      source: 'Manuell',
      reportDate: new Date().toISOString().split('T')[0]
  });

  const [monthlyInputs, setMonthlyInputs] = useState({
      revenue: '',
      expenses: ''
  });

  const isReadOnly = editingReport?.status === 'approved';

  useEffect(() => {
      if (reportingMode === 'ytd') {
          const rev = Number(formData.revenue) || 0;
          const exp = Number(formData.expenses) || 0;
          if (formData.revenue === '' && formData.expenses === '') {
              setFormData(prev => ({ ...prev, resultYTD: 0 }));
          } else {
              setFormData(prev => ({ ...prev, resultYTD: rev - exp }));
          }
      } else {
          const mRev = Number(monthlyInputs.revenue) || 0;
          const mExp = Number(monthlyInputs.expenses) || 0;
          const newTotalRevenue = company.revenue + mRev;
          const newTotalExpenses = company.expenses + mExp;
          setFormData(prev => ({
              ...prev,
              revenue: newTotalRevenue,
              expenses: newTotalExpenses,
              resultYTD: newTotalRevenue - newTotalExpenses
          }));
      }
  }, [formData.revenue, formData.expenses, monthlyInputs, reportingMode, company.revenue, company.expenses]);

  useEffect(() => {
      if (editingReport) {
          setReportingMode('ytd'); 
          setFormData({
              revenue: editingReport.revenue ?? '',
              expenses: editingReport.expenses ?? '',
              resultYTD: editingReport.result ?? '',
              pnlDate: editingReport.pnlDate || new Date().toLocaleDateString('no-NO'),
              liquidity: editingReport.liquidity ?? '',
              receivables: editingReport.receivables ?? '',
              accountsPayable: editingReport.accountsPayable ?? '',
              publicFees: editingReport.publicFees ?? '', 
              salaryExpenses: editingReport.salaryExpenses ?? '', // Added
              liquidityDate: editingReport.liquidityDate || new Date().toLocaleDateString('no-NO'),
              receivablesDate: editingReport.receivablesDate || new Date().toLocaleDateString('no-NO'),
              accountsPayableDate: editingReport.accountsPayableDate || new Date().toLocaleDateString('no-NO'),
              publicFeesDate: editingReport.publicFeesDate || new Date().toLocaleDateString('no-NO'),
              salaryExpensesDate: editingReport.salaryExpensesDate || new Date().toLocaleDateString('no-NO'), // Added
              comment: editingReport.comment,
              source: editingReport.source,
              reportDate: editingReport.date 
          });
      } else {
          setReportingMode('ytd');
          setMonthlyInputs({ revenue: '', expenses: '' });
          setFormData({
            revenue: '',
            expenses: '',
            resultYTD: '',
            pnlDate: new Date().toLocaleDateString('no-NO'),
            liquidity: '',
            receivables: '',
            accountsPayable: '',
            publicFees: '',
            salaryExpenses: '', // Added
            liquidityDate: new Date().toLocaleDateString('no-NO'),
            receivablesDate: new Date().toLocaleDateString('no-NO'),
            accountsPayableDate: new Date().toLocaleDateString('no-NO'),
            publicFeesDate: new Date().toLocaleDateString('no-NO'),
            salaryExpensesDate: new Date().toLocaleDateString('no-NO'), // Added
            comment: '',
            source: 'Manuell',
            reportDate: new Date().toISOString().split('T')[0]
        });
      }
  }, [editingReport, isReportModalOpen]);

  useEffect(() => {
      if(isForecastModalOpen) {
          const next6Months = [];
          const now = new Date();
          for (let i = 1; i <= 6; i++) {
              const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
              const monthStr = futureDate.toISOString().slice(0, 7); 
              
              const existing = forecasts.find(f => f.month === monthStr);
              
              next6Months.push({
                  id: existing?.id, 
                  companyId: company.id,
                  month: monthStr,
                  monthName: futureDate.toLocaleString('no-NO', { month: 'long', year: 'numeric' }),
                  estimatedReceivables: existing ? existing.estimatedReceivables : 0,
                  estimatedPayables: existing ? existing.estimatedPayables : 0,
              });
          }
          setForecastForm(next6Months);
      }
  }, [isForecastModalOpen, company.id, forecasts]);

  const handleForecastChange = (index: number, field: 'estimatedReceivables' | 'estimatedPayables', value: number) => {
      const updated = [...forecastForm];
      updated[index] = { ...updated[index], [field]: value };
      setForecastForm(updated);
  };

  const onSaveForecast = (e: React.FormEvent) => {
      e.preventDefault();
      onForecastSubmit(forecastForm);
      setIsForecastModalOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (isReadOnly) return;
      
      const payload = {
          ...formData,
          revenue: formData.revenue === '' ? undefined : Number(formData.revenue),
          expenses: formData.expenses === '' ? undefined : Number(formData.expenses),
          resultYTD: formData.resultYTD === '' ? undefined : Number(formData.resultYTD),
          liquidity: formData.liquidity === '' ? undefined : Number(formData.liquidity),
          receivables: formData.receivables === '' ? undefined : Number(formData.receivables),
          accountsPayable: formData.accountsPayable === '' ? undefined : Number(formData.accountsPayable),
          publicFees: formData.publicFees === '' ? undefined : Number(formData.publicFees),
          salaryExpenses: formData.salaryExpenses === '' ? undefined : Number(formData.salaryExpenses), // Added
          id: editingReport ? editingReport.id : undefined
      };
      
      onReportSubmit(payload);
      setIsReportModalOpen(false);
      setEditingReport(null);
  };

  const handleOpenNewReport = () => {
      setEditingReport(null);
      setIsReportModalOpen(true);
  };

  const handleEditReport = (report: ReportLogItem) => {
      setEditingReport(report);
      setIsReportModalOpen(true);
  };

  const StatCard = ({ icon: Icon, label, value, subText, highlight, valueColor, onEdit }: any) => (
    <div className="bg-white dark:bg-slate-800 p-3 sm:p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between h-full relative group transition-all">
        {onEdit && (
            <button 
                onClick={onEdit}
                className="absolute top-2 right-2 sm:top-3 sm:right-3 text-slate-300 hover:text-sky-600 sm:opacity-0 sm:group-hover:opacity-100 opacity-100 transition-all"
                title="Rediger"
            >
                <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
        )}
        <div>
            <div className="flex items-center gap-1.5 sm:gap-2 text-slate-500 dark:text-slate-400 mb-1 sm:mb-2">
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider truncate">{label}</span>
            </div>
            <p className={`text-lg sm:text-2xl font-bold tabular-nums truncate ${valueColor ? valueColor : 'text-slate-900 dark:text-white'}`}>
                {formatCurrency(value)}
            </p>
        </div>
        {subText && (
            <p className={`text-[10px] sm:text-xs mt-0.5 sm:mt-2 truncate ${highlight ? (highlight > 0 ? 'text-emerald-600' : 'text-rose-600') : 'text-slate-400'}`}>
                {subText}
            </p>
        )}
    </div>
  );

  const renderReportValues = (report: ReportLogItem) => {
      const items = [];
      if (report.result != null) items.push({ label: 'Resultat', value: report.result });
      if (report.liquidity != null) items.push({ label: 'Likviditet', value: report.liquidity });
      if (report.revenue != null) items.push({ label: 'Omsetning', value: report.revenue });
      if (report.receivables != null) items.push({ label: 'Fordringer', value: report.receivables });
      if (report.accountsPayable != null) items.push({ label: 'Lev.Gjeld', value: report.accountsPayable });
      if (report.salaryExpenses != null) items.push({ label: 'Lønn', value: report.salaryExpenses }); // Added
      if (report.publicFees != null) items.push({ label: 'Off.Avg', value: report.publicFees });

      if (items.length === 0) return <span className="text-sm text-slate-400 italic">Ingen tall rapportert</span>;

      return (
          <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 max-w-md">
              {items.map((item, idx) => (
                  <div key={idx} className="text-sm">
                      <span className="text-xs text-slate-400 uppercase tracking-wider mr-1">{item.label}:</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{formatCurrency(item.value)}</span>
                  </div>
              ))}
          </div>
      );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 animate-in slide-in-from-right-4 duration-500 text-slate-900 dark:text-slate-100">
      
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            {onRefresh && (
                <button
                    onClick={handleRefresh}
                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
                    title="Oppdater data for dette selskapet"
                >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
            )}

            <div className="flex items-center gap-3 ml-2">
              <div className="bg-sky-600 text-white p-2 rounded-lg">
                 <Building2 size={20} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight flex items-baseline gap-2">
                    {company.name}
                    {company.fullName && (
                        <span className="text-sm font-normal text-slate-500 dark:text-slate-400 truncate max-w-[200px] sm:max-w-none">
                            {company.fullName}
                        </span>
                    )}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">Firmaside</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {hasProjectsModule && onOpenProjects && (
              <button
                onClick={onOpenProjects}
                className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm"
              >
                <FolderOpen size={16} />
                Prosjekter
              </button>
            )}
            <div className="hidden sm:flex flex-col items-end text-sm mr-2">
                <span className="text-slate-900 dark:text-white font-medium">{company.manager}</span>
                <span className="text-slate-500 dark:text-slate-400 text-xs">Daglig leder</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        
        <div className="space-y-2 sm:space-y-4 mb-4 sm:mb-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                <StatCard icon={TrendingUp} label="Omsetning YTD" value={company.revenue} />
                <StatCard icon={TrendingDown} label="Kostnader YTD" value={company.expenses} />
                <StatCard icon={BarChart3} label="Resultat YTD" value={company.resultYTD} subText={`Avvik ${company.calculatedDeviationPercent > 0 ? '+' : ''}${company.calculatedDeviationPercent.toFixed(1)}%`} highlight={company.calculatedDeviationPercent}/>
                {company.budgetType === 'scenario' && company.calculatedBudgetYTDLow !== undefined && company.calculatedBudgetYTDHigh !== undefined ? (
                    <div className="bg-white dark:bg-slate-800 p-3 sm:p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between h-full relative group transition-all">
                        {userRole === 'controller' && (
                            <button onClick={() => setIsBudgetModalOpen(true)} className="absolute top-2 right-2 sm:top-3 sm:right-3 text-slate-300 hover:text-sky-600 sm:opacity-0 sm:group-hover:opacity-100 opacity-100 transition-all" title="Rediger">
                                <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>
                        )}
                        <div>
                            <div className="flex items-center gap-1.5 sm:gap-2 text-slate-500 dark:text-slate-400 mb-1 sm:mb-2">
                                <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Budsjett YTD</span>
                            </div>
                            <p className="text-base sm:text-xl font-bold tabular-nums truncate text-slate-900 dark:text-white">
                                <span className="text-rose-500">{formatCurrency(Math.round(company.calculatedBudgetYTDLow))}</span>
                                <span className="text-slate-400 mx-1">–</span>
                                <span className="text-emerald-600">{formatCurrency(Math.round(company.calculatedBudgetYTDHigh))}</span>
                            </p>
                        </div>
                        <p className="text-[10px] sm:text-xs mt-0.5 sm:mt-2 truncate text-purple-500">Scenariobudsjett</p>
                    </div>
                ) : (
                    <StatCard
                        icon={Target}
                        label="Budsjett YTD"
                        value={Math.round(company.calculatedBudgetYTD)}
                        subText={`Årsbudsjett: ${formatCurrency(company.budgetTotal)}`}
                        onEdit={userRole === 'controller' ? () => setIsBudgetModalOpen(true) : undefined}
                    />
                )}
            </div>

            {/* Scenario Budget Banner */}
            {company.budgetType === 'scenario' && company.calculatedBudgetYTDLow !== undefined && company.calculatedBudgetYTDHigh !== undefined && (() => {
                const nedre = Math.round(company.calculatedBudgetYTDLow!);
                const ovre = Math.round(company.calculatedBudgetYTDHigh!);
                const result = company.resultYTD ?? 0;
                const range = ovre - nedre;
                const onTrack = result !== 0 && result >= nedre && result <= ovre;
                const barPct = range > 0 ? Math.max(0, Math.min(100, ((result - nedre) / range) * 100)) : (result >= nedre ? 100 : 0);
                const resultColor = result === 0
                    ? 'text-slate-400 dark:text-slate-500'
                    : onTrack
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : result > ovre
                            ? 'text-sky-600 dark:text-sky-400'
                            : 'text-rose-600 dark:text-rose-400';
                const barColor = result === 0 ? 'bg-slate-200 dark:bg-slate-600' : onTrack ? 'bg-emerald-500' : result < nedre ? 'bg-rose-500' : 'bg-sky-400';
                return (
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-6 py-4 shadow-sm">
                        <div className="flex items-end justify-between mb-3">
                            {/* Nedre */}
                            <div>
                                <div className="text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold mb-1">Nedre</div>
                                <span className="inline-block bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-sm font-bold px-2.5 py-1 rounded-lg">
                                    {formatCurrency(nedre)}
                                </span>
                            </div>
                            {/* Resultat */}
                            <div className="text-center">
                                <div className="text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold mb-1">Resultat</div>
                                <div className={`text-2xl font-extrabold tabular-nums ${resultColor}`}>
                                    {result !== 0 ? formatCurrency(result) : '–'}
                                </div>
                            </div>
                            {/* Øvre */}
                            <div className="text-right">
                                <div className="text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold mb-1">Øvre</div>
                                <span className="inline-block bg-indigo-600 text-white text-sm font-bold px-2.5 py-1 rounded-lg">
                                    {formatCurrency(ovre)}
                                </span>
                            </div>
                        </div>
                        {/* Progress bar */}
                        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${barPct}%` }} />
                        </div>
                    </div>
                );
            })()}

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4">
                <StatCard icon={Wallet} label="Likviditet" value={company.liquidity} subText={company.liquidityDate} />
                <StatCard icon={ArrowUpRight} label="Fordringer" value={company.receivables} subText={company.receivablesDate} />
                <StatCard icon={ArrowDownRight} label="Lev.Gjeld" value={company.accountsPayable} subText={company.accountsPayableDate} />
                <StatCard icon={Banknote} label="Lønn" value={company.salaryExpenses} subText={company.salaryExpensesDate} /> {/* New StatCard */}
                <StatCard icon={Landmark} label="Off.Avg" value={company.publicFees} subText={company.publicFeesDate} />
                
                {/* Arbeidskapital takes up full width on mobile if needed, or flows nicely */}
                <div className="col-span-2 lg:col-span-1">
                    <StatCard icon={Activity} label="Arb.Kapital" value={statusValue} valueColor="text-sky-600 dark:text-sky-400" subText="Likviditet + Fordringer - Gjeld" />
                </div>
            </div>
        </div>

        <div className={`grid grid-cols-1 gap-8 mb-8 ${showFullYear ? 'lg:grid-cols-1' : 'lg:grid-cols-2'}`}>
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Resultatutvikling (Akkumulert)</h3>
                    <button
                        onClick={() => setShowFullYear(v => !v)}
                        className={`text-xs px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-colors ${showFullYear ? 'bg-sky-50 dark:bg-sky-900/30 border-sky-200 dark:border-sky-700 text-sky-700 dark:text-sky-300' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'}`}
                    >
                        <Calendar size={12} />
                        {showFullYear ? 'Skjul' : 'Se hele året'}
                    </button>
                </div>
                <div className={showFullYear ? 'h-[420px]' : 'h-[350px]'}>
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={showFullYear ? fullYearData : historyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorResult" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(val) => `${(val/1000).toFixed(0)}k`} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value: number) => value !== null ? formatCurrency(value) : ''} />
                            <Legend />
                            {showFullYear && (
                                <Area type="monotone" dataKey="cumResult" name="Resultat (Akk)" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorResult)" strokeWidth={2} connectNulls={false} />
                            )}
                            {!showFullYear && (
                                <Area type="monotone" dataKey="cumResult" name="Resultat (Akk)" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorResult)" strokeWidth={2} />
                            )}
                            {company.budgetType === 'scenario' ? (
                                <>
                                    <Line type="monotone" dataKey="cumBudgetLow" name="Realist (Akk)" stroke="#f87171" strokeDasharray="4 4" strokeWidth={2} dot={false} connectNulls={true} isAnimationActive={false} />
                                    <Line type="monotone" dataKey="cumBudgetHigh" name="Optimist (Akk)" stroke="#34d399" strokeDasharray="4 4" strokeWidth={2} dot={false} connectNulls={true} isAnimationActive={false} />
                                </>
                            ) : (
                                <Line type="monotone" dataKey="cumBudget" name="Budsjett (Akk)" stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={2} dot={false} connectNulls={true} isAnimationActive={false} />
                            )}
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

             <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 relative">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Likviditetsprognose</h3>
                    <button 
                        onClick={() => setIsForecastModalOpen(true)}
                        className="text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                    >
                        <Edit size={12} /> Rediger Prognose
                    </button>
                </div>
                <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={forecastChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(val) => `${(val/1000).toFixed(0)}k`} tickLine={false} axisLine={false} />
                            <Tooltip 
                                cursor={{fill: '#f8fafc'}}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                formatter={(value: number) => formatCurrency(value)}
                            />
                            <Legend />
                            <Area type="monotone" dataKey="liquidity" name="Historisk" fill="#10b981" stroke="#10b981" fillOpacity={0.3} />
                            <Line type="monotone" dataKey="forecast" name="Prognose" stroke="#f59e0b" strokeDasharray="5 5" strokeWidth={2} dot={{r: 4}} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-slate-500" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Rapporteringslogg</h3>
                </div>
                <div className="flex items-center gap-2">
                    {onSaveMonthlyEntry && (
                        <button
                            onClick={() => {
                                setForenkletForm({ year: currentYear, month: currentMonth, revenue: 0, expenses: 0, liquidity: 0, receivables: 0, accountsPayable: 0, salaryExpenses: 0, publicFees: 0 });
                                setIsForenkletOpen(true);
                            }}
                            className="bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm flex items-center gap-2 transition-colors"
                        >
                            <Activity className="w-4 h-4" />
                            Forenklet rapport
                        </button>
                    )}
                    <button
                        onClick={handleOpenNewReport}
                        className="bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm flex items-center gap-2 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Ny Rapport
                    </button>
                </div>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {reports.length === 0 && (
                    <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm italic">Ingen rapporter funnet.</div>
                )}
                {reports.map((report) => {
                    const isApproved = report.status === 'approved';
                    const isTripletex = report.source === 'Tripletex';

                    return (
                    <div key={report.id} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-2">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${isTripletex ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-slate-100 dark:bg-slate-700'}`}>
                                    {isTripletex ? (
                                        <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    ) : (
                                        <User className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                                    )}
                                </div>
                                <div>
                                    {isTripletex ? (
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-900 dark:text-white">Tripletex</span>
                                            <span className="text-xs text-slate-500">Sendt: {report.date}</span>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">{report.author}</p>
                                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                <span>Sendt: {report.date}</span>
                                                {report.pnlDate && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="font-semibold text-slate-600 dark:text-slate-300">Tall pr: {report.pnlDate}</span>
                                                    </>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                
                                <div className="hidden sm:block text-right">
                                    {renderReportValues(report)}
                                </div>
                                
                                {isApproved ? (
                                    <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 cursor-help" title={`Godkjent av ${report.approvedBy || 'Ukjent'} ${report.approvedAt ? 'den ' + report.approvedAt : ''}`}>
                                            <CheckCircle size={12} className="mr-1" /> Godkjent
                                        </span>
                                        
                                        <button 
                                            onClick={() => handleEditReport(report)}
                                            className="p-1.5 text-slate-400 hover:text-sky-600 transition-colors"
                                            title="Se rapport"
                                        >
                                            <Eye size={14} />
                                        </button>

                                        {userRole === 'controller' && onUnlockReport && (
                                            <button 
                                                onClick={() => onUnlockReport(report.id)}
                                                className="p-1.5 text-slate-400 hover:text-amber-600 transition-colors"
                                                title="Lås opp rapport"
                                            >
                                                <Unlock size={14} />
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                                            <Clock size={12} className="mr-1" /> Til godkjenning
                                        </span>
                                        {userRole === 'controller' ? (
                                            <button 
                                                onClick={() => onApproveReport(report.id)}
                                                className="text-xs bg-sky-600 hover:bg-sky-500 text-white px-2 py-1 rounded transition-colors"
                                            >
                                                Godkjenn
                                            </button>
                                        ) : null}
                                        
                                        <button 
                                            onClick={() => handleEditReport(report)}
                                            className="p-1.5 text-slate-400 hover:text-sky-600 transition-colors"
                                            title="Rediger rapport"
                                        >
                                            <Edit size={14} />
                                        </button>
                                        
                                        <button 
                                            onClick={() => onDeleteReport(report.id)}
                                            className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                                            title="Slett rapport"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="pl-0 sm:pl-12 mt-2">
                            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed italic">"{report.comment}"</p>
                        </div>
                    </div>
                    );
                })}
            </div>
        </div>

        {isReportModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                            {isReadOnly ? 'Vis Rapport' : (editingReport ? 'Rediger Rapport' : 'Ny Rapport')}
                        </h3>
                        <button onClick={() => setIsReportModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    
                    {!editingReport && !isReadOnly && (
                        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-700/30 border-b border-slate-200 dark:border-slate-700 flex justify-center">
                            <div className="bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-600 flex shadow-sm">
                                <button 
                                    type="button" 
                                    onClick={() => setReportingMode('ytd')}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${reportingMode === 'ytd' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                                >
                                    Akkumulert (YTD)
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => setReportingMode('monthly')}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${reportingMode === 'monthly' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                                >
                                    Legg til Månedstall
                                </button>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        
                        <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl border border-slate-200 dark:border-slate-600 transition-all">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                    <TrendingUp size={14}/> Drift & Resultat {reportingMode === 'monthly' ? '(Denne Måned)' : '(Hittil i år)'}
                                </h4>
                                
                                <div className="flex items-center gap-2">
                                     <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500"><Calendar size={10} className="inline mr-0.5"/> Dato tall:</span>
                                     <input 
                                        type="date" 
                                        disabled={isReadOnly}
                                        className="bg-transparent text-right text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-slate-300 dark:border-slate-600 focus:border-sky-500 outline-none w-24 disabled:opacity-70"
                                        value={toInputDate(formData.pnlDate)} 
                                        onChange={e => setFormData({...formData, pnlDate: fromInputDate(e.target.value)})} 
                                    />
                                </div>
                            </div>
                            
                            {reportingMode === 'monthly' && !isReadOnly && (
                                <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-xs text-blue-700 dark:text-blue-300">
                                    <p className="font-bold mb-1">Månedlig Modus:</p>
                                    <p>Legg inn tallene for <strong>denne måneden</strong>. Vi legger dem automatisk til de eksisterende tallene.</p>
                                    <div className="mt-2 grid grid-cols-2 gap-4 font-mono">
                                        <div>Forrige Omsetning: <strong>{formatCurrency(company.revenue)}</strong></div>
                                        <div>Forrige Kostnader: <strong>{formatCurrency(company.expenses)}</strong></div>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">
                                        {reportingMode === 'monthly' && !isReadOnly ? 'Mnd. Omsetning' : 'Omsetning YTD'}
                                    </label>
                                    <input 
                                        type="number" 
                                        disabled={isReadOnly}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm transition-all focus:ring-2 focus:ring-sky-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-700" 
                                        value={reportingMode === 'ytd' || isReadOnly ? formData.revenue : monthlyInputs.revenue} 
                                        onChange={e => reportingMode === 'ytd' ? setFormData({...formData, revenue: e.target.value}) : setMonthlyInputs({...monthlyInputs, revenue: e.target.value})} 
                                        placeholder="0" 
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">
                                        {reportingMode === 'monthly' && !isReadOnly ? 'Mnd. Kostnader' : 'Kostnader YTD'}
                                    </label>
                                    <input 
                                        type="number" 
                                        disabled={isReadOnly}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm transition-all focus:ring-2 focus:ring-sky-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-700" 
                                        value={reportingMode === 'ytd' || isReadOnly ? formData.expenses : monthlyInputs.expenses} 
                                        onChange={e => reportingMode === 'ytd' ? setFormData({...formData, expenses: e.target.value}) : setMonthlyInputs({...monthlyInputs, expenses: e.target.value})} 
                                        placeholder="0" 
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 mb-1 block">
                                        {reportingMode === 'monthly' && !isReadOnly ? 'Ny Resultat YTD' : 'Resultat YTD'}
                                    </label>
                                    <input 
                                        type="number" 
                                        readOnly
                                        className="w-full bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-500 dark:text-slate-400 text-sm font-bold cursor-not-allowed" 
                                        value={formData.resultYTD} 
                                        title="Resultat beregnes automatisk"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl border border-slate-200 dark:border-slate-600 space-y-4">
                            <h4 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2">
                                <Wallet size={14}/> Likviditet & Balanse (Nå-situasjon)
                            </h4>
                            
                            <div className="grid grid-cols-2 gap-4 items-end">
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Likviditet (Bankinnskudd)</label>
                                    <input type="number" disabled={isReadOnly} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm font-mono disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-700" 
                                        value={formData.liquidity} onChange={e => setFormData({...formData, liquidity: e.target.value})} placeholder="0" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1"><Calendar size={10}/> Dato</label>
                                    <input 
                                        type="date" 
                                        disabled={isReadOnly}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-700" 
                                        value={toInputDate(formData.liquidityDate)} 
                                        onChange={e => setFormData({...formData, liquidityDate: fromInputDate(e.target.value)})} 
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 items-end">
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Kundefordringer</label>
                                    <input type="number" disabled={isReadOnly} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm font-mono disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-700" 
                                        value={formData.receivables} onChange={e => setFormData({...formData, receivables: e.target.value})} placeholder="0" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1"><Calendar size={10}/> Dato</label>
                                    <input 
                                        type="date" 
                                        disabled={isReadOnly}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-700" 
                                        value={toInputDate(formData.receivablesDate)} 
                                        onChange={e => setFormData({...formData, receivablesDate: fromInputDate(e.target.value)})} 
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 items-end">
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Leverandørgjeld</label>
                                    <input type="number" disabled={isReadOnly} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm font-mono disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-700" 
                                        value={formData.accountsPayable} onChange={e => setFormData({...formData, accountsPayable: e.target.value})} placeholder="0" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1"><Calendar size={10}/> Dato</label>
                                    <input 
                                        type="date" 
                                        disabled={isReadOnly}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-700" 
                                        value={toInputDate(formData.accountsPayableDate)} 
                                        onChange={e => setFormData({...formData, accountsPayableDate: fromInputDate(e.target.value)})} 
                                    />
                                </div>
                            </div>
                            
                            {/* Salary Expenses Input Row - Added */}
                            <div className="grid grid-cols-2 gap-4 items-end">
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Lønnskostnad</label>
                                    <input type="number" disabled={isReadOnly} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm font-mono disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-700" 
                                        value={formData.salaryExpenses} onChange={e => setFormData({...formData, salaryExpenses: e.target.value})} placeholder="0" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1"><Calendar size={10}/> Dato</label>
                                    <input 
                                        type="date" 
                                        disabled={isReadOnly}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-700" 
                                        value={toInputDate(formData.salaryExpensesDate)} 
                                        onChange={e => setFormData({...formData, salaryExpensesDate: fromInputDate(e.target.value)})} 
                                    />
                                </div>
                            </div>

                            {/* Offentlige Avgifter Input Row */}
                            <div className="grid grid-cols-2 gap-4 items-end">
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Offentlige Avgifter (MVA/Skatt)</label>
                                    <input type="number" disabled={isReadOnly} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm font-mono disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-700" 
                                        value={formData.publicFees} onChange={e => setFormData({...formData, publicFees: e.target.value})} placeholder="0" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1"><Calendar size={10}/> Dato</label>
                                    <input 
                                        type="date" 
                                        disabled={isReadOnly}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-700" 
                                        value={toInputDate(formData.publicFeesDate)} 
                                        onChange={e => setFormData({...formData, publicFeesDate: fromInputDate(e.target.value)})} 
                                    />
                                </div>
                            </div>

                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Kommentar / Status</label>
                                <textarea rows={3} disabled={isReadOnly} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-700" 
                                    value={formData.comment} onChange={e => setFormData({...formData, comment: e.target.value})} placeholder="Kort beskrivelse av månedens status..." />
                            </div>
                        </div>

                        {!isReadOnly && (
                            <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
                                <button type="submit" className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold shadow-md flex items-center gap-2 transition-transform active:scale-95">
                                    <Save size={18} /> 
                                    {editingReport ? 'Lagre endringer' : 'Send inn rapport'}
                                </button>
                            </div>
                        )}
                    </form>
                </div>
            </div>
        )}

        {isForecastModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Likviditetsprognose</h3>
                        <button onClick={() => setIsForecastModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <form onSubmit={onSaveForecast} className="p-6">
                        <div className="space-y-4">
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                Legg inn forventede innbetalinger (fordringer/salg) og utbetalinger (gjeld/kostnader) for de neste månedene.
                                Prognosen beregnes automatisk ut fra dagens likviditet.
                            </p>
                            
                            <div className="grid grid-cols-3 gap-4 mb-2">
                                <div className="text-xs font-bold uppercase text-slate-400">Måned</div>
                                <div className="text-xs font-bold uppercase text-emerald-600">Forventet Inn (+)</div>
                                <div className="text-xs font-bold uppercase text-rose-600">Forventet Ut (-)</div>
                            </div>

                            {forecastForm.map((item, index) => (
                                <div key={index} className="grid grid-cols-3 gap-4 items-center">
                                    <div className="font-medium text-slate-900 dark:text-white text-sm">
                                        {item.monthName}
                                    </div>
                                    <input 
                                        type="number" 
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm"
                                        value={item.estimatedReceivables}
                                        onChange={(e) => handleForecastChange(index, 'estimatedReceivables', Number(e.target.value))}
                                    />
                                    <input 
                                        type="number" 
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm"
                                        value={item.estimatedPayables}
                                        onChange={(e) => handleForecastChange(index, 'estimatedPayables', Number(e.target.value))}
                                    />
                                </div>
                            ))}
                        </div>
                        
                        <div className="flex justify-end pt-6 border-t border-slate-200 dark:border-slate-700 mt-6 gap-3">
                            <button type="button" onClick={() => setIsForecastModalOpen(false)} className="px-4 py-2 text-slate-600 dark:text-slate-300">Avbryt</button>
                            <button type="submit" className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold shadow-md flex items-center gap-2">
                                <Save size={16} /> Lagre Prognose
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {isBudgetModalOpen && (() => {
            const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des'];
            const isScenario = budgetFormData.budgetType === 'scenario';
            const isMonthly = budgetFormData.entryMode === 'monthly';
            const isQuarterly = budgetFormData.entryMode === 'quarterly';
            // Wide modal for monthly, medium for quarterly, narrow for annual
            const modalWidth = isMonthly ? 'max-w-6xl' : isQuarterly ? 'max-w-xl' : 'max-w-lg';
            const inputCls = (color?: 'rose' | 'emerald') =>
                `w-full bg-slate-50 dark:bg-slate-900 border rounded px-2 py-1.5 text-slate-900 dark:text-white text-xs text-right ${
                    color === 'rose' ? 'border-rose-300 dark:border-rose-700' :
                    color === 'emerald' ? 'border-emerald-300 dark:border-emerald-700' :
                    'border-slate-300 dark:border-slate-600'}`;
            return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full ${modalWidth} border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200`}>

                    {/* Header */}
                    <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Rediger Budsjett</h3>
                        <button onClick={() => setIsBudgetModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    <form onSubmit={handleBudgetSubmit} className="p-6 space-y-5">

                        {/* LEVEL 1 — Budget type */}
                        <div className="grid grid-cols-2 gap-2">
                            <button type="button"
                                onClick={() => setBudgetFormData({...budgetFormData, budgetType: 'standard'})}
                                className={`py-2.5 text-sm font-bold rounded-xl border-2 transition-colors ${!isScenario ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300' : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-300'}`}>
                                Standard
                            </button>
                            <button type="button"
                                onClick={() => {
                                    // Pre-fill Realist fields with existing standard budget when switching to Scenario
                                    const alreadyScenario = budgetFormData.budgetType === 'scenario';
                                    setBudgetFormData({
                                        ...budgetFormData,
                                        budgetType: 'scenario',
                                        scenarioLowAnnual: alreadyScenario ? budgetFormData.scenarioLowAnnual : budgetFormData.annual,
                                        scenarioLowQuarterly: alreadyScenario ? budgetFormData.scenarioLowQuarterly : [...budgetFormData.quarterly],
                                        scenarioLowMonthly: alreadyScenario ? budgetFormData.scenarioLowMonthly : [...budgetFormData.monthly],
                                    });
                                }}
                                className={`py-2.5 text-sm font-bold rounded-xl border-2 transition-colors ${isScenario ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300' : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-300'}`}>
                                Scenariobudsjett
                            </button>
                        </div>

                        {/* LEVEL 2 — Entry mode */}
                        <div className="bg-slate-50 dark:bg-slate-700/30 p-1 rounded-lg flex border border-slate-200 dark:border-slate-600">
                            {(['annual','quarterly','monthly'] as const).map(mode => (
                                <button key={mode} type="button"
                                    onClick={() => setBudgetFormData({...budgetFormData, entryMode: mode})}
                                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${budgetFormData.entryMode === mode
                                        ? (isScenario ? 'bg-white dark:bg-slate-600 text-purple-600 dark:text-purple-300 shadow-sm' : 'bg-white dark:bg-slate-600 text-sky-600 dark:text-sky-300 shadow-sm')
                                        : 'text-slate-500 dark:text-slate-400'}`}>
                                    {mode === 'annual' ? 'Årlig' : mode === 'quarterly' ? 'Kvartalsvis' : 'Månedlig'}
                                </button>
                            ))}
                        </div>

                        {/* INPUTS */}
                        <div className="max-h-[55vh] overflow-y-auto">

                            {/* ── ANNUAL ── */}
                            {budgetFormData.entryMode === 'annual' && !isScenario && (
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Årsbudsjett</label>
                                    <input type="number" className={inputCls()}
                                        value={budgetFormData.annual || ''}
                                        onChange={(e) => setBudgetFormData({...budgetFormData, annual: parseFloat(e.target.value) || 0})}
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">Fordeles automatisk med 1/12 per måned.</p>
                                </div>
                            )}
                            {budgetFormData.entryMode === 'annual' && isScenario && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold uppercase text-rose-500 mb-1 block">Realist — Årsbudsjett</label>
                                        <input type="number" className={inputCls('rose')}
                                            value={budgetFormData.scenarioLowAnnual || ''}
                                            onChange={(e) => setBudgetFormData({...budgetFormData, scenarioLowAnnual: parseFloat(e.target.value) || 0})}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase text-emerald-600 mb-1 block">Optimist — Årsbudsjett</label>
                                        <input type="number" className={inputCls('emerald')}
                                            value={budgetFormData.scenarioHighAnnual || ''}
                                            onChange={(e) => setBudgetFormData({...budgetFormData, scenarioHighAnnual: parseFloat(e.target.value) || 0})}
                                        />
                                    </div>
                                    {budgetFormData.scenarioLowAnnual > 0 && budgetFormData.scenarioHighAnnual > 0 && (
                                        <div className="col-span-2 text-[11px] text-slate-500 text-center">
                                            Midtpunkt: <strong className="text-slate-700 dark:text-slate-200">{formatCurrency((budgetFormData.scenarioLowAnnual + budgetFormData.scenarioHighAnnual) / 2)}</strong>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── QUARTERLY ── */}
                            {budgetFormData.entryMode === 'quarterly' && !isScenario && (
                                <div className="grid grid-cols-2 gap-4">
                                    {[0,1,2,3].map(q => (
                                        <div key={q}>
                                            <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Kvartal {q+1}</label>
                                            <input type="number" className={inputCls()}
                                                value={budgetFormData.quarterly[q] || ''}
                                                onChange={(e) => { const nq=[...budgetFormData.quarterly]; nq[q]=parseFloat(e.target.value)||0; setBudgetFormData({...budgetFormData, quarterly: nq}); }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}
                            {budgetFormData.entryMode === 'quarterly' && isScenario && (
                                <div className="grid grid-cols-4 gap-3">
                                    <div className="col-span-4 grid grid-cols-4 gap-3">
                                        {[0,1,2,3].map(q => (
                                            <div key={q}>
                                                <label className="text-[10px] font-bold uppercase text-rose-500 mb-1 block">Realist K{q+1}</label>
                                                <input type="number" className={inputCls('rose')}
                                                    value={budgetFormData.scenarioLowQuarterly[q] || ''}
                                                    onChange={(e) => { const nq=[...budgetFormData.scenarioLowQuarterly]; nq[q]=parseFloat(e.target.value)||0; setBudgetFormData({...budgetFormData, scenarioLowQuarterly: nq}); }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                    <div className="col-span-4 grid grid-cols-4 gap-3">
                                        {[0,1,2,3].map(q => (
                                            <div key={q}>
                                                <label className="text-[10px] font-bold uppercase text-emerald-600 mb-1 block">Optimist K{q+1}</label>
                                                <input type="number" className={inputCls('emerald')}
                                                    value={budgetFormData.scenarioHighQuarterly[q] || ''}
                                                    onChange={(e) => { const nq=[...budgetFormData.scenarioHighQuarterly]; nq[q]=parseFloat(e.target.value)||0; setBudgetFormData({...budgetFormData, scenarioHighQuarterly: nq}); }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* ── MONTHLY ── */}
                            {budgetFormData.entryMode === 'monthly' && !isScenario && (
                                <div className="grid grid-cols-6 gap-2">
                                    {MONTHS.map((m, i) => (
                                        <div key={i}>
                                            <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block text-center">{m}</label>
                                            <input type="number" className={inputCls()}
                                                value={budgetFormData.monthly[i] || ''}
                                                onChange={(e) => { const nm=[...budgetFormData.monthly]; nm[i]=parseFloat(e.target.value)||0; setBudgetFormData({...budgetFormData, monthly: nm}); }}
                                            />
                                        </div>
                                    ))}
                                    <div className="col-span-6 text-[10px] text-slate-400 text-right">
                                        Totalt: <strong className="text-slate-600 dark:text-slate-300">{formatCurrency(budgetFormData.monthly.reduce((a,b)=>a+b,0))}</strong>
                                    </div>
                                </div>
                            )}
                            {budgetFormData.entryMode === 'monthly' && isScenario && (
                                <div className="space-y-3">
                                    {/* Header row */}
                                    <div className="grid gap-2" style={{gridTemplateColumns: '80px repeat(12, 1fr)'}}>
                                        <div/>
                                        {MONTHS.map(m => <div key={m} className="text-[10px] font-bold uppercase text-slate-400 text-center">{m}</div>)}
                                    </div>
                                    {/* Realist row */}
                                    <div className="grid gap-2 items-center" style={{gridTemplateColumns: '80px repeat(12, 1fr)'}}>
                                        <span className="text-[10px] font-bold uppercase text-rose-500">Realist</span>
                                        {MONTHS.map((_, i) => (
                                            <input key={i} type="number" className={inputCls('rose')}
                                                value={budgetFormData.scenarioLowMonthly[i] || ''}
                                                onChange={(e) => { const nm=[...budgetFormData.scenarioLowMonthly]; nm[i]=parseFloat(e.target.value)||0; setBudgetFormData({...budgetFormData, scenarioLowMonthly: nm}); }}
                                            />
                                        ))}
                                    </div>
                                    {/* Optimist row */}
                                    <div className="grid gap-2 items-center" style={{gridTemplateColumns: '80px repeat(12, 1fr)'}}>
                                        <span className="text-[10px] font-bold uppercase text-emerald-600">Optimist</span>
                                        {MONTHS.map((_, i) => (
                                            <input key={i} type="number" className={inputCls('emerald')}
                                                value={budgetFormData.scenarioHighMonthly[i] || ''}
                                                onChange={(e) => { const nm=[...budgetFormData.scenarioHighMonthly]; nm[i]=parseFloat(e.target.value)||0; setBudgetFormData({...budgetFormData, scenarioHighMonthly: nm}); }}
                                            />
                                        ))}
                                    </div>
                                    {/* Totals row */}
                                    <div className="grid gap-2 items-center text-[10px] text-slate-500" style={{gridTemplateColumns: '80px repeat(12, 1fr)'}}>
                                        <span className="font-bold uppercase">Total</span>
                                        {MONTHS.map((_, i) => (
                                            <div key={i} className="text-center tabular-nums text-slate-400">
                                                {formatCurrency(Math.round((budgetFormData.scenarioLowMonthly[i] + budgetFormData.scenarioHighMonthly[i]) / 2))}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700 gap-3">
                            <button type="button" onClick={() => setIsBudgetModalOpen(false)}
                                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors">
                                Avbryt
                            </button>
                            <button type="submit"
                                className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold shadow-md transition-colors flex items-center gap-2">
                                <Save className="w-4 h-4" />
                                Lagre Budsjett
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            );
        })()}

        {/* Forenklet Rapport Modal */}
        {isForenkletOpen && (() => {
            const MONTHS_NO = ['Januar','Februar','Mars','April','Mai','Juni','Juli','August','September','Oktober','November','Desember'];
            const fields: { key: keyof typeof forenkletForm; label: string }[] = [
                { key: 'revenue', label: 'Omsetning' },
                { key: 'expenses', label: 'Kostnader' },
                { key: 'liquidity', label: 'Likviditet' },
                { key: 'receivables', label: 'Fordringer' },
                { key: 'accountsPayable', label: 'Leverandørgjeld' },
                { key: 'salaryExpenses', label: 'Lønnskostnad' },
                { key: 'publicFees', label: 'Off. avgifter' },
            ];
            return (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Forenklet rapport</h2>
                            <button onClick={() => setIsForenkletOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {/* Month / Year selector */}
                            <div className="flex gap-3">
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Måned</label>
                                    <select
                                        value={forenkletForm.month}
                                        onChange={e => setForenkletForm(f => ({ ...f, month: Number(e.target.value) }))}
                                        className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-white"
                                    >
                                        {MONTHS_NO.map((m, i) => (
                                            <option key={i} value={i + 1}>{m}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="w-28">
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">År</label>
                                    <input
                                        type="number"
                                        value={forenkletForm.year}
                                        onChange={e => setForenkletForm(f => ({ ...f, year: Number(e.target.value) }))}
                                        className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-white"
                                    />
                                </div>
                            </div>
                            {/* Fields */}
                            <div className="grid grid-cols-2 gap-3">
                                {fields.map(({ key, label }) => (
                                    <div key={key}>
                                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</label>
                                        <input
                                            type="number"
                                            value={forenkletForm[key] as number}
                                            onChange={e => setForenkletForm(f => ({ ...f, [key]: Number(e.target.value) }))}
                                            className="w-full border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-white"
                                        />
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-slate-400 dark:text-slate-500">Tall er per måned. Systemet summerer alle måneder til YTD automatisk.</p>
                        </div>
                        <div className="flex justify-end gap-3 px-6 pb-6">
                            <button onClick={() => setIsForenkletOpen(false)} className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">Avbryt</button>
                            <button
                                onClick={handleForenkletSubmit}
                                disabled={forenkletSaving}
                                className="px-6 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg font-bold shadow-md transition-colors flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                {forenkletSaving ? 'Lagrer...' : 'Lagre'}
                            </button>
                        </div>
                    </div>
                </div>
            );
        })()}

      </div>
    </div>
  );
};

export default CompanyDetailView;