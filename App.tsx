import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ComputedCompanyData, SortField, ViewMode, CompanyData, UserData, ReportLogItem, ForecastItem } from './types';
import AnalyticsView from './components/AnalyticsView';
import CompanyDetailView from './components/CompanyDetailView';
import AdminView from './components/AdminView';
import UserAdminView from './components/UserAdminView';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import DashboardGrid from './components/layout/DashboardGrid';
import { postNEON, patchNEON, deleteNEON, getNEON } from './utils/neon';
import { hashPassword } from './utils/crypto';
import { logActivity } from './utils/logging';
import { 
  ArrowUpDown, 
  ShieldAlert,
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
  Users
} from 'lucide-react';

interface UserProfile {
    id: number;
    fullName: string;
    role: 'controller' | 'leader';
    groupId: number;
    groupName: string;
    logoUrl?: string;
    companyIds?: number[]; 
}

interface AppProps {
    userProfile: UserProfile;
    initialCompanies: CompanyData[];
    isDemo: boolean;
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

function App({ userProfile, initialCompanies, isDemo }: AppProps) {
  const [sortField, setSortField] = useState<SortField>(SortField.DEFAULT);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.GRID);
  const [cardSize, setCardSize] = useState<'normal' | 'compact'>('normal');
  const [isTodayMode, setIsTodayMode] = useState<boolean>(false);
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

  // SORTING STATE
  const [isSortMode, setIsSortMode] = useState(false);
  const [originalOrder, setOriginalOrder] = useState<CompanyData[]>([]);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  
  // PASSWORD CHANGE STATE
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });

  // REFRESH STATE
  const [isGlobalRefreshing, setIsGlobalRefreshing] = useState(false);

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
                      data: { id: update.id, sortOrder: update.sortOrder } 
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
        const res = await getNEON({ table: 'users', where: { groupId: userProfile.groupId } });
        if(res.rows) {
            const accessRes = await getNEON({ table: 'usercompanyaccess' });
            const allAccess = accessRes.rows || [];

            const mappedUsers = res.rows.map((u: any) => {
                const userAccess = allAccess
                    .filter((a: any) => (a.userId || a.user_id) === u.id)
                    .map((a: any) => a.companyId || a.company_id);
                
                const legacyId = u.companyId || u.company_id;
                if(userAccess.length === 0 && legacyId) {
                    userAccess.push(legacyId);
                }

                return {
                    id: u.id,
                    email: u.email,
                    fullName: u.fullName || u.full_name,
                    role: u.role,
                    groupId: u.groupId || u.group_id,
                    companyId: legacyId, 
                    companyIds: userAccess 
                };
            });
            setUsers(mappedUsers);
        }
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
          const res = await getNEON({ table: 'reports', where: { companyId } });
          if (res.rows) {
              const mapped = mapReports(res.rows);
              setReports(mapped);
          }
      } catch (e) { console.error("Fetch company reports error", e); }
  };
  
  const fetchForecasts = async (companyId: number) => {
       try {
            const res = await getNEON({ table: 'forecasts', where: { companyId } });
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
         liquidityDate: r.liquidityDate || r.liquidity_date || '',
         receivablesDate: r.receivablesDate || r.receivables_date || '',
         accountsPayableDate: r.accountsPayableDate || r.accounts_payable_date || '',
         publicFeesDate: r.publicFeesDate || r.public_fees_date || '',
         salaryExpensesDate: r.salaryExpensesDate || r.salary_expenses_date || '', 
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
             companyWhere = { groupId: userProfile.groupId };
        } else {
            companyWhere = { groupId: userProfile.groupId };
        }

        const compRes = await getNEON({ table: 'companies', where: companyWhere });
        if(compRes.rows) {
            let filteredRows = compRes.rows;
            // Manual filtering for Leader
            if (effectiveRole === 'leader' && userProfile.companyIds && userProfile.companyIds.length > 0) {
                filteredRows = filteredRows.filter((c: any) => userProfile.companyIds!.includes(c.id));
            }

            const mapped = filteredRows.map((c: any) => {
                let bMonths: number[] = [];
                const rawMonths = c.budgetMonths ?? c.budget_months; 
                try {
                    if (Array.isArray(rawMonths)) {
                        bMonths = rawMonths.map(Number);
                    } else if (typeof rawMonths === 'object' && rawMonths !== null) {
                        bMonths = Object.values(rawMonths).map(Number);
                    } else if (typeof rawMonths === 'string') {
                        let cleanStr = rawMonths.trim();
                        if (cleanStr.startsWith('{') && cleanStr.endsWith('}')) {
                            cleanStr = cleanStr.replace('{', '[').replace('}', ']');
                        }
                        try {
                            const parsed = JSON.parse(cleanStr);
                            if (Array.isArray(parsed)) bMonths = parsed.map(Number);
                        } catch (jsonErr) {
                             const parts = cleanStr.replace(/[\[\]\{\}]/g, '').split(',');
                            if (parts.length > 0 && !parts.some(p => isNaN(Number(p)))) {
                                bMonths = parts.map(Number);
                            }
                        }
                    }
                } catch(e) { console.warn("Budget parsing error in reload", e); }

                if (!bMonths || bMonths.length !== 12 || bMonths.some(isNaN)) {
                    bMonths = Array(12).fill(0);
                }

                const bTotal = Number(c.budgetTotal || c.budget_total || 0);
                const sumMonths = bMonths.reduce((a, b) => a + b, 0);

                if ((sumMonths === 0 || isNaN(sumMonths)) && bTotal > 0) {
                     const perMonth = Math.round(bTotal / 12);
                     bMonths = Array(12).fill(perMonth);
                     bMonths[11] += (bTotal - (perMonth * 12));
                }

                return {
                    ...c,
                    resultYTD: Number(c.resultYtd || c.result_ytd || 0),
                    budgetTotal: bTotal,
                    budgetMode: c.budgetMode || c.budget_mode || 'annual',
                    budgetMonths: bMonths,
                    liquidity: Number(c.liquidity || 0),
                    receivables: Number(c.receivables || 0),
                    accountsPayable: Number(c.accountsPayable || c.accounts_payable || 0),
                    publicFees: Number(c.publicFees || c.public_fees || 0), 
                    salaryExpenses: Number(c.salaryExpenses || c.salary_expenses || 0), 
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
                    let targetBudget = 0;
                    const bMonths = updated.budgetMonths;
                    if (isTodayMode) {
                         for (let i = 0; i < currentMonthIndex; i++) targetBudget += bMonths[i];
                         targetBudget += (bMonths[currentMonthIndex] / daysInCurrentMonth) * now.getDate();
                    } else {
                         for (let i = 0; i < currentMonthIndex; i++) targetBudget += bMonths[i];
                    }
                    const deviation = updated.resultYTD - targetBudget;
                    const deviationPercent = targetBudget !== 0 ? (deviation / targetBudget) * 100 : 0;
                    setSelectedCompany({
                        ...updated,
                        calculatedBudgetYTD: targetBudget,
                        calculatedDeviationPercent: deviationPercent
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
              groupId: userProfile.groupId, 
              name: newCompany.name,
              fullName: newCompany.fullName,
              manager: newCompany.manager,
              revenue: newCompany.revenue,
              expenses: newCompany.expenses,
              resultYtd: newCompany.resultYTD, 
              budgetTotal: newCompany.budgetTotal,
              budget_total: newCompany.budgetTotal, 
              budgetMode: newCompany.budgetMode,
              budget_mode: newCompany.budgetMode, 
              budgetMonths: newCompany.budgetMonths,
              budget_months: newCompany.budgetMonths, 
              liquidity: newCompany.liquidity,
              receivables: newCompany.receivables,
              accountsPayable: newCompany.accountsPayable,
              publicFees: newCompany.publicFees,
              salaryExpenses: newCompany.salaryExpenses,
              pnlDate: newCompany.pnlDate,
              liquidityDate: newCompany.liquidityDate,
              receivablesDate: newCompany.receivablesDate,
              accountsPayableDate: newCompany.accountsPayableDate,
              publicFeesDate: newCompany.publicFeesDate,
              salaryExpensesDate: newCompany.salaryExpensesDate,
              trendHistory: newCompany.trendHistory
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
              fullName: updatedCompany.fullName,
              manager: updatedCompany.manager,
              revenue: updatedCompany.revenue,
              expenses: updatedCompany.expenses,
              resultYtd: updatedCompany.resultYTD,
              budgetTotal: updatedCompany.budgetTotal,
              budget_total: updatedCompany.budgetTotal, 
              budgetMode: updatedCompany.budgetMode,
              budget_mode: updatedCompany.budgetMode, 
              budgetMonths: updatedCompany.budgetMonths,
              budget_months: updatedCompany.budgetMonths, 
              liquidity: updatedCompany.liquidity,
              receivables: updatedCompany.receivables,
              accountsPayable: updatedCompany.accountsPayable,
              publicFees: updatedCompany.publicFees,
              salaryExpenses: updatedCompany.salaryExpenses, 
              pnlDate: updatedCompany.pnlDate,
              liquidityDate: updatedCompany.liquidityDate,
              receivablesDate: updatedCompany.receivablesDate,
              accountsPayableDate: updatedCompany.accountsPayableDate,
              publicFeesDate: updatedCompany.publicFeesDate,
              salaryExpensesDate: updatedCompany.salaryExpensesDate, 
              trendHistory: updatedCompany.trendHistory
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
               let targetBudget = 0;
               const bMonths = updatedCompany.budgetMonths || Array(12).fill(0);
               if (isTodayMode) {
                    for (let i = 0; i < currentMonthIndex; i++) targetBudget += Number(bMonths[i] || 0);
                    targetBudget += (Number(bMonths[currentMonthIndex] || 0) / daysInCurrentMonth) * now.getDate();
               } else {
                    for (let i = 0; i < currentMonthIndex; i++) targetBudget += Number(bMonths[i] || 0);
               }
               const deviation = updatedCompany.resultYTD - targetBudget;
               const deviationPercent = targetBudget !== 0 ? (deviation / targetBudget) * 100 : 0;
               setSelectedCompany(prev => prev ? { 
                   ...prev, 
                   ...updatedCompany,
                   calculatedBudgetYTD: targetBudget,
                   calculatedDeviationPercent: deviationPercent
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

          const reportPayload: any = {
              companyId: targetCompanyId,
              submittedByUserId: userProfile.id, 
              authorName: userProfile.fullName,
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
             reportPayload.resultYtd = r - e; 
             if(reportData.pnlDate) reportPayload.pnlDate = toISODate(reportData.pnlDate) || reportData.pnlDate;
          }

          if(reportData.liquidity !== undefined && reportData.liquidity !== '') {
             reportPayload.liquidity = Number(reportData.liquidity);
             if(reportData.liquidityDate) reportPayload.liquidityDate = reportData.liquidityDate;
          }
          if(reportData.receivables !== undefined && reportData.receivables !== '') {
              reportPayload.receivables = Number(reportData.receivables);
              if(reportData.receivablesDate) reportPayload.receivablesDate = reportData.receivablesDate;
          }
          if(reportData.accountsPayable !== undefined && reportData.accountsPayable !== '') {
              reportPayload.accountsPayable = Number(reportData.accountsPayable);
              if(reportData.accountsPayableDate) reportPayload.accountsPayableDate = reportData.accountsPayableDate;
          }
          if(reportData.publicFees !== undefined && reportData.publicFees !== '') {
              reportPayload.publicFees = Number(reportData.publicFees);
              if(reportData.publicFeesDate) reportPayload.publicFeesDate = reportData.publicFeesDate;
          }
          if(reportData.salaryExpenses !== undefined && reportData.salaryExpenses !== '') {
              reportPayload.salaryExpenses = Number(reportData.salaryExpenses);
              if(reportData.salaryExpensesDate) reportPayload.salaryExpensesDate = reportData.salaryExpensesDate;
          }

          if (reportData.id) {
              await patchNEON({ table: 'reports', data: { id: reportData.id, ...reportPayload } });
              logActivity(userProfile.id, 'UPDATE_REPORT', 'reports', reportData.id, `Oppdaterte rapport. Status: submitted`);
          } else {
              const res = await postNEON({ table: 'reports', data: reportPayload });
              logActivity(userProfile.id, 'SUBMIT_REPORT', 'reports', res.inserted?.[0]?.id, `Sendte inn ny rapport`);
          }

          const companyUpdate: any = { id: targetCompanyId };
          if (hasRevenue || hasExpenses) {
             const r = Number(reportData.revenue || 0);
             const e = Number(reportData.expenses || 0);
             companyUpdate.revenue = r;
             companyUpdate.expenses = e;
             companyUpdate.resultYtd = r - e;
             if(reportData.pnlDate) companyUpdate.pnlDate = reportData.pnlDate;
          }
          if(reportData.liquidity !== undefined && reportData.liquidity !== '') {
             companyUpdate.liquidity = Number(reportData.liquidity);
             if(reportData.liquidityDate) companyUpdate.liquidityDate = reportData.liquidityDate;
          }
          if(reportData.receivables !== undefined && reportData.receivables !== '') {
              companyUpdate.receivables = Number(reportData.receivables);
              if(reportData.receivablesDate) companyUpdate.receivablesDate = reportData.receivablesDate;
          }
          if(reportData.accountsPayable !== undefined && reportData.accountsPayable !== '') {
              companyUpdate.accountsPayable = Number(reportData.accountsPayable);
              if(reportData.accountsPayableDate) companyUpdate.accountsPayableDate = reportData.accountsPayableDate;
          }
          if(reportData.publicFees !== undefined && reportData.publicFees !== '') {
              companyUpdate.publicFees = Number(reportData.publicFees);
              if(reportData.publicFeesDate) companyUpdate.publicFeesDate = reportData.publicFeesDate;
          }
          if(reportData.salaryExpenses !== undefined && reportData.salaryExpenses !== '') {
              companyUpdate.salaryExpenses = Number(reportData.salaryExpenses);
              if(reportData.salaryExpensesDate) companyUpdate.salaryExpensesDate = reportData.salaryExpensesDate;
          }

          companyUpdate.lastReportDate = new Date().toLocaleDateString('no-NO');
          companyUpdate.lastReportBy = userProfile.fullName;
          companyUpdate.currentComment = reportData.comment;

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
          await patchNEON({ table: 'reports', data: { id: reportId, status: 'approved', approvedByUserId: userProfile.id } });
          logActivity(userProfile.id, 'APPROVE_REPORT', 'reports', reportId, 'Godkjente rapport');
          const updater = (r: ReportLogItem) => r.id === reportId ? { ...r, status: 'approved' as const, approvedBy: 'Kontroller' } : r;
          setReports(prev => prev.map(updater));
          setAllReports(prev => prev.map(updater));
      } catch (e) { console.error("Approval error", e); alert("Feil ved godkjenning."); }
  };

  const handleUnlockReport = async (reportId: number) => {
       try {
          await patchNEON({ table: 'reports', data: { id: reportId, status: 'submitted', approvedAt: null, approvedByUserId: null } });
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
      let targetBudget = 0;
      const bMonths = raw.budgetMonths || Array(12).fill(0);
      if (isTodayMode) {
          for (let i = 0; i < currentMonthIndex; i++) targetBudget += Number(bMonths[i] || 0);
          targetBudget += (Number(bMonths[currentMonthIndex] || 0) / daysInCurrentMonth) * dayOfMonth;
      } else {
          for (let i = 0; i < currentMonthIndex; i++) targetBudget += Number(bMonths[i] || 0);
      }
      const deviation = raw.resultYTD - targetBudget;
      const deviationPercent = targetBudget !== 0 ? (deviation / targetBudget) * 100 : 0;
      setSelectedCompany({ ...raw, calculatedBudgetYTD: targetBudget, calculatedDeviationPercent: deviationPercent });
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
              fullName: user.fullName,
              role: user.role,
              groupId: userProfile.groupId,
              companyId: null
          };
          const res = await postNEON({ table: 'users', data: payload });
          const createdUser = res.inserted[0];
          logActivity(userProfile.id, 'CREATE_USER', 'users', createdUser.id, `Opprettet bruker: ${user.email}`);
          if (user.companyIds && user.companyIds.length > 0) {
              const accessRows = user.companyIds.map(cid => ({ userId: createdUser.id, companyId: cid }));
              await postNEON({ table: 'usercompanyaccess', data: accessRows });
          }
          fetchUsers();
          if (user.role === 'leader' && user.companyIds && user.companyIds.length > 0) await syncManagers(user.companyIds);
      } catch (e) { console.error("Add user error", e); alert("Kunne ikke legge til bruker"); }
  };

  const handleUpdateUser = async (user: UserData) => {
      try {
          const payload: any = { id: user.id, email: user.email, fullName: user.fullName, role: user.role };
          if (user.password) payload.password = user.password;
          await patchNEON({ table: 'users', data: payload });
          
          const accessRes = await getNEON({ table: 'usercompanyaccess', where: { userId: user.id } });
          const existingIds = (accessRes.rows || []).map((r:any) => r.id);
          const existingCompanyIds = (accessRes.rows || []).map((r:any) => r.companyId || r.company_id);
          if (existingIds.length > 0) await deleteNEON({ table: 'usercompanyaccess', data: existingIds });
          
          if (user.companyIds && user.companyIds.length > 0) {
              const accessRows = user.companyIds.map(cid => ({ userId: user.id, companyId: cid }));
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
          const accessRes = await getNEON({ table: 'usercompanyaccess', where: { userId: id } });
          const existingCompanyIds = (accessRes.rows || []).map((r:any) => r.companyId || r.company_id);
          await deleteNEON({ table: 'usercompanyaccess', data: id, field: 'userId' });
          await deleteNEON({ table: 'users', data: id });
          logActivity(userProfile.id, 'DELETE_USER', 'users', id, 'Slettet bruker');
          setUsers(users.filter(u => u.id !== id));
          await syncManagers(existingCompanyIds);
      } catch (e) { console.error("Delete user error", e); alert("Kunne ikke slette bruker (sjekk om brukeren har rapporter)"); }
  };

  const handleLogout = () => {
      logActivity(userProfile.id, 'LOGOUT', 'users', userProfile.id, 'Logget ut');
      localStorage.removeItem('konsern_user_id');
      localStorage.removeItem('konsern_mode');
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
    
    return visibleCompanies.map(company => {
        let targetBudget = 0;
        const bMonths = company.budgetMonths;
        if (isTodayMode) {
            for (let i = 0; i < currentMonthIndex; i++) targetBudget += bMonths[i];
            targetBudget += (bMonths[currentMonthIndex] / daysInCurrentMonth) * dayOfMonth;
        } else {
            for (let i = 0; i < currentMonthIndex; i++) targetBudget += bMonths[i];
        }
        const deviation = company.resultYTD - targetBudget;
        const deviationPercent = targetBudget !== 0 ? (deviation / targetBudget) * 100 : 0;
        return { ...company, calculatedBudgetYTD: targetBudget, calculatedDeviationPercent: deviationPercent };
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
  const totalWorkingCapital = (totalLiquidity + totalReceivables) - (totalPayables + totalPublicFees + totalSalaryExpenses);
  
  const currentDateDisplay = new Date().toLocaleDateString('no-NO', { day: 'numeric', month: 'long' });
  const lastMonthDisplay = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toLocaleDateString('no-NO', { day: 'numeric', month: 'long' });

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
      />
    );
  }

  const isAdminMode = viewMode === ViewMode.ADMIN || viewMode === ViewMode.ADMIN_REPORTS || viewMode === ViewMode.USER_ADMIN;

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
                    </div>

                    <div className="flex bg-slate-200/60 dark:bg-slate-800 p-1 rounded-lg self-end md:self-auto transition-colors duration-300">
                        <button onClick={() => setViewMode(ViewMode.GRID)} className={`flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === ViewMode.GRID ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}><LayoutGrid className="w-3.5 h-3.5 mr-1.5" />Kort</button>
                        <button onClick={() => setViewMode(ViewMode.ANALYTICS)} className={`flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === ViewMode.ANALYTICS ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}><BarChart3 className="w-3.5 h-3.5 mr-1.5" />Analyse</button>
                        <button onClick={() => setViewMode(ViewMode.CONTROL)} className={`flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === ViewMode.CONTROL ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}><ShieldAlert className="w-3.5 h-3.5 mr-1.5" />Kontroll</button>
                        <button onClick={handleSortToggle} className={`flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition-all text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white`}><ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />Sort</button>
                    </div>
                </div>
                
                {viewMode === ViewMode.ANALYTICS ? (
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
        totalPublicFees={totalPublicFees}
        totalSalaryExpenses={totalSalaryExpenses}
        totalWorkingCapital={totalWorkingCapital}
        isAdminMode={isAdminMode}
      />
    </div>
  );
}

export default App;