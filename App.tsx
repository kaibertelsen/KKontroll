import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ComputedCompanyData, SortField, ViewMode, CompanyData, UserData, ReportLogItem, ForecastItem, UserProfile, MonthlyEntryData, LiquidityPool } from './types';
import AnalyticsView from './components/AnalyticsView';
import PulseView from './components/PulseView';
import CompanyDetailView from './components/CompanyDetailView';
import AdminView from './components/AdminView';
import UserAdminView from './components/UserAdminView';
import SuperAdminView from './components/SuperAdminView';
import LiquidityPoolView from './components/LiquidityPoolView';
import ProjectDashboard from './components/ProjectDashboard';
import ProjectDetailView from './components/ProjectDetailView';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import DashboardGrid from './components/layout/DashboardGrid';
import { postNEON, patchNEON, deleteNEON, getNEON } from './utils/neon';
import { hashPassword } from './utils/crypto';
import { logActivity } from './utils/logging';
import { 
  ArrowUpDown,
  ShieldAlert,
  Shield,
  Check,
  X,
  KeyRound,
  Grid2X2,
  LayoutTemplate,
  RefreshCw,
  FileText,
  ZoomIn,
  ZoomOut,
  LayoutGrid,
  BarChart3,
  Building2,
  Users,
  Activity,
  Settings,
  Eye,
  EyeOff,
  Banknote
} from 'lucide-react';

interface AppProps {
    userProfile: UserProfile;
    initialCompanies: CompanyData[];
    isDemo: boolean;
    hasMultipleKonsern?: boolean;
}

// Helper to convert DD.MM.YYYY to YYYY-MM-DD for DB
const toISODate = (dateStr: string) => {
    if (!dateStr) return null;
    if (dateStr.includes('-')) return dateStr;
    const parts = dateStr.split('.');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return null;
};

function App({ userProfile, initialCompanies, isDemo, hasMultipleKonsern = false }: AppProps) {
  const [sortField, setSortField] = useState<SortField>(SortField.DEFAULT);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.GRID);
  const [cardSize, setCardSize] = useState<'normal' | 'compact'>('normal');
  const [isTodayMode, setIsTodayMode] = useState<boolean>(false);
  const [showShortTermDebt, setShowShortTermDebt] = useState<boolean>(true);
  const [showLoyaltyBonus, setShowLoyaltyBonus] = useState<boolean>(true);
  const [isCardSettingsOpen, setIsCardSettingsOpen] = useState(false);
  const [visibleFields, setVisibleFields] = useState({
    omsetning: true,
    kostnader: true,
    resultat: true,
    budsjett: true,
    likviditet: true,
    fordringer: true,
    leverandorgjeld: true,
    kortsiktigGjeld: true,
    offAvgifter: true,
    lonnskostnad: true,
    nettoArbeidskapital: true,
  });
  const [selectedCompany, setSelectedCompany] = useState<ComputedCompanyData | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // ZOOM STATE
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  const [demoRole, setDemoRole] = useState<'controller' | 'leader'>(userProfile.role);
  const effectiveRole = isDemo ? demoRole : userProfile.role;

  const [companies, setCompanies] = useState<CompanyData[]>(initialCompanies || []);
  const [users, setUsers] = useState<UserData[]>([]);
  const [reports, setReports] = useState<ReportLogItem[]>([]);
  
  // State for ALL reports (Admin view)
  const [allReports, setAllReports] = useState<ReportLogItem[]>([]);
  
  const [forecasts, setForecasts] = useState<ForecastItem[]>([]);
  const [monthlyEntries, setMonthlyEntries] = useState<MonthlyEntryData[]>([]);

  // SORTING STATE
  const [isSortMode, setIsSortMode] = useState(false);
  const [originalOrder, setOriginalOrder] = useState<CompanyData[]>([]);

  // LIQUIDITY POOLS (stored in Neon DB)
  const [liquidityPools, setLiquidityPools] = useState<LiquidityPool[]>([]);

  const reloadPools = async () => {
    try {
      const res = await getNEON({ table: 'liquidity_pools', where: { group_id: userProfile.groupId } });
      const parseCompanyIds = (raw: any): number[] => {
        if (Array.isArray(raw)) return raw;
        if (!raw) return [];
        if (typeof raw === 'string') {
          try { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; } catch { return []; }
        }
        return []; // handles {} (empty object from Neon)
      };
      const pools: LiquidityPool[] = (res.rows || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        companyIds: parseCompanyIds(r.company_ids),
      }));
      setLiquidityPools(pools);
    } catch (e) {
      console.error('Failed to load pools', e);
    }
  };

  useEffect(() => {
    if (!isDemo && effectiveRole === 'controller') {
      reloadPools();
    }
  }, [viewMode, isDemo, effectiveRole]);

  const handleCreatePool = async (name: string) => {
    try {
      await postNEON({ table: 'liquidity_pools', data: { group_id: userProfile.groupId, name, company_ids: JSON.stringify([]) } });
      await reloadPools();
    } catch (e) { console.error('Failed to create pool', e); }
  };

  const handleDeletePool = async (id: number) => {
    if (!window.confirm('Slett denne poolen?')) return;
    try {
      await deleteNEON({ table: 'liquidity_pools', data: id });
      await reloadPools();
    } catch (e) { console.error('Failed to delete pool', e); }
  };

  const handleToggleCompanyInPool = async (poolId: number, companyId: number) => {
    const pool = liquidityPools.find(p => p.id === poolId);
    if (!pool) return;
    const isIn = pool.companyIds.includes(companyId);
    const newIds = isIn ? pool.companyIds.filter(id => id !== companyId) : [...pool.companyIds, companyId];
    // Optimistic update
    setLiquidityPools(prev => prev.map(p => p.id === poolId ? { ...p, companyIds: newIds } : p));
    try {
      await patchNEON({ table: 'liquidity_pools', data: { id: poolId, company_ids: JSON.stringify(newIds) } });
    } catch (e) {
      console.error('Failed to update pool', e);
      await reloadPools();
    }
  };
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  
  // PASSWORD CHANGE STATE
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });

  // REFRESH STATE
  const [isGlobalRefreshing, setIsGlobalRefreshing] = useState(false);

  // PROJECTS STATE
  const [groupFeatures, setGroupFeatures] = useState<string[]>([]);
  const [selectedProject, setSelectedProject] = useState<any | null>(null);

  // --- DATA POLLING ---
  useEffect(() => {
      if (isDemo) return;

      const interval = setInterval(async () => {
          console.log("Polling data...");
          await reloadCompanies();
          if (viewMode === ViewMode.ADMIN || viewMode === ViewMode.ADMIN_REPORTS) {
              fetchAllReports();
          }
          if (selectedCompany) {
              fetchCompanyReports(selectedCompany.id);
          }
      }, 30000); // 30 seconds

      return () => clearInterval(interval);
  }, [isDemo, selectedCompany, viewMode]);


  // --- ZOOM HANDLERS ---
  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 10, 120));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 10, 60));

  // --- SORT MODE HANDLERS ---
  const handleSortToggle = () => {
      if (viewMode === ViewMode.GRID && !isSortMode) {
          setOriginalOrder([...companies]); 
          setIsSortMode(true);
      }
  };

  const cancelSort = () => {
      setCompanies(originalOrder);
      setIsSortMode(false);
      dragItem.current = null;
      dragOverItem.current = null;
  };

  const saveSort = async () => {
      // 1. Prepare updates
      const updates = companies.map((c, index) => ({
          id: c.id,
          sortOrder: index
      }));
      
      // 2. Optimistic update local state (companies is already sorted by drag)
      setIsSortMode(false);
      dragItem.current = null;
      dragOverItem.current = null;
      
      // 3. Persist to DB
      if (!isDemo) {
          try {
              for (const update of updates) {
                  await patchNEON({ 
                      table: 'companies', 
                      data: { id: update.id, sort_order: update.sortOrder }
                  });
              }
              logActivity(userProfile.id, 'SORT_COMPANIES', 'companies', undefined, 'Lagret ny rekkefølge på kortene');
              console.log("Sort order persisted to DB");
          } catch (e) {
              console.error("Failed to save sort order", e);
              alert("Kunne ikke lagre rekkefølgen til databasen.");
          }
      } else {
          console.log("Sort saved locally (Demo mode)");
      }
  };

  const onDragStart = (e: React.DragEvent, index: number) => {
      dragItem.current = index;
  };

  const onDragEnter = (e: React.DragEvent, index: number) => {
      dragOverItem.current = index;
      if (dragItem.current !== null && dragItem.current !== index) {
          const newCompanies = [...companies];
          const draggedItemContent = newCompanies[dragItem.current];
          newCompanies.splice(dragItem.current, 1);
          newCompanies.splice(index, 0, draggedItemContent);
          setCompanies(newCompanies);
          dragItem.current = index; 
      }
  };

  const onDragEnd = () => {
      dragItem.current = null;
      dragOverItem.current = null;
  };


  // --- FETCH USERS (Admin) ---
  useEffect(() => {
      if (!isDemo && effectiveRole === 'controller' && (viewMode === ViewMode.ADMIN || viewMode === ViewMode.ADMIN_REPORTS || viewMode === ViewMode.USER_ADMIN)) {
          fetchUsers();
          fetchAllReports();
      }
  }, [isDemo, userProfile, viewMode, effectiveRole]);

  const fetchUsers = async () => {
      try {
        // Fetch users who have access to current group via usergroupaccess
        const groupAccessRes = await getNEON({ table: 'usergroupaccess', where: { group_id: userProfile.groupId } });
        const groupAccessRows = groupAccessRes.rows || [];
        const userIdsInGroup = [...new Set(groupAccessRows.map((r: any) => r.user_id || r.userId))] as number[];

        if (userIdsInGroup.length === 0) {
            setUsers([]);
            return;
        }

        // Fetch all those users and company access in parallel
        const [allUsersRes, companyAccessRes] = await Promise.all([
            getNEON({ table: 'users' }),
            getNEON({ table: 'usercompanyaccess' }),
        ]);

        const allUsers = (allUsersRes.rows || []).filter((u: any) => userIdsInGroup.includes(u.id));
        const allAccess = companyAccessRes.rows || [];

        const mappedUsers = allUsers.map((u: any) => {
            const userAccess = allAccess
                .filter((a: any) => (a.user_id || a.userId) === u.id)
                .map((a: any) => a.company_id || a.companyId);

            const legacyId = u.company_id || u.companyId;
            if (userAccess.length === 0 && legacyId) userAccess.push(legacyId);

            return {
                id: u.id,
                email: u.email,
                fullName: u.fullName || u.full_name,
                role: u.role,
                groupId: u.groupId || u.group_id,
                companyId: legacyId,
                companyIds: userAccess,
                is_super_admin: u.is_super_admin || false,
            };
        });
        setUsers(mappedUsers);
      } catch(err) { console.error("Error fetching users", err); }
  };

  // --- HELPER FETCHERS ---
  const fetchAllReports = async () => {
      try {
           const companyIds = companies.map(c => c.id);
           if (companyIds.length === 0) return;

           const res = await getNEON({ table: 'reports' });
           if (res.rows) {
               const groupReports = res.rows.filter((r:any) => companyIds.includes(r.companyId || r.company_id));
               const mapped = mapReports(groupReports);
               setAllReports(mapped);
           }
      } catch (e) { console.error("Fetch all reports error", e); }
  };

  const fetchCompanyReports = async (companyId: number) => {
      try {
          const res = await getNEON({ table: 'reports', where: { company_id: companyId } });
          if (res.rows) {
              const mapped = mapReports(res.rows);
              setReports(mapped);
          }
      } catch (e) { console.error("Fetch company reports error", e); }
  };
  
  const fetchMonthlyEntries = async (companyId: number) => {
    try {
      const res = await getNEON({ table: 'monthly_entries', where: { company_id: companyId } });
      if (res.rows) {
        const mapped: MonthlyEntryData[] = res.rows.map((r: any) => ({
          id: r.id,
          companyId: r.company_id,
          year: Number(r.year),
          month: Number(r.month),
          revenue: Number(r.revenue || 0),
          expenses: Number(r.expenses || 0),
          liquidity: Number(r.liquidity || 0),
          receivables: Number(r.receivables || 0),
          accountsPayable: Number(r.accounts_payable || 0),
          salaryExpenses: Number(r.salary_expenses || 0),
          publicFees: Number(r.public_fees || 0),
          shortTermDebt: Number(r.short_term_debt || 0),
        }));
        setMonthlyEntries(mapped);
      }
    } catch (e) { console.error('Fetch monthly entries error', e); }
  };

  const handleDeleteMonthlyEntry = async (entryId: number) => {
    if (isDemo) return;
    const entry = monthlyEntries.find(e => e.id === entryId);
    await deleteNEON({ table: 'monthly_entries', data: entryId });
    setMonthlyEntries(prev => prev.filter(e => e.id !== entryId));

    if (entry) {
      const now = new Date();
      const curYear = now.getFullYear();
      const curMonth = now.getMonth() + 1;
      const allEntries = await getNEON({ table: 'monthly_entries', where: { company_id: entry.companyId } });
      const rows: any[] = allEntries.rows || [];

      let ytdRevenue = 0, ytdExpenses = 0, ytdLiquidity = 0, ytdReceivables = 0;
      let ytdAccountsPayable = 0, ytdSalary = 0, ytdPublicFees = 0, ytdShortTermDebt = 0;
      for (const r of rows) {
        const rYear = Number(r.year);
        const rMonth = Number(r.month);
        if (rYear < curYear || (rYear === curYear && rMonth <= curMonth)) {
          ytdRevenue += Number(r.revenue || 0);
          ytdExpenses += Number(r.expenses || 0);
          ytdLiquidity += Number(r.liquidity || 0);
          ytdReceivables += Number(r.receivables || 0);
          ytdAccountsPayable += Number(r.accounts_payable || 0);
          ytdSalary += Number(r.salary_expenses || 0);
          ytdPublicFees += Number(r.public_fees || 0);
          ytdShortTermDebt += Number(r.short_term_debt || 0);
        }
      }

      await patchNEON({
        table: 'companies',
        data: {
          id: entry.companyId,
          revenue: ytdRevenue,
          expenses: ytdExpenses,
          result_ytd: ytdRevenue - ytdExpenses,
          liquidity: ytdLiquidity,
          receivables: ytdReceivables,
          accounts_payable: ytdAccountsPayable,
          salary_expenses: ytdSalary,
          public_fees: ytdPublicFees,
          short_term_debt: ytdShortTermDebt,
        },
      });
    }

    await reloadCompanies();
    if (selectedCompany) fetchMonthlyEntries(selectedCompany.id);
  };

  const fetchForecasts = async (companyId: number) => {
       try {
            const res = await getNEON({ table: 'forecasts', where: { company_id: companyId } });
            if(res.rows) {
                const mappedForecasts = res.rows.map((f: any) => ({
                    id: f.id,
                    companyId: f.companyId || f.company_id,
                    month: f.month,
                    estimatedReceivables: f.estimatedReceivables || f.estimated_receivables || 0,
                    estimatedPayables: f.estimatedPayables || f.estimated_payables || 0
                }));
                setForecasts(mappedForecasts);
            }
       } catch (err) { console.error("Error fetching forecasts", err); }
  };

  const mapReports = (rows: any[]) => {
      const sortedRows = rows.sort((a: any, b: any) => {
        const dateA = new Date(a.reportDate || a.report_date).getTime();
        const dateB = new Date(b.reportDate || b.report_date).getTime();
        return dateB - dateA;
     });

     return sortedRows.map((r: any) => ({
         id: r.id,
         date: r.reportDate ? new Date(r.reportDate).toLocaleDateString('no-NO') : '',
         author: r.authorName || r.author_name || 'Ukjent',
         comment: r.comment,
         status: r.status,
         result: r.resultYtd != null ? r.resultYtd : (r.result_ytd != null ? r.result_ytd : undefined),
         revenue: r.revenue,
         expenses: r.expenses,
         pnlDate: r.pnlDate || r.pnl_date || '', 
         liquidity: r.liquidity,
         receivables: r.receivables,
         accountsPayable: r.accountsPayable || r.accounts_payable,
         publicFees: r.publicFees || r.public_fees,
         salaryExpenses: r.salaryExpenses || r.salary_expenses,
         shortTermDebt: r.shortTermDebt || r.short_term_debt || null,
         liquidityDate: r.liquidityDate || r.liquidity_date || '',
         receivablesDate: r.receivablesDate || r.receivables_date || '',
         accountsPayableDate: r.accountsPayableDate || r.accounts_payable_date || '',
         publicFeesDate: r.publicFeesDate || r.public_fees_date || '',
         salaryExpensesDate: r.salaryExpensesDate || r.salary_expenses_date || '',
         shortTermDebtDate: r.shortTermDebtDate || r.short_term_debt_date || '',
         source: r.source || 'Manuell',
         approvedBy: r.approvedByUserId || r.approved_by_user_id ? 'Kontroller' : undefined,
         approvedAt: r.approvedAt || r.approved_at ? new Date(r.approvedAt || r.approved_at).toLocaleDateString('no-NO') : undefined,
         companyId: r.companyId || r.company_id
     }));
  }

  // --- FETCH REPORTS & FORECASTS FOR SELECTED ---
  useEffect(() => {
      if (!selectedCompany) return;

      if (!isDemo) {
          fetchCompanyReports(selectedCompany.id);
          fetchForecasts(selectedCompany.id);
          fetchMonthlyEntries(selectedCompany.id);
      } else {
          setReports([
              { id: 1, date: '15.10.2023', author: 'Anna Hansen', comment: 'Sterk vekst i Q3.', status: 'approved', result: 1240000, liquidity: 540000, source: 'Manuell', approvedBy: 'Demo Controller', pnlDate: '30.09.2023', companyId: 1 },
              { id: 2, date: '15.09.2023', author: 'System', comment: 'Stabil drift.', status: 'approved', result: 1100000, liquidity: 500000, source: 'Tripletex', pnlDate: '31.08.2023', companyId: 1 }
          ]);
          setForecasts([
              { companyId: 1, month: '2023-12', estimatedReceivables: 150000, estimatedPayables: 100000 },
              { companyId: 1, month: '2024-01', estimatedReceivables: 200000, estimatedPayables: 120000 }
          ]);
      }
  }, [selectedCompany?.id, isDemo]);


  // --- HELPER to Refresh Companies ---
  const reloadCompanies = async () => {
    try {
        let companyWhere: any = {};
        if (effectiveRole === 'leader' && userProfile.companyIds && userProfile.companyIds.length > 0) {
             companyWhere = { group_id: userProfile.groupId };
        } else {
            companyWhere = { group_id: userProfile.groupId };
        }

        const compRes = await getNEON({ table: 'companies', where: companyWhere });
        if(compRes.rows) {
            let filteredRows = compRes.rows;
            // Manual filtering for Leader
            if (effectiveRole === 'leader' && userProfile.companyIds && userProfile.companyIds.length > 0) {
                filteredRows = filteredRows.filter((c: any) => userProfile.companyIds!.includes(c.id));
            }

            // Helper: parse a budget months array from any DB format
            const parseBudgetArr = (raw: any): number[] => {
                let arr: number[] = [];
                try {
                    if (Array.isArray(raw)) arr = raw.map(Number);
                    else if (typeof raw === 'object' && raw !== null) arr = Object.values(raw).map(Number);
                    else if (typeof raw === 'string') {
                        let s = raw.trim();
                        if (s.startsWith('{') && s.endsWith('}')) s = s.replace('{', '[').replace('}', ']');
                        try { const p = JSON.parse(s); if (Array.isArray(p)) arr = p.map(Number); }
                        catch { arr = s.replace(/[\[\]\{\}]/g, '').split(',').map(Number); }
                    }
                } catch {}
                if (!arr || arr.length !== 12 || arr.some(isNaN)) arr = Array(12).fill(0);
                return arr;
            };

            const mapped = filteredRows.map((c: any) => {
                let bMonths = parseBudgetArr(c.budgetMonths ?? c.budget_months);

                const bTotal = Number(c.budgetTotal || c.budget_total || 0);
                const sumMonths = bMonths.reduce((a: number, b: number) => a + b, 0);
                if ((sumMonths === 0 || isNaN(sumMonths)) && bTotal > 0) {
                    const perMonth = Math.round(bTotal / 12);
                    bMonths = Array(12).fill(perMonth);
                    bMonths[11] += (bTotal - perMonth * 12);
                }

                const budgetType = c.budget_type || c.budgetType || 'standard';
                const budgetMonthsLow = parseBudgetArr(c.budget_months_low ?? c.budgetMonthsLow);
                const budgetMonthsHigh = parseBudgetArr(c.budget_months_high ?? c.budgetMonthsHigh);

                return {
                    ...c,
                    resultYTD: Number(c.resultYtd || c.result_ytd || 0),
                    budgetTotal: bTotal,
                    budgetMode: c.budgetMode || c.budget_mode || 'annual',
                    budgetMonths: bMonths,
                    budgetType,
                    budgetMonthsLow,
                    budgetMonthsHigh,
                    liquidity: Number(c.liquidity || 0),
                    receivables: Number(c.receivables || 0),
                    accountsPayable: Number(c.accountsPayable || c.accounts_payable || 0),
                    publicFees: Number(c.publicFees || c.public_fees || 0),
                    salaryExpenses: Number(c.salaryExpenses || c.salary_expenses || 0),
                    shortTermDebt: Number(c.shortTermDebt || c.short_term_debt || 0),
                    loyaltyBonus: Number(c.loyaltyBonus || c.loyalty_bonus || 0),
                    trendHistory: Number(c.trendHistory || c.trend_history || 0),
                    prevLiquidity: Number(c.prevLiquidity || c.prev_liquidity || 0),
                    prevDeviation: Number(c.prevTrend || c.prev_trend || 0),
                    name: c.name || '',
                    fullName: c.fullName || c.full_name || '',
                    manager: c.manager || 'Ingen leder',
                    sortOrder: Number(c.sortOrder || c.sort_order || 0),
                    revenue: Number(c.revenue || 0),
                    expenses: Number(c.expenses || 0),
                    liquidityDate: c.liquidityDate || c.liquidity_date || '',
                    receivablesDate: c.receivablesDate || c.receivables_date || '',
                    accountsPayableDate: c.accountsPayableDate || c.accounts_payable_date || '',
                    publicFeesDate: c.publicFeesDate || c.public_fees_date || '',
                    salaryExpensesDate: c.salaryExpensesDate || c.salary_expenses_date || '',
                    shortTermDebtDate: c.shortTermDebtDate || c.short_term_debt_date || '',
                    lastReportDate: c.lastReportDate || c.last_report_date || '',
                    lastReportBy: c.lastReportBy || c.last_report_by || '',
                    comment: c.currentComment || c.current_comment || '',
                    pnlDate: c.pnlDate || c.pnl_date || ''
                };
            });
            mapped.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
            setCompanies(mapped);
            if (selectedCompany) {
                const updated = mapped.find((c: any) => c.id === selectedCompany.id);
                if (updated) {
                    const now = new Date();
                    const currentMonthIndex = now.getMonth();
                    const daysInCurrentMonth = new Date(now.getFullYear(), currentMonthIndex + 1, 0).getDate();
                    const calcYTD = (months: number[]) => {
                        let t = 0;
                        for (let i = 0; i < currentMonthIndex; i++) t += Number(months[i] || 0);
                        if (isTodayMode) t += (Number(months[currentMonthIndex] || 0) / daysInCurrentMonth) * now.getDate();
                        return t;
                    };
                    let targetBudget = 0;
                    let calculatedBudgetYTDLow: number | undefined;
                    let calculatedBudgetYTDHigh: number | undefined;
                    if (updated.budgetType === 'scenario' && updated.budgetMonthsLow && updated.budgetMonthsHigh) {
                        calculatedBudgetYTDLow = calcYTD(updated.budgetMonthsLow);
                        calculatedBudgetYTDHigh = calcYTD(updated.budgetMonthsHigh);
                        targetBudget = (calculatedBudgetYTDLow + calculatedBudgetYTDHigh) / 2;
                    } else {
                        targetBudget = calcYTD(updated.budgetMonths);
                    }
                    const deviation = updated.resultYTD - targetBudget;
                    const deviationPercent = targetBudget !== 0 ? (deviation / targetBudget) * 100 : 0;
                    setSelectedCompany({
                        ...updated,
                        calculatedBudgetYTD: targetBudget,
                        calculatedDeviationPercent: deviationPercent,
                        calculatedBudgetYTDLow,
                        calculatedBudgetYTDHigh,
                    });
                }
            }
        }
    } catch(e) { console.error("Reload companies error", e); }
  };

  const syncManagers = async (companyIds: number[]) => {
      if (companyIds.length === 0) return;
      const uniqueIds = [...new Set(companyIds)];
      try {
        const lRes = await getNEON({ table: 'users', where: { role: 'leader' } });
        const allLeaders = lRes.rows || [];
        const aRes = await getNEON({ table: 'usercompanyaccess' });
        const allAccess = aRes.rows || [];
        for (const cid of uniqueIds) {
            const linkedUserIds = allAccess
                .filter((a: any) => (a.companyId === cid || a.company_id === cid))
                .map((a: any) => a.userId || a.user_id);
            const legacyLeaders = allLeaders.filter((u:any) => 
                (u.companyId === cid || u.company_id === cid) && !linkedUserIds.includes(u.id)
            );
            const linkedLeaders = allLeaders.filter((u: any) => linkedUserIds.includes(u.id));
            const combinedLeaders = [...linkedLeaders, ...legacyLeaders];
            const uniqueLeaders = Array.from(new Set(combinedLeaders.map((u:any) => u.id)))
                .map(id => combinedLeaders.find((u:any) => u.id === id));
            const managerStr = uniqueLeaders.map((u: any) => u.fullName || u.full_name).join(', ') || 'Ingen leder';
            await patchNEON({ table: 'companies', data: { id: cid, manager: managerStr } });
        }
        await reloadCompanies();
      } catch (err) { console.error("Failed to sync manager names", err); }
  };

  // --- PASSWORD CHANGE HANDLER ---
  const handleChangePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (isDemo) {
          alert("Passordbytte er deaktivert i demo-modus.");
          return;
      }
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
          alert("Nytt passord matcher ikke bekreftelsen.");
          return;
      }
      try {
          const res = await getNEON({ table: 'users', where: { id: userProfile.id } });
          const user = res.rows[0];
          if (!user) { alert("Feil: Fant ikke bruker."); return; }
          const oldHash = await hashPassword(passwordForm.oldPassword);
          if (user.password !== passwordForm.oldPassword && user.password !== oldHash) {
               alert("Gammelt passord er feil.");
               return;
          }
          const newHash = await hashPassword(passwordForm.newPassword);
          await patchNEON({ table: 'users', data: { id: user.id, password: newHash } });
          logActivity(user.id, 'CHANGE_PASSWORD', 'users', user.id, 'Endret eget passord');
          alert("Passord endret!");
          setIsPasswordModalOpen(false);
          setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      } catch (e) {
          console.error("Change pwd error", e);
          alert("Kunne ikke endre passord.");
      }
  };


  // --- COMPANY CRUD ---
  const handleAddCompany = async (newCompany: Omit<CompanyData, 'id'>) => {
      try {
          const dbPayload = {
              group_id: userProfile.groupId,
              name: newCompany.name,
              full_name: newCompany.fullName,
              manager: newCompany.manager,
              revenue: newCompany.revenue,
              expenses: newCompany.expenses,
              result_ytd: newCompany.resultYTD,
              budget_total: newCompany.budgetTotal,
              budget_mode: newCompany.budgetMode,
              budget_months: JSON.stringify(newCompany.budgetMonths),
              liquidity: newCompany.liquidity,
              receivables: newCompany.receivables,
              accounts_payable: newCompany.accountsPayable,
              public_fees: newCompany.publicFees,
              salary_expenses: newCompany.salaryExpenses,
              short_term_debt: newCompany.shortTermDebt || 0,
              loyalty_bonus: newCompany.loyaltyBonus || 0,
              liquidity_date: newCompany.liquidityDate,
              receivables_date: newCompany.receivablesDate,
              accounts_payable_date: newCompany.accountsPayableDate,
              public_fees_date: newCompany.publicFeesDate,
              salary_expenses_date: newCompany.salaryExpensesDate,
              trend_history: newCompany.trendHistory
          };
          
          if (!isDemo) {
              const res = await postNEON({ table: 'companies', data: dbPayload });
              const newId = res.inserted?.[0]?.id;
              logActivity(userProfile.id, 'CREATE_COMPANY', 'companies', newId, `Opprettet selskap: ${newCompany.name}`);
              await reloadCompanies();
          } else {
              const id = companies.length > 0 ? Math.max(...companies.map(c => c.id)) + 1 : 1;
              setCompanies([...companies, { ...newCompany, id } as CompanyData]);
          }
      } catch (e) {
          console.error("Failed to add company", e);
          alert("Kunne ikke lagre selskap.");
      }
  };

  const handleUpdateCompany = async (updatedCompany: CompanyData) => {
      try {
           const dbPayload = {
              id: updatedCompany.id,
              name: updatedCompany.name,
              full_name: updatedCompany.fullName,
              manager: updatedCompany.manager,
              revenue: updatedCompany.revenue,
              expenses: updatedCompany.expenses,
              result_ytd: updatedCompany.resultYTD,
              budget_total: updatedCompany.budgetTotal,
              budget_mode: updatedCompany.budgetMode,
              budget_months: JSON.stringify(updatedCompany.budgetMonths),
              budget_type: updatedCompany.budgetType || 'standard',
              budget_months_low: JSON.stringify(updatedCompany.budgetMonthsLow || Array(12).fill(0)),
              budget_months_high: JSON.stringify(updatedCompany.budgetMonthsHigh || Array(12).fill(0)),
              liquidity: updatedCompany.liquidity,
              receivables: updatedCompany.receivables,
              accounts_payable: updatedCompany.accountsPayable,
              public_fees: updatedCompany.publicFees,
              salary_expenses: updatedCompany.salaryExpenses,
              short_term_debt: updatedCompany.shortTermDebt || 0,
              loyalty_bonus: updatedCompany.loyaltyBonus || 0,
              liquidity_date: updatedCompany.liquidityDate,
              receivables_date: updatedCompany.receivablesDate,
              accounts_payable_date: updatedCompany.accountsPayableDate,
              public_fees_date: updatedCompany.publicFeesDate,
              salary_expenses_date: updatedCompany.salaryExpensesDate,
              trend_history: updatedCompany.trendHistory
          };

          if (!isDemo) {
              await patchNEON({ table: 'companies', data: dbPayload });
              logActivity(userProfile.id, 'UPDATE_COMPANY', 'companies', updatedCompany.id, `Oppdaterte selskap: ${updatedCompany.name}`);
              await reloadCompanies();
          } else {
              setCompanies(companies.map(c => c.id === updatedCompany.id ? updatedCompany : c));
          }
          
          if (selectedCompany && selectedCompany.id === updatedCompany.id) {
               const now = new Date();
               const currentMonthIndex = now.getMonth();
               const daysInCurrentMonth = new Date(now.getFullYear(), currentMonthIndex + 1, 0).getDate();
               const calcYTD = (months: number[]) => {
                   let t = 0;
                   for (let i = 0; i < currentMonthIndex; i++) t += Number(months[i] || 0);
                   if (isTodayMode) t += (Number(months[currentMonthIndex] || 0) / daysInCurrentMonth) * now.getDate();
                   return t;
               };
               let targetBudget = 0;
               let calculatedBudgetYTDLow: number | undefined;
               let calculatedBudgetYTDHigh: number | undefined;
               if (updatedCompany.budgetType === 'scenario' && updatedCompany.budgetMonthsLow && updatedCompany.budgetMonthsHigh) {
                   calculatedBudgetYTDLow = calcYTD(updatedCompany.budgetMonthsLow);
                   calculatedBudgetYTDHigh = calcYTD(updatedCompany.budgetMonthsHigh);
                   targetBudget = (calculatedBudgetYTDLow + calculatedBudgetYTDHigh) / 2;
               } else {
                   targetBudget = calcYTD(updatedCompany.budgetMonths || Array(12).fill(0));
               }
               const deviation = updatedCompany.resultYTD - targetBudget;
               const deviationPercent = targetBudget !== 0 ? (deviation / targetBudget) * 100 : 0;
               setSelectedCompany(prev => prev ? {
                   ...prev,
                   ...updatedCompany,
                   calculatedBudgetYTD: targetBudget,
                   calculatedDeviationPercent: deviationPercent,
                   calculatedBudgetYTDLow,
                   calculatedBudgetYTDHigh,
               } : null);
          }
      } catch (e) {
          console.error("Failed to update company", e);
          alert("Kunne ikke oppdatere selskap.");
      }
  };

  const handleDeleteCompany = async (id: number) => {
      if (!window.confirm("Er du sikker? Dette kan ikke angres.")) return;
      try {
          if (!isDemo) {
              await deleteNEON({ table: 'companies', data: id });
              logActivity(userProfile.id, 'DELETE_COMPANY', 'companies', id, 'Slettet selskap');
              await reloadCompanies();
              if (selectedCompany?.id === id) setSelectedCompany(null);
          } else {
              setCompanies(companies.filter(c => c.id !== id));
              if (selectedCompany?.id === id) setSelectedCompany(null);
          }
      } catch (e) {
          console.error("Failed to delete company", e);
          alert("Kunne ikke slette selskap. Det kan ha tilknyttede rapporter.");
      }
  };


  // --- REPORT HANDLERS ---
  const handleSubmitReport = async (reportData: any) => {
      try {
          const targetCompanyId = selectedCompany?.id || reportData.companyId;
          if (!targetCompanyId) return;
          if (isDemo) return;

          // Use snake_case — API maps column names directly to DB
          const reportPayload: any = {
              company_id: targetCompanyId,
              submitted_by_user_id: userProfile.id,
              author_name: userProfile.fullName,
              comment: reportData.comment,
              source: reportData.source,
              status: 'submitted'
          };

          const hasRevenue = reportData.revenue !== '' && reportData.revenue !== undefined;
          const hasExpenses = reportData.expenses !== '' && reportData.expenses !== undefined;

          if (hasRevenue || hasExpenses) {
             const r = Number(reportData.revenue || 0);
             const e = Number(reportData.expenses || 0);
             reportPayload.revenue = r;
             reportPayload.expenses = e;
             reportPayload.result_ytd = r - e;
             if(reportData.pnlDate) reportPayload.pnl_date = toISODate(reportData.pnlDate) || reportData.pnlDate;
          }

          if(reportData.liquidity !== undefined && reportData.liquidity !== '') {
             reportPayload.liquidity = Number(reportData.liquidity);
             if(reportData.liquidityDate) reportPayload.liquidity_date = reportData.liquidityDate;
          }
          if(reportData.receivables !== undefined && reportData.receivables !== '') {
              reportPayload.receivables = Number(reportData.receivables);
              if(reportData.receivablesDate) reportPayload.receivables_date = reportData.receivablesDate;
          }
          if(reportData.accountsPayable !== undefined && reportData.accountsPayable !== '') {
              reportPayload.accounts_payable = Number(reportData.accountsPayable);
              if(reportData.accountsPayableDate) reportPayload.accounts_payable_date = reportData.accountsPayableDate;
          }
          if(reportData.publicFees !== undefined && reportData.publicFees !== '') {
              reportPayload.public_fees = Number(reportData.publicFees);
              if(reportData.publicFeesDate) reportPayload.public_fees_date = reportData.publicFeesDate;
          }
          if(reportData.salaryExpenses !== undefined && reportData.salaryExpenses !== '') {
              reportPayload.salary_expenses = Number(reportData.salaryExpenses);
              if(reportData.salaryExpensesDate) reportPayload.salary_expenses_date = reportData.salaryExpensesDate;
          }
          if(reportData.shortTermDebt !== undefined && reportData.shortTermDebt !== '') {
              reportPayload.short_term_debt = Number(reportData.shortTermDebt);
              if(reportData.shortTermDebtDate) reportPayload.short_term_debt_date = reportData.shortTermDebtDate;
          }

          if (reportData.id) {
              await patchNEON({ table: 'reports', data: { id: reportData.id, ...reportPayload } });
              logActivity(userProfile.id, 'UPDATE_REPORT', 'reports', reportData.id, `Oppdaterte rapport. Status: submitted`);
          } else {
              const res = await postNEON({ table: 'reports', data: reportPayload });
              logActivity(userProfile.id, 'SUBMIT_REPORT', 'reports', res.inserted?.[0]?.id, `Sendte inn ny rapport`);
          }

          // snake_case for companies table columns
          const companyUpdate: any = { id: targetCompanyId };
          if (hasRevenue || hasExpenses) {
             const r = Number(reportData.revenue || 0);
             const e = Number(reportData.expenses || 0);
             companyUpdate.revenue = r;
             companyUpdate.expenses = e;
             companyUpdate.result_ytd = r - e;
          }
          if(reportData.liquidity !== undefined && reportData.liquidity !== '') {
             companyUpdate.liquidity = Number(reportData.liquidity);
             if(reportData.liquidityDate) companyUpdate.liquidity_date = reportData.liquidityDate;
          }
          if(reportData.receivables !== undefined && reportData.receivables !== '') {
              companyUpdate.receivables = Number(reportData.receivables);
              if(reportData.receivablesDate) companyUpdate.receivables_date = reportData.receivablesDate;
          }
          if(reportData.accountsPayable !== undefined && reportData.accountsPayable !== '') {
              companyUpdate.accounts_payable = Number(reportData.accountsPayable);
              if(reportData.accountsPayableDate) companyUpdate.accounts_payable_date = reportData.accountsPayableDate;
          }
          if(reportData.publicFees !== undefined && reportData.publicFees !== '') {
              companyUpdate.public_fees = Number(reportData.publicFees);
              if(reportData.publicFeesDate) companyUpdate.public_fees_date = reportData.publicFeesDate;
          }
          if(reportData.salaryExpenses !== undefined && reportData.salaryExpenses !== '') {
              companyUpdate.salary_expenses = Number(reportData.salaryExpenses);
              if(reportData.salaryExpensesDate) companyUpdate.salary_expenses_date = reportData.salaryExpensesDate;
          }
          if(reportData.shortTermDebt !== undefined && reportData.shortTermDebt !== '') {
              companyUpdate.short_term_debt = Number(reportData.shortTermDebt);
              if(reportData.shortTermDebtDate) companyUpdate.short_term_debt_date = reportData.shortTermDebtDate;
          }

          companyUpdate.last_report_date = new Date().toLocaleDateString('no-NO');
          companyUpdate.last_report_by = userProfile.fullName;
          companyUpdate.current_comment = reportData.comment;

          await patchNEON({ table: 'companies', data: companyUpdate });
          await reloadCompanies();
          if (selectedCompany) fetchCompanyReports(selectedCompany.id);
          fetchAllReports();
      } catch (e) {
          console.error("Report submit error", e);
          alert("Feil ved innsending av rapport.");
      }
  };

  const handleDeleteReport = async (reportId: number) => {
       if (!window.confirm("Er du sikker på at du vil slette denne rapporten?")) return;
       try {
            await deleteNEON({ table: 'reports', data: reportId });
            logActivity(userProfile.id, 'DELETE_REPORT', 'reports', reportId, 'Slettet rapport');
            setReports(prev => prev.filter(r => r.id !== reportId));
            setAllReports(prev => prev.filter(r => r.id !== reportId));
            await reloadCompanies();
       } catch (e) { console.error("Delete report error", e); }
  };

  const handleApproveReport = async (reportId: number) => {
      if (isDemo) {
          const updater = (r: ReportLogItem) => r.id === reportId ? { ...r, status: 'approved' as const, approvedBy: 'Demo Controller' } : r;
          setReports(prev => prev.map(updater));
          setAllReports(prev => prev.map(updater));
          return;
      }
      try {
          await patchNEON({ table: 'reports', data: { id: reportId, status: 'approved', approved_by_user_id: userProfile.id } });
          logActivity(userProfile.id, 'APPROVE_REPORT', 'reports', reportId, 'Godkjente rapport');
          const updater = (r: ReportLogItem) => r.id === reportId ? { ...r, status: 'approved' as const, approvedBy: 'Kontroller' } : r;
          setReports(prev => prev.map(updater));
          setAllReports(prev => prev.map(updater));
      } catch (e) { console.error("Approval error", e); alert("Feil ved godkjenning."); }
  };

  const handleUnlockReport = async (reportId: number) => {
       try {
          await patchNEON({ table: 'reports', data: { id: reportId, status: 'submitted', approved_at: null, approved_by_user_id: null } });
          logActivity(userProfile.id, 'UNLOCK_REPORT', 'reports', reportId, 'Låste opp rapport');
          const updater = (r: ReportLogItem) => r.id === reportId ? { ...r, status: 'submitted' as const, approvedBy: undefined } : r;
          setReports(prev => prev.map(updater));
          setAllReports(prev => prev.map(updater));
      } catch (e) { console.error("Unlock error", e); }
  };

  const handleForecastSubmit = async (submittedForecasts: ForecastItem[]) => {
      try {
          for (const f of submittedForecasts) {
              const payload = {
                  companyId: f.companyId,
                  month: f.month,
                  estimatedReceivables: f.estimatedReceivables,
                  estimatedPayables: f.estimatedPayables
              };
              if (f.id) await patchNEON({ table: 'forecasts', data: { id: f.id, ...payload } });
              else await postNEON({ table: 'forecasts', data: payload });
          }
          logActivity(userProfile.id, 'UPDATE_FORECAST', 'forecasts', undefined, 'Oppdaterte likviditetsprognose');
          if(selectedCompany) fetchForecasts(selectedCompany.id);
      } catch(e) {}
  };
  
  const handleAdminSelectCompany = (companyId: number) => {
      const raw = companies.find(c => c.id === companyId);
      if (!raw) return;
      const now = new Date();
      const currentMonthIndex = now.getMonth();
      const dayOfMonth = now.getDate();
      const daysInCurrentMonth = new Date(now.getFullYear(), currentMonthIndex + 1, 0).getDate();
      const calcYTD = (months: number[]) => {
          let t = 0;
          for (let i = 0; i < currentMonthIndex; i++) t += Number(months[i] || 0);
          if (isTodayMode) t += (Number(months[currentMonthIndex] || 0) / daysInCurrentMonth) * dayOfMonth;
          return t;
      };
      let targetBudget = 0;
      let calculatedBudgetYTDLow: number | undefined;
      let calculatedBudgetYTDHigh: number | undefined;
      if (raw.budgetType === 'scenario' && raw.budgetMonthsLow && raw.budgetMonthsHigh) {
          calculatedBudgetYTDLow = calcYTD(raw.budgetMonthsLow);
          calculatedBudgetYTDHigh = calcYTD(raw.budgetMonthsHigh);
          targetBudget = (calculatedBudgetYTDLow + calculatedBudgetYTDHigh) / 2;
      } else {
          targetBudget = calcYTD(raw.budgetMonths || Array(12).fill(0));
      }
      const deviation = raw.resultYTD - targetBudget;
      const deviationPercent = targetBudget !== 0 ? (deviation / targetBudget) * 100 : 0;
      setSelectedCompany({ ...raw, calculatedBudgetYTD: targetBudget, calculatedDeviationPercent: deviationPercent, calculatedBudgetYTDLow, calculatedBudgetYTDHigh });
  };

  // --- REFRESH HANDLERS ---
  const handleGlobalRefresh = async () => {
      setIsGlobalRefreshing(true);
      await reloadCompanies();
      if (viewMode === ViewMode.ADMIN) await fetchAllReports();
      await new Promise(r => setTimeout(r, 600));
      setIsGlobalRefreshing(false);
  };
  
  const handleCompanyRefresh = async (companyId: number) => {
      await reloadCompanies();
      await fetchCompanyReports(companyId);
      await fetchForecasts(companyId);
      await new Promise(r => setTimeout(r, 600));
  };

  // --- USER HANDLERS ---
  const handleAddUser = async (user: Omit<UserData, 'id'>) => {
      try {
          const payload = {
              email: user.email,
              password: user.password,
              full_name: user.fullName,
              role: user.role,
              group_id: userProfile.groupId,
              is_super_admin: user.is_super_admin ?? false
          };
          const res = await postNEON({ table: 'users', data: payload });
          const createdUser = res.inserted[0];
          logActivity(userProfile.id, 'CREATE_USER', 'users', createdUser.id, `Opprettet bruker: ${user.email}`);
          // Give new user access to current group
          await postNEON({ table: 'usergroupaccess', data: { user_id: createdUser.id, group_id: userProfile.groupId } });
          if (user.companyIds && user.companyIds.length > 0) {
              const accessRows = user.companyIds.map(cid => ({ user_id: createdUser.id, company_id: cid }));
              await postNEON({ table: 'usercompanyaccess', data: accessRows });
          }
          fetchUsers();
          if (user.role === 'leader' && user.companyIds && user.companyIds.length > 0) await syncManagers(user.companyIds);
      } catch (e) { console.error("Add user error", e); alert("Kunne ikke legge til bruker"); }
  };

  const handleUpdateUser = async (user: UserData) => {
      try {
          const payload: any = { id: user.id, email: user.email, full_name: user.fullName, role: user.role, is_super_admin: user.is_super_admin ?? false };
          if (user.password) payload.password = user.password;
          await patchNEON({ table: 'users', data: payload });
          
          const accessRes = await getNEON({ table: 'usercompanyaccess', where: { user_id: user.id } });
          const existingIds = (accessRes.rows || []).map((r:any) => r.id);
          const existingCompanyIds = (accessRes.rows || []).map((r:any) => r.companyId || r.company_id);
          if (existingIds.length > 0) await deleteNEON({ table: 'usercompanyaccess', data: existingIds });

          if (user.companyIds && user.companyIds.length > 0) {
              const accessRows = user.companyIds.map(cid => ({ user_id: user.id, company_id: cid }));
              await postNEON({ table: 'usercompanyaccess', data: accessRows });
          }
          logActivity(userProfile.id, 'UPDATE_USER', 'users', user.id, `Oppdaterte bruker: ${user.email}`);
          fetchUsers();
          const allAffectedIds = [...new Set([...existingCompanyIds, ...(user.companyIds || [])])];
          await syncManagers(allAffectedIds);
      } catch (e) { console.error("Update user error", e); alert("Kunne ikke oppdatere bruker"); }
  };

  const handleDeleteUser = async (id: number) => {
       try {
          const accessRes = await getNEON({ table: 'usercompanyaccess', where: { user_id: id } });
          const existingCompanyIds = (accessRes.rows || []).map((r:any) => r.companyId || r.company_id);
          await deleteNEON({ table: 'usercompanyaccess', data: id, field: 'user_id' });
          await deleteNEON({ table: 'users', data: id });
          logActivity(userProfile.id, 'DELETE_USER', 'users', id, 'Slettet bruker');
          setUsers(users.filter(u => u.id !== id));
          await syncManagers(existingCompanyIds);
      } catch (e) { console.error("Delete user error", e); alert("Kunne ikke slette bruker (sjekk om brukeren har rapporter)"); }
  };

  const handleLogout = () => {
      logActivity(userProfile.id, 'LOGOUT', 'users', userProfile.id, 'Logget ut');
      if (hasMultipleKonsern) {
          // Keep user logged in but go back to konsern selection
          localStorage.removeItem('konsern_mode');
      } else {
          // Single konsern — full logout to login screen
          localStorage.removeItem('konsern_user_id');
          localStorage.removeItem('konsern_mode');
      }
      window.initKonsernKontroll();
  };

  const toggleMode = () => {
      const newMode = isDemo ? 'live' : 'demo';
      window.initKonsernKontroll(undefined, newMode === 'demo');
  };

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  useEffect(() => {
    if (!isDemo) {
      getNEON({ table: 'group_features', where: { group_id: userProfile.groupId } })
        .then(res => {
          const enabled = (res.rows || [])
            .filter((r: any) => r.enabled)
            .map((r: any) => r.feature_key || r.featureKey);
          setGroupFeatures(enabled);
        })
        .catch(() => {});
    }
  }, [userProfile.groupId, isDemo]);

  const visibleCompanies = useMemo(() => {
      if (effectiveRole === 'leader') {
          if (isDemo) return companies.filter(c => c.name === 'BCC' || c.name === 'PHR'); 
          if (userProfile.companyIds && userProfile.companyIds.length > 0) {
              return companies.filter(c => userProfile.companyIds!.includes(c.id));
          }
          return [];
      }
      return companies;
  }, [companies, effectiveRole, isDemo, userProfile.companyIds]);

  const computedData: ComputedCompanyData[] = useMemo(() => {
    const now = new Date();
    const currentMonthIndex = now.getMonth();
    const dayOfMonth = now.getDate();
    const daysInCurrentMonth = new Date(now.getFullYear(), currentMonthIndex + 1, 0).getDate();

    const calcYTD = (months: number[]): number => {
      let t = 0;
      for (let i = 0; i < currentMonthIndex; i++) t += Number(months[i] || 0);
      if (isTodayMode) t += (Number(months[currentMonthIndex] || 0) / daysInCurrentMonth) * dayOfMonth;
      return t;
    };

    return visibleCompanies.map(company => {
        const isScenario = company.budgetType === 'scenario';
        let targetBudget = 0;
        let calculatedBudgetYTDLow: number | undefined;
        let calculatedBudgetYTDHigh: number | undefined;

        if (isScenario && company.budgetMonthsLow && company.budgetMonthsHigh) {
            calculatedBudgetYTDLow = calcYTD(company.budgetMonthsLow);
            calculatedBudgetYTDHigh = calcYTD(company.budgetMonthsHigh);
            targetBudget = (calculatedBudgetYTDLow + calculatedBudgetYTDHigh) / 2;
        } else {
            targetBudget = calcYTD(company.budgetMonths);
        }

        const deviation = company.resultYTD - targetBudget;
        const deviationPercent = targetBudget !== 0 ? (deviation / targetBudget) * 100 : 0;
        return { ...company, calculatedBudgetYTD: targetBudget, calculatedDeviationPercent: deviationPercent, calculatedBudgetYTDLow, calculatedBudgetYTDHigh };
    });
  }, [isTodayMode, visibleCompanies]);

  const displayedData = useMemo(() => {
    if (viewMode === ViewMode.CONTROL) return computedData.filter(c => c.calculatedDeviationPercent < 0);
    return computedData;
  }, [computedData, viewMode]);

  const sortedData = useMemo(() => {
    if (isSortMode) return displayedData; 
    const data = [...displayedData];
    switch (sortField) {
      case SortField.RESULT: return data.sort((a, b) => b.resultYTD - a.resultYTD);
      case SortField.DEVIATION: return data.sort((a, b) => a.calculatedDeviationPercent - b.calculatedDeviationPercent);
      case SortField.LIQUIDITY: return data.sort((a, b) => b.liquidity - a.liquidity);
      default: return data; 
    }
  }, [displayedData, sortField, isSortMode]);

  // Aggregations
  const totalRevenue = computedData.reduce((acc, curr) => acc + curr.revenue, 0);
  const totalExpenses = computedData.reduce((acc, curr) => acc + curr.expenses, 0);
  const totalResult = computedData.reduce((acc, curr) => acc + curr.resultYTD, 0);
  const totalBudgetYTD = computedData.reduce((acc, curr) => acc + curr.calculatedBudgetYTD, 0);
  const totalLiquidity = computedData.reduce((acc, curr) => acc + curr.liquidity, 0);
  const totalReceivables = computedData.reduce((acc, curr) => acc + curr.receivables, 0);
  const totalPayables = computedData.reduce((acc, curr) => acc + curr.accountsPayable, 0);
  const totalPublicFees = computedData.reduce((acc, curr) => acc + curr.publicFees, 0);
  const totalSalaryExpenses = computedData.reduce((acc, curr) => acc + (curr.salaryExpenses || 0), 0);
  const totalShortTermDebt = computedData.reduce((acc, curr) => acc + (curr.shortTermDebt || 0), 0);
  const curMonth = new Date().getMonth() + 1;
  const totalLoyaltyBonusYTD = computedData.reduce((acc, curr) => acc + Math.round((curr.loyaltyBonus || 0) / 12 * curMonth), 0);
  const totalWorkingCapital = (totalLiquidity + totalReceivables) - (totalPayables + totalPublicFees + (showShortTermDebt ? totalShortTermDebt : 0));
  
  const currentDateDisplay = new Date().toLocaleDateString('no-NO', { day: 'numeric', month: 'long' });
  const lastMonthDisplay = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toLocaleDateString('no-NO', { day: 'numeric', month: 'long' });

  if (selectedCompany && viewMode === ViewMode.PROJECTS && selectedProject) {
    return (
      <ProjectDetailView
        project={selectedProject}
        companyName={selectedCompany.name}
        onBack={() => setSelectedProject(null)}
        onUpdated={(updated) => setSelectedProject(updated)}
      />
    );
  }

  if (selectedCompany && viewMode === ViewMode.PROJECTS) {
    return (
      <ProjectDashboard
        companyId={selectedCompany.id}
        groupId={userProfile.groupId}
        companyName={selectedCompany.name}
        onBack={() => setViewMode(ViewMode.GRID)}
        onSelectProject={(p) => setSelectedProject(p)}
      />
    );
  }

  const handleSaveMonthlyEntry = async (entry: MonthlyEntryData) => {
    if (isDemo) return;
    // Upsert: check if entry exists first
    const existingRes = await getNEON({ table: 'monthly_entries', where: { company_id: entry.companyId, year: entry.year, month: entry.month } });
    const existingRow = existingRes.rows?.[0];
    const entryData = {
      company_id: entry.companyId,
      year: entry.year,
      month: entry.month,
      revenue: entry.revenue,
      expenses: entry.expenses,
      liquidity: entry.liquidity,
      receivables: entry.receivables,
      accounts_payable: entry.accountsPayable,
      salary_expenses: entry.salaryExpenses,
      public_fees: entry.publicFees,
      short_term_debt: entry.shortTermDebt,
    };
    if (existingRow) {
      await patchNEON({ table: 'monthly_entries', data: { id: existingRow.id, ...entryData } });
    } else {
      await postNEON({ table: 'monthly_entries', data: entryData });
    }

    // Fetch all entries for this company up to current month
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    const allEntries = await getNEON({ table: 'monthly_entries', where: { company_id: entry.companyId } });
    const rows: any[] = allEntries.rows || [];

    // Sum YTD: all entries where (year < curYear) or (year === curYear and month <= curMonth)
    let ytdRevenue = 0, ytdExpenses = 0, ytdLiquidity = 0, ytdReceivables = 0;
    let ytdAccountsPayable = 0, ytdSalary = 0, ytdPublicFees = 0, ytdShortTermDebt = 0;
    for (const r of rows) {
      const rYear = Number(r.year);
      const rMonth = Number(r.month);
      if (rYear < curYear || (rYear === curYear && rMonth <= curMonth)) {
        ytdRevenue += Number(r.revenue || 0);
        ytdExpenses += Number(r.expenses || 0);
        ytdLiquidity += Number(r.liquidity || 0);
        ytdReceivables += Number(r.receivables || 0);
        ytdAccountsPayable += Number(r.accounts_payable || 0);
        ytdSalary += Number(r.salary_expenses || 0);
        ytdPublicFees += Number(r.public_fees || 0);
        ytdShortTermDebt += Number(r.short_term_debt || 0);
      }
    }

    // Update the company with YTD sums
    await patchNEON({
      table: 'companies',
      data: {
        id: entry.companyId,
        revenue: ytdRevenue,
        expenses: ytdExpenses,
        result_ytd: ytdRevenue - ytdExpenses,
        liquidity: ytdLiquidity,
        receivables: ytdReceivables,
        accounts_payable: ytdAccountsPayable,
        salary_expenses: ytdSalary,
        public_fees: ytdPublicFees,
        short_term_debt: ytdShortTermDebt,
        last_report_date: new Date().toLocaleDateString('no-NO'),
        last_report_by: userProfile.fullName,
      },
    });

    await reloadCompanies();
    if (selectedCompany) {
      fetchCompanyReports(selectedCompany.id);
      fetchMonthlyEntries(selectedCompany.id);
    }
  };

  if (selectedCompany) {
    return (
      <CompanyDetailView
        company={selectedCompany}
        reports={reports}
        forecasts={forecasts}
        userRole={effectiveRole}
        onBack={() => setSelectedCompany(null)}
        onReportSubmit={handleSubmitReport}
        onApproveReport={handleApproveReport}
        onUnlockReport={handleUnlockReport}
        onDeleteReport={handleDeleteReport}
        onForecastSubmit={handleForecastSubmit}
        onUpdateCompany={handleUpdateCompany}
        onRefresh={async () => await handleCompanyRefresh(selectedCompany.id)}
        hasProjectsModule={groupFeatures.includes('projects')}
        onOpenProjects={() => { setSelectedProject(null); setViewMode(ViewMode.PROJECTS); }}
        onSaveMonthlyEntry={handleSaveMonthlyEntry}
        monthlyEntries={monthlyEntries}
        onDeleteMonthlyEntry={handleDeleteMonthlyEntry}
        showLoyaltyBonus={showLoyaltyBonus}
      />
    );
  }

  const isAdminMode = viewMode === ViewMode.ADMIN || viewMode === ViewMode.ADMIN_REPORTS || viewMode === ViewMode.USER_ADMIN || viewMode === ViewMode.SUPER_ADMIN || viewMode === ViewMode.LIQUIDITY_POOL;

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-slate-900 pb-32 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300 ${isSortMode ? 'sort-mode-active touch-none' : ''}`}>
      
      <Header 
        userProfile={userProfile}
        isDemo={isDemo}
        isDarkMode={isDarkMode}
        setIsDarkMode={setIsDarkMode}
        demoRole={demoRole}
        setDemoRole={setDemoRole}
        handleLogout={handleLogout}
        toggleMode={toggleMode}
        setIsPasswordModalOpen={setIsPasswordModalOpen}
        viewMode={viewMode}
        setViewMode={setViewMode}
        effectiveRole={effectiveRole}
        isAdminMode={isAdminMode}
        onResetView={() => { setViewMode(ViewMode.GRID); setSelectedCompany(null); }}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        
        {isSortMode && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 animate-in slide-in-from-bottom-10 duration-300">
                <div className="bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 border border-slate-700">
                    <span className="text-sm font-bold animate-pulse">Sorteringsmodus</span>
                    <div className="h-4 w-px bg-slate-600"></div>
                    <button onClick={saveSort} className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-bold text-sm"><Check size={16}/> Lagre</button>
                    <button onClick={cancelSort} className="flex items-center gap-1 text-rose-400 hover:text-rose-300 font-bold text-sm"><X size={16}/> Avbryt</button>
                </div>
            </div>
        )}

        {isAdminMode && (
            <div className="flex justify-center mb-6 animate-in slide-in-from-top-2">
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm w-full md:w-auto">
                    <button 
                        onClick={() => setViewMode(ViewMode.ADMIN_REPORTS)} 
                        className={`flex-1 md:flex-none flex justify-center items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${viewMode === ViewMode.ADMIN_REPORTS ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        <FileText size={16} /> Rapporter
                    </button>
                    <button 
                        onClick={() => setViewMode(ViewMode.ADMIN)} 
                        className={`flex-1 md:flex-none flex justify-center items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${viewMode === ViewMode.ADMIN ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        <Building2 size={16} /> Selskaper
                    </button>
                    <button 
                        onClick={() => setViewMode(ViewMode.USER_ADMIN)} 
                        className={`flex-1 md:flex-none flex justify-center items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${viewMode === ViewMode.USER_ADMIN ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        <Users size={16} /> Brukere
                    </button>
                    <button
                        onClick={() => setViewMode(ViewMode.LIQUIDITY_POOL)}
                        className={`flex-1 md:flex-none flex justify-center items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${viewMode === ViewMode.LIQUIDITY_POOL ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        <Banknote size={16} /> Likviditetspool
                    </button>
                    {userProfile.isSuperAdmin && (
                        <button
                            onClick={() => setViewMode(ViewMode.SUPER_ADMIN)}
                            className={`flex-1 md:flex-none flex justify-center items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300 ${viewMode === ViewMode.SUPER_ADMIN ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                        >
                            <Shield size={16} /> Konsern
                        </button>
                    )}
                </div>
            </div>
        )}

        {(viewMode === ViewMode.ADMIN || viewMode === ViewMode.ADMIN_REPORTS) && effectiveRole === 'controller' && (
           <AdminView 
               currentView={viewMode === ViewMode.ADMIN_REPORTS ? 'reports' : 'companies'}
               companies={companies} 
               users={users}
               allReports={allReports}
               onAdd={handleAddCompany} 
               onUpdate={handleUpdateCompany} 
               onDelete={handleDeleteCompany}
               onViewReport={(r) => {}} 
               onReportSubmit={handleSubmitReport}
               onApproveReport={handleApproveReport}
               onUnlockReport={handleUnlockReport}
               onDeleteReport={handleDeleteReport}
               onSelectCompany={handleAdminSelectCompany}
           />
        )}
        
        {viewMode === ViewMode.USER_ADMIN && effectiveRole === 'controller' && (
            <UserAdminView users={users} companies={companies} onAdd={handleAddUser} onUpdate={handleUpdateUser} onDelete={handleDeleteUser} />
        )}
        {viewMode === ViewMode.LIQUIDITY_POOL && effectiveRole === 'controller' && (
            <LiquidityPoolView
                pools={liquidityPools}
                companies={companies}
                onCreatePool={handleCreatePool}
                onDeletePool={handleDeletePool}
                onToggleCompany={handleToggleCompanyInPool}
            />
        )}
        {viewMode === ViewMode.SUPER_ADMIN && userProfile.isSuperAdmin && (
            <SuperAdminView onBack={() => setViewMode(ViewMode.ADMIN)} />
        )}
        
        {!isAdminMode && (
            <>
                <div className={`flex flex-col md:flex-row justify-between items-center mb-8 gap-4 transition-opacity duration-300 ${isSortMode ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                    <div className="flex items-center bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors duration-300">
                        <button onClick={() => setIsTodayMode(false)} className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${!isTodayMode ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>Siste mnd <span className="hidden xl:inline text-[10px] font-normal text-slate-400 dark:text-slate-500 ml-1">({lastMonthDisplay})</span></button>
                        <div className="w-2"></div>
                        <button onClick={() => setIsTodayMode(true)} className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${isTodayMode ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>I dag <span className="hidden xl:inline text-[10px] font-normal text-slate-400 dark:text-slate-500 ml-1">({currentDateDisplay})</span></button>
                        
                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-2"></div>
                        
                        <button 
                            onClick={handleGlobalRefresh}
                            className={`p-2 rounded-lg transition-all ${isGlobalRefreshing ? 'bg-slate-100 dark:bg-slate-700 text-sky-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                            title="Oppdater tall"
                        >
                            <RefreshCw size={16} className={isGlobalRefreshing ? 'animate-spin' : ''} />
                        </button>

                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-2"></div>

                        <div className="flex items-center gap-1">
                            <button 
                                onClick={handleZoomOut} 
                                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all hover:bg-slate-100 dark:hover:bg-slate-700/50"
                                title="Zoom ut"
                            >
                                <ZoomOut size={16} />
                            </button>
                            {zoomLevel !== 100 && (
                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 w-8 text-center tabular-nums">
                                    {zoomLevel}%
                                </span>
                            )}
                            <button 
                                onClick={handleZoomIn} 
                                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all hover:bg-slate-100 dark:hover:bg-slate-700/50"
                                title="Zoom inn"
                            >
                                <ZoomIn size={16} />
                            </button>
                        </div>

                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-2"></div>

                        <button 
                            onClick={() => setCardSize('normal')} 
                            className={`p-2 rounded-lg transition-all ${cardSize === 'normal' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                            title="Stor visning"
                        >
                            <Grid2X2 size={16} />
                        </button>
                        <button
                            onClick={() => setCardSize('compact')}
                            className={`p-2 rounded-lg transition-all ${cardSize === 'compact' ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                            title="Kompakt visning"
                        >
                            <LayoutTemplate size={16} />
                        </button>

                        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-2"></div>

                        <button
                            onClick={() => setViewMode(viewMode === ViewMode.PULSE ? ViewMode.GRID : ViewMode.PULSE)}
                            className={`p-2 rounded-lg transition-all ${viewMode === ViewMode.PULSE ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                            title="Puls – On Track / Off Track"
                        >
                            <Activity size={16} />
                        </button>

                        <button
                            onClick={() => setIsCardSettingsOpen(true)}
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all hover:bg-slate-100 dark:hover:bg-slate-700/50"
                            title="Kortinnstillinger"
                        >
                            <Settings size={16} />
                        </button>
                    </div>

                    <div className="flex bg-slate-200/60 dark:bg-slate-800 p-1 rounded-lg self-end md:self-auto transition-colors duration-300">
                        <button onClick={() => setViewMode(ViewMode.GRID)} className={`flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === ViewMode.GRID ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}><LayoutGrid className="w-3.5 h-3.5 mr-1.5" />Kort</button>
                        <button onClick={() => setViewMode(ViewMode.ANALYTICS)} className={`flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === ViewMode.ANALYTICS ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}><BarChart3 className="w-3.5 h-3.5 mr-1.5" />Analyse</button>
                        <button onClick={() => setViewMode(ViewMode.CONTROL)} className={`flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === ViewMode.CONTROL ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}><ShieldAlert className="w-3.5 h-3.5 mr-1.5" />Kontroll</button>
                        <button onClick={handleSortToggle} className={`flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition-all text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white`}><ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />Sort</button>
                    </div>
                </div>
                
                {viewMode === ViewMode.PULSE ? (
                    <PulseView
                        companies={sortedData}
                        dateLabel={isTodayMode ? currentDateDisplay : lastMonthDisplay}
                        onSelectCompany={setSelectedCompany}
                    />
                ) : viewMode === ViewMode.ANALYTICS ? (
                    <AnalyticsView data={sortedData} />
                ) : (
                    <>
                        {viewMode === ViewMode.CONTROL && displayedData.length === 0 && (
                            <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700"><div className="bg-emerald-100 dark:bg-emerald-900/30 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"><ShieldAlert className="text-emerald-600 dark:text-emerald-400" size={24} /></div><h3 className="text-lg font-bold text-slate-900 dark:text-white">Ingen selskaper krever kontroll</h3></div>
                        )}
                        
                        <DashboardGrid
                            sortedData={sortedData}
                            isSortMode={isSortMode}
                            cardSize={cardSize}
                            zoomLevel={zoomLevel}
                            showShortTermDebt={showShortTermDebt}
                            showLoyaltyBonus={showLoyaltyBonus}
                            visibleFields={visibleFields}
                            onSelectCompany={setSelectedCompany}
                            onDragStart={onDragStart}
                            onDragEnter={onDragEnter}
                            onDragEnd={onDragEnd}
                        />
                    </>
                )}
            </>
        )}
      </main>
      
      {/* Card Settings Modal */}
      {isCardSettingsOpen && (() => {
        const FIELD_GROUPS: { label: string; fields: { key: keyof typeof visibleFields; label: string; footer?: boolean }[] }[] = [
          {
            label: 'Resultat',
            fields: [
              { key: 'omsetning', label: 'Omsetning YTD', footer: true },
              { key: 'kostnader', label: 'Kostnader YTD', footer: true },
              { key: 'resultat', label: 'Resultat YTD', footer: true },
              { key: 'budsjett', label: 'Budsjett YTD', footer: true },
            ]
          },
          {
            label: 'Balanse',
            fields: [
              { key: 'likviditet', label: 'Likviditet', footer: true },
              { key: 'fordringer', label: 'Fordringer', footer: true },
              { key: 'leverandorgjeld', label: 'Leverandørgjeld', footer: true },
              { key: 'kortsiktigGjeld', label: 'Kortsiktig gjeld', footer: true },
              { key: 'offAvgifter', label: 'Off. Avgifter', footer: true },
              { key: 'lonnskostnad', label: 'Lønnskostnad', footer: true },
            ]
          },
          {
            label: 'Nøkkeltall',
            fields: [
              { key: 'nettoArbeidskapital', label: 'Netto Arbeidskapital', footer: true },
            ]
          },
        ];
        const allOn = Object.values(visibleFields).every(Boolean);
        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <Settings size={18} className="text-slate-500" />
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Kortinnstillinger</h2>
                </div>
                <button onClick={() => setIsCardSettingsOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
                <p className="text-xs text-slate-400 dark:text-slate-500">Velg hvilke felter som vises på firmakortene og i footeren. Påvirker ikke utregninger.</p>

                {/* Kortsiktig gjeld – calculation toggle */}
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500 mb-2">Utregning</p>
                  <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <label className="flex items-start justify-between px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors gap-3 border-b border-slate-200 dark:border-slate-700/60">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${showShortTermDebt ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
                          Kortsiktig gjeld i utregning
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 leading-snug">
                          Når på: trekkes fra Netto Arbeidskapital. Når av: vises som rad, men påvirker ikke summen.
                        </p>
                      </div>
                      <div className="relative shrink-0 mt-0.5">
                        <input type="checkbox" checked={showShortTermDebt} onChange={() => setShowShortTermDebt(v => !v)} className="sr-only" />
                        <div className={`w-9 h-5 rounded-full transition-colors duration-200 ${showShortTermDebt ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                          <div className="w-3.5 h-3.5 bg-white rounded-full shadow-sm absolute transition-all duration-200" style={{ top: '3px', left: showShortTermDebt ? '18px' : '3px' }} />
                        </div>
                      </div>
                    </label>
                    <label className="flex items-start justify-between px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors gap-3">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${showLoyaltyBonus ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
                          Lojalitetsbonus i utregning
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 leading-snug">
                          Når på: årssum fordelt på 12 mnd trekkes fra Resultat YTD på kortene og i footeren. Settes per selskap i admin.
                        </p>
                      </div>
                      <div className="relative shrink-0 mt-0.5">
                        <input type="checkbox" checked={showLoyaltyBonus} onChange={() => setShowLoyaltyBonus(v => !v)} className="sr-only" />
                        <div className={`w-9 h-5 rounded-full transition-colors duration-200 ${showLoyaltyBonus ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                          <div className="w-3.5 h-3.5 bg-white rounded-full shadow-sm absolute transition-all duration-200" style={{ top: '3px', left: showLoyaltyBonus ? '18px' : '3px' }} />
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Toggle all */}
                <button
                  onClick={() => setVisibleFields(prev => Object.fromEntries(Object.keys(prev).map(k => [k, !allOn])) as typeof visibleFields)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  {allOn ? <EyeOff size={14} /> : <Eye size={14} />}
                  {allOn ? 'Skjul alle' : 'Vis alle'}
                </button>

                {FIELD_GROUPS.map(group => (
                  <div key={group.label}>
                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500 mb-2">{group.label}</p>
                    <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                      {group.fields.map((field, idx) => (
                        <label
                          key={field.key}
                          className={`flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors ${idx > 0 ? 'border-t border-slate-200 dark:border-slate-700/60' : ''}`}
                        >
                          <span className={`text-sm font-medium ${visibleFields[field.key] ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500 line-through'}`}>
                            {field.label}
                          </span>
                          <div className="relative">
                            <input
                              type="checkbox"
                              checked={visibleFields[field.key]}
                              onChange={() => setVisibleFields(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                              className="sr-only"
                            />
                            <div className={`w-9 h-5 rounded-full transition-colors duration-200 ${visibleFields[field.key] ? 'bg-sky-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                              <div className={`w-3.5 h-3.5 bg-white rounded-full shadow-sm absolute top-0.75 transition-transform duration-200 ${visibleFields[field.key] ? 'translate-x-4.5' : 'translate-x-0.75'}`} style={{ top: '3px', left: visibleFields[field.key] ? '18px' : '3px' }} />
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end px-6 pb-5 pt-2">
                <button
                  onClick={() => setIsCardSettingsOpen(false)}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold text-sm transition-colors"
                >
                  Ferdig
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Password Change Modal */}
      {isPasswordModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><KeyRound size={18}/> Endre Passord</h3>
                    <button onClick={() => setIsPasswordModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleChangePassword} className="p-6 space-y-4">
                    <div>
                        <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Gammelt Passord</label>
                        <input 
                            type="password"
                            required
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                            value={passwordForm.oldPassword}
                            onChange={e => setPasswordForm({...passwordForm, oldPassword: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Nytt Passord</label>
                        <input 
                            type="password"
                            required
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                            value={passwordForm.newPassword}
                            onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                        />
                    </div>
                     <div>
                        <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Bekreft Nytt Passord</label>
                        <input 
                            type="password"
                            required
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                            value={passwordForm.confirmPassword}
                            onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                        />
                    </div>
                    <div className="pt-2">
                        <button type="submit" className="w-full bg-sky-600 hover:bg-sky-500 text-white rounded-lg py-2 font-bold shadow-md transition-all">
                            Oppdater Passord
                        </button>
                    </div>
                </form>
            </div>
          </div>
      )}

      <Footer
        totalRevenue={totalRevenue}
        totalExpenses={totalExpenses}
        totalResult={totalResult}
        totalBudgetYTD={totalBudgetYTD}
        totalLiquidity={totalLiquidity}
        totalReceivables={totalReceivables}
        totalPayables={totalPayables}
        totalShortTermDebt={totalShortTermDebt}
        totalPublicFees={totalPublicFees}
        totalSalaryExpenses={totalSalaryExpenses}
        totalWorkingCapital={totalWorkingCapital}
        totalLoyaltyBonusYTD={totalLoyaltyBonusYTD}
        showShortTermDebt={showShortTermDebt}
        showLoyaltyBonus={showLoyaltyBonus}
        visibleFields={visibleFields}
        isAdminMode={isAdminMode}
        liquidityPools={liquidityPools}
        companies={companies}
      />
    </div>
  );
}

export default App;