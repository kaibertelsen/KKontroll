import React, { useState, useMemo, useEffect, useRef } from 'react';
import { formatCurrency } from './constants';
import { ComputedCompanyData, SortField, ViewMode, CompanyData, UserData, ReportLogItem, ForecastItem } from './types';
import MetricCard from './components/MetricCard';
import AnalyticsView from './components/AnalyticsView';
import CompanyDetailView from './components/CompanyDetailView';
import AdminView from './components/AdminView';
import UserAdminView from './components/UserAdminView';
import AnimatedGrid from './components/AnimatedGrid';
import { postNEON, patchNEON, deleteNEON, getNEON } from './utils/neon';
import { 
  LayoutGrid, 
  BarChart3, 
  ArrowUpDown, 
  UserCircle, 
  Moon,
  Sun,
  Building2,
  CalendarClock,
  ShieldAlert,
  Settings,
  Database,
  MonitorPlay,
  Users,
  LogOut,
  Check,
  X
} from 'lucide-react';

interface UserProfile {
    id: number;
    fullName: string;
    role: 'controller' | 'leader';
    groupId: number;
    groupName: string;
    companyId?: number;
}

interface AppProps {
    userProfile: UserProfile;
    initialCompanies: CompanyData[];
    isDemo: boolean;
}

// Helper to convert DD.MM.YYYY to YYYY-MM-DD for DB
const toISODate = (dateStr: string) => {
    if (!dateStr) return null;
    // If already ISO (contains -), return as is
    if (dateStr.includes('-')) return dateStr;
    
    // Expecting DD.MM.YYYY
    const parts = dateStr.split('.');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return null;
};

function App({ userProfile, initialCompanies, isDemo }: AppProps) {
  const [sortField, setSortField] = useState<SortField>(SortField.DEFAULT);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.GRID);
  const [isTodayMode, setIsTodayMode] = useState<boolean>(false);
  const [selectedCompany, setSelectedCompany] = useState<ComputedCompanyData | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [demoRole, setDemoRole] = useState<'controller' | 'leader'>(userProfile.role);
  const effectiveRole = isDemo ? demoRole : userProfile.role;

  const [companies, setCompanies] = useState<CompanyData[]>(initialCompanies || []);
  const [users, setUsers] = useState<UserData[]>([]);
  const [reports, setReports] = useState<ReportLogItem[]>([]);
  const [forecasts, setForecasts] = useState<ForecastItem[]>([]);

  // SORTING STATE
  const [isSortMode, setIsSortMode] = useState(false);
  const [originalOrder, setOriginalOrder] = useState<CompanyData[]>([]);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // --- SORT MODE HANDLERS ---
  const handleSortToggle = () => {
      if (viewMode === ViewMode.GRID && !isSortMode) {
          setOriginalOrder([...companies]); // Backup for cancel
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
      setIsSortMode(false);
      dragItem.current = null;
      dragOverItem.current = null;
      // In a real app, we would save the new order index to the DB here.
      console.log("New order saved:", companies.map(c => c.name));
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
      if (!isDemo && effectiveRole === 'controller' && (viewMode === ViewMode.ADMIN || viewMode === ViewMode.USER_ADMIN)) {
          // Use camelCase 'groupId' for Drizzle query if mapped, but usually where clauses need to match DB column if raw, 
          // however getNEON wrapper might handle it. 
          // SAFEST: Use the prop that matched successful GETs before. 
          // Previous working code used `group_id` or `groupId` depending on wrapper. 
          // Let's stick to `groupId` as we are aligning with Schema.
          getNEON({ table: 'users', where: { groupId: userProfile.groupId } })
            .then(res => {
                if(res.rows) {
                    const mappedUsers = res.rows.map((u: any) => ({
                        id: u.id,
                        authId: u.authId || u.auth_id, 
                        email: u.email,
                        fullName: u.fullName || u.full_name,
                        role: u.role,
                        groupId: u.groupId || u.group_id,
                        companyId: u.companyId || u.company_id
                    }));
                    setUsers(mappedUsers);
                }
            })
            .catch(err => console.error("Error fetching users", err));
      }
  }, [isDemo, userProfile, viewMode, effectiveRole]);

  // --- FETCH REPORTS & FORECASTS ---
  useEffect(() => {
      if (!selectedCompany) return;

      if (!isDemo) {
          // Fetch Reports using companyId (Drizzle Schema)
          getNEON({ table: 'reports', where: { companyId: selectedCompany.id } })
            .then(res => {
                if (res.rows) {
                    const sortedRows = res.rows.sort((a: any, b: any) => {
                        const dateA = new Date(a.reportDate || a.report_date).getTime();
                        const dateB = new Date(b.reportDate || b.report_date).getTime();
                        return dateB - dateA;
                    });

                    const mappedReports = sortedRows.map((r: any) => ({
                        id: r.id,
                        date: r.reportDate ? new Date(r.reportDate).toLocaleDateString('no-NO') : '',
                        author: r.authorName || 'Ukjent',
                        comment: r.comment,
                        status: r.status,
                        result: r.resultYtd != null ? r.resultYtd : (r.result_ytd != null ? r.result_ytd : undefined),
                        revenue: r.revenue != null ? r.revenue : undefined,
                        expenses: r.expenses != null ? r.expenses : undefined,
                        pnlDate: r.pnlDate || r.pnl_date || '', 
                        
                        liquidity: r.liquidity != null ? r.liquidity : undefined,
                        receivables: r.receivables != null ? r.receivables : undefined,
                        accountsPayable: r.accountsPayable != null ? r.accountsPayable : (r.accounts_payable != null ? r.accounts_payable : undefined),
                        
                        liquidityDate: r.liquidityDate || r.liquidity_date || '',
                        receivablesDate: r.receivablesDate || r.receivables_date || '',
                        accountsPayableDate: r.accountsPayableDate || r.accounts_payable_date || '',
                        
                        source: r.source || 'Manuell',
                        approvedBy: r.approvedByUserId ? 'Kontroller' : undefined,
                        approvedAt: r.approvedAt ? new Date(r.approvedAt).toLocaleDateString('no-NO') : undefined
                    }));
                    setReports(mappedReports);
                }
            })
            .catch(err => console.error("Error fetching reports", err));

          // Fetch Forecasts
          getNEON({ table: 'forecasts', where: { companyId: selectedCompany.id } })
            .then(res => {
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
            })
            .catch(err => console.error("Error fetching forecasts", err));

      } else {
          setReports([
              { id: 1, date: '15.10.2023', author: 'Anna Hansen', comment: 'Sterk vekst i Q3.', status: 'approved', result: 1240000, liquidity: 540000, source: 'Manuell', approvedBy: 'Demo Controller', pnlDate: '30.09.2023' },
              { id: 2, date: '15.09.2023', author: 'System', comment: 'Stabil drift.', status: 'approved', result: 1100000, liquidity: 500000, source: 'Tripletex', pnlDate: '31.08.2023' }
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
        if (effectiveRole === 'leader' && userProfile.companyId) {
            companyWhere = { id: userProfile.companyId };
        } else {
            companyWhere = { groupId: userProfile.groupId };
        }

        const compRes = await getNEON({ table: 'companies', where: companyWhere });
        if(compRes.rows) {
            const mapped = compRes.rows.map((c: any) => {
                let bMonths = [0,0,0,0,0,0,0,0,0,0,0,0];
                try {
                    if (Array.isArray(c.budgetMonths)) bMonths = c.budgetMonths;
                    else if (typeof c.budgetMonths === 'string') bMonths = JSON.parse(c.budgetMonths);
                    else if (Array.isArray(c.budget_months)) bMonths = c.budget_months;
                    else if (typeof c.budget_months === 'string') bMonths = JSON.parse(c.budget_months);
                } catch(e) { console.warn("Budget parsing error", e); }

                return {
                    ...c,
                    // Robust Mapping: Handle both camelCase (API) and snake_case (DB) for all fields
                    resultYTD: Number(c.resultYtd || c.result_ytd || 0),
                    budgetTotal: Number(c.budgetTotal || c.budget_total || 0),
                    budgetMode: c.budgetMode || c.budget_mode || 'annual',
                    budgetMonths: bMonths,
                    
                    revenue: Number(c.revenue || 0),
                    expenses: Number(c.expenses || 0),
                    
                    liquidity: Number(c.liquidity || 0),
                    receivables: Number(c.receivables || 0),
                    accountsPayable: Number(c.accountsPayable || c.accounts_payable || 0),
                    
                    pnlDate: c.pnlDate || c.pnl_date || '', 
                    liquidityDate: c.liquidityDate || c.liquidity_date || '',
                    receivablesDate: c.receivablesDate || c.receivables_date || '',
                    accountsPayableDate: c.accountsPayableDate || c.accounts_payable_date || '',
                    
                    trendHistory: Number(c.trendHistory || c.trend_history || 0),
                    prevLiquidity: Number(c.prevLiquidity || c.prev_liquidity || 0),
                    prevDeviation: Number(c.prevTrend || c.prev_trend || 0),
                    
                    name: c.name || '',
                    fullName: c.fullName || c.full_name || '', 
                    manager: c.manager || '',
                    
                    lastReportDate: c.lastReportDate || c.last_report_date || '',
                    lastReportBy: c.lastReportBy || c.last_report_by || '',
                    comment: c.currentComment || c.current_comment || '',
                };
            });
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


  // --- COMPANY CRUD ---
  const handleAddCompany = async (newCompany: Omit<CompanyData, 'id'>) => {
      try {
          // FIX: Use camelCase keys matching Schema
          const dbPayload = {
              groupId: userProfile.groupId, 
              name: newCompany.name,
              fullName: newCompany.fullName,
              manager: newCompany.manager,
              revenue: newCompany.revenue,
              expenses: newCompany.expenses,
              resultYtd: newCompany.resultYTD, 
              budgetTotal: newCompany.budgetTotal,
              budgetMode: newCompany.budgetMode,
              budgetMonths: newCompany.budgetMonths, // Pass array directly, Drizzle handles JSON
              liquidity: newCompany.liquidity,
              receivables: newCompany.receivables,
              accountsPayable: newCompany.accountsPayable,
              
              pnlDate: newCompany.pnlDate,
              liquidityDate: newCompany.liquidityDate,
              receivablesDate: newCompany.receivablesDate,
              accountsPayableDate: newCompany.accountsPayableDate,
              trendHistory: newCompany.trendHistory
          };
          
          if (!isDemo) {
              await postNEON({ table: 'companies', data: dbPayload });
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
           // FIX: Use camelCase keys matching Schema
           const dbPayload = {
              id: updatedCompany.id,
              name: updatedCompany.name,
              fullName: updatedCompany.fullName,
              manager: updatedCompany.manager,
              revenue: updatedCompany.revenue,
              expenses: updatedCompany.expenses,
              resultYtd: updatedCompany.resultYTD,
              budgetTotal: updatedCompany.budgetTotal,
              budgetMode: updatedCompany.budgetMode,
              budgetMonths: updatedCompany.budgetMonths, // Pass array directly
              liquidity: updatedCompany.liquidity,
              receivables: updatedCompany.receivables,
              accountsPayable: updatedCompany.accountsPayable,
              
              pnlDate: updatedCompany.pnlDate,
              liquidityDate: updatedCompany.liquidityDate,
              receivablesDate: updatedCompany.receivablesDate,
              accountsPayableDate: updatedCompany.accountsPayableDate,
              trendHistory: updatedCompany.trendHistory
          };

          if (!isDemo) {
              await patchNEON({ table: 'companies', data: dbPayload });
              await reloadCompanies();
          } else {
              setCompanies(companies.map(c => c.id === updatedCompany.id ? updatedCompany : c));
          }
          
          if (selectedCompany && selectedCompany.id === updatedCompany.id) {
               setSelectedCompany(prev => prev ? { ...prev, ...updatedCompany } : null);
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
          if (isDemo) {
               const newReport: ReportLogItem = {
                   id: Math.random(),
                   date: new Date().toLocaleDateString('no-NO'),
                   author: userProfile.fullName,
                   comment: reportData.comment,
                   status: 'submitted',
                   result: reportData.resultYTD,
                   liquidity: reportData.liquidity,
                   revenue: reportData.revenue,
                   expenses: reportData.expenses,
                   receivables: reportData.receivables,
                   accountsPayable: reportData.accountsPayable,
                   pnlDate: reportData.pnlDate, 
                   source: reportData.source || 'Manuell'
               };
               setReports([newReport, ...reports]);
               return;
          }

          // FIX: Use camelCase keys matching Schema
          const reportPayload: any = {
              companyId: selectedCompany?.id,
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

          if (reportData.id) {
              await patchNEON({ table: 'reports', data: { id: reportData.id, ...reportPayload } });
          } else {
              await postNEON({ table: 'reports', data: reportPayload });
          }

          // 2. UPDATE COMPANY SNAPSHOT IMMEDIATELY (Using camelCase keys)
          const companyUpdate: any = { id: selectedCompany?.id };
          
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

          companyUpdate.lastReportDate = new Date().toLocaleDateString('no-NO');
          companyUpdate.lastReportBy = userProfile.fullName;
          companyUpdate.currentComment = reportData.comment;

          await patchNEON({ table: 'companies', data: companyUpdate });

          // 3. Refresh App State
          await reloadCompanies();

          if (selectedCompany) {
              const res = await getNEON({ table: 'reports', where: { companyId: selectedCompany.id } });
              if(res.rows) {
                 const sortedRows = res.rows.sort((a: any, b: any) => {
                    const dateA = new Date(a.reportDate || a.report_date).getTime();
                    const dateB = new Date(b.reportDate || b.report_date).getTime();
                    return dateB - dateA;
                 });

                 const mapped = sortedRows.map((r:any) => ({
                     id: r.id,
                     date: r.reportDate ? new Date(r.reportDate).toLocaleDateString('no-NO') : '',
                     author: r.authorName || 'Ukjent',
                     comment: r.comment,
                     status: r.status,
                     result: r.resultYtd != null ? r.resultYtd : (r.result_ytd != null ? r.result_ytd : undefined),
                     revenue: r.revenue,
                     expenses: r.expenses,
                     pnlDate: r.pnlDate || r.pnl_date, 
                     liquidity: r.liquidity,
                     receivables: r.receivables,
                     accountsPayable: r.accountsPayable || r.accounts_payable,
                     liquidityDate: r.liquidityDate || r.liquidity_date,
                     receivablesDate: r.receivablesDate || r.receivables_date,
                     accountsPayableDate: r.accountsPayableDate || r.accounts_payable_date,
                     source: r.source || 'Manuell',
                     approvedBy: r.approvedByUserId ? 'Kontroller' : undefined,
                     approvedAt: r.approvedAt ? new Date(r.approvedAt).toLocaleDateString('no-NO') : undefined
                 }));
                 setReports(mapped);
              }
          }

      } catch (e) {
          console.error("Report submit error", e);
          alert("Feil ved innsending av rapport.");
      }
  };

  // Handle Delete Report
  const handleDeleteReport = async (reportId: number) => {
      if (!window.confirm("Er du sikker på at du vil slette denne rapporten?")) return;
      
      if (isDemo) {
          setReports(prev => prev.filter(r => r.id !== reportId));
          return;
      }

      try {
          await deleteNEON({ table: 'reports', data: reportId });
          setReports(prev => prev.filter(r => r.id !== reportId));
      } catch (e) {
          console.error("Delete report error", e);
          alert("Kunne ikke slette rapporten.");
      }
  };

  const handleApproveReport = async (reportId: number) => {
      if (isDemo) {
          setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'approved', approvedBy: 'Demo Controller' } : r));
          return;
      }
      try {
          const report = reports.find(r => r.id === reportId);
          if (!report) return;

          // FIX: Use camelCase keys matching Schema
          await patchNEON({ 
              table: 'reports', 
              data: { 
                  id: reportId, 
                  status: 'approved', 
                  approvedByUserId: userProfile.id 
              } 
          });
          
          // Update list immediately
          setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'approved', approvedBy: 'Kontroller' } : r));

      } catch (e) {
          console.error("Approval error", e);
          alert("Feil ved godkjenning.");
      }
  };

  const handleUnlockReport = async (reportId: number) => {
      if(isDemo) {
           setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'submitted', approvedBy: undefined } : r));
           return;
      }
      try {
          // FIX: Use camelCase keys matching Schema
          await patchNEON({ 
              table: 'reports', 
              data: { 
                  id: reportId, 
                  status: 'submitted', 
                  approvedAt: null,
                  approvedByUserId: null
              } 
          });
          setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'submitted', approvedBy: undefined } : r));
      } catch (e) {
          console.error("Unlock error", e);
      }
  };

  const handleForecastSubmit = async (submittedForecasts: ForecastItem[]) => {
      if(isDemo) {
          setForecasts(submittedForecasts);
          return;
      }
      try {
          for (const f of submittedForecasts) {
              // FIX: Use camelCase keys matching Schema
              const payload = {
                  companyId: f.companyId,
                  month: f.month,
                  estimatedReceivables: f.estimatedReceivables,
                  estimatedPayables: f.estimatedPayables
              };
              
              if (f.id) {
                   await patchNEON({ table: 'forecasts', data: { id: f.id, ...payload } });
              } else {
                   await postNEON({ table: 'forecasts', data: payload });
              }
          }
          // Reload forecasts
          if(selectedCompany) {
               const res = await getNEON({ table: 'forecasts', where: { companyId: selectedCompany.id } });
                if(res.rows) {
                    const mapped = res.rows.map((f: any) => ({
                        id: f.id,
                        companyId: f.companyId || f.company_id,
                        month: f.month,
                        estimatedReceivables: f.estimatedReceivables || f.estimated_receivables || 0,
                        estimatedPayables: f.estimatedPayables || f.estimated_payables || 0
                    }));
                    setForecasts(mapped);
                }
          }
      } catch (e) {
          console.error("Forecast submit error", e);
      }
  };

  // --- USER HANDLERS ---
  const handleAddUser = async (user: Omit<UserData, 'id'>) => {
      try {
          // FIX: Use camelCase keys matching Schema
          const payload = {
              authId: user.authId,
              email: user.email,
              fullName: user.fullName,
              role: user.role,
              groupId: userProfile.groupId,
              companyId: user.companyId
          };
          await postNEON({ table: 'users', data: payload });
          
          const res = await getNEON({ table: 'users', where: { groupId: userProfile.groupId } });
          if(res.rows) setUsers(res.rows.map((u:any) => ({
              id: u.id, 
              authId: u.authId || u.auth_id, 
              email: u.email, 
              role: u.role, 
              fullName: u.fullName || u.full_name, 
              groupId: u.groupId || u.group_id, 
              companyId: u.companyId || u.company_id
          })));
      } catch (e) {
          console.error("Add user error", e);
          alert("Kunne ikke legge til bruker");
      }
  };

  const handleUpdateUser = async (user: UserData) => {
      try {
          // FIX: Use camelCase keys matching Schema
          const payload = {
              id: user.id,
              authId: user.authId,
              email: user.email,
              fullName: user.fullName,
              role: user.role,
              companyId: user.companyId
          };
           await patchNEON({ table: 'users', data: payload });
           
           const res = await getNEON({ table: 'users', where: { groupId: userProfile.groupId } });
           if(res.rows) setUsers(res.rows.map((u:any) => ({
               id: u.id, 
               authId: u.authId || u.auth_id, 
               email: u.email, 
               role: u.role, 
               fullName: u.fullName || u.full_name, 
               groupId: u.groupId || u.group_id, 
               companyId: u.companyId || u.company_id
           })));
      } catch (e) {
          console.error("Update user error", e);
          alert("Kunne ikke oppdatere bruker");
      }
  };

  const handleDeleteUser = async (id: number) => {
       try {
          await deleteNEON({ table: 'users', data: id });
          setUsers(users.filter(u => u.id !== id));
      } catch (e) {
          console.error("Delete user error", e);
          alert("Kunne ikke slette bruker");
      }
  };

  const handleLogout = () => {
      localStorage.removeItem('konsern_access');
      localStorage.removeItem('konsern_mode');
      if(window.$memberstackDom) window.$memberstackDom.logout();
      window.initKonsernKontroll();
  };

  const toggleMode = () => {
      const newMode = isDemo ? 'live' : 'demo';
      if (newMode === 'demo' && localStorage.getItem('konsern_access') !== 'granted') {
          alert("Du må logge inn med demo-passord først.");
          window.initKonsernKontroll(); 
          return;
      }
      window.initKonsernKontroll(undefined, newMode === 'demo');
  };

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [isDarkMode]);

  const visibleCompanies = useMemo(() => {
      if (effectiveRole === 'leader') {
          if (isDemo) return companies.filter(c => c.name === 'BCC');
          if (userProfile.companyId) return companies.filter(c => c.id === userProfile.companyId);
      }
      return companies;
  }, [companies, effectiveRole, isDemo, userProfile.companyId]);

  const computedData: ComputedCompanyData[] = useMemo(() => {
    const now = new Date();
    const currentMonthIndex = now.getMonth(); 
    const dayOfMonth = now.getDate();
    const daysInCurrentMonth = new Date(now.getFullYear(), currentMonthIndex + 1, 0).getDate();
    
    return visibleCompanies.map(company => {
        let targetBudget = 0;
        const bMonths = company.budgetMonths && company.budgetMonths.length === 12 ? company.budgetMonths : Array(12).fill(company.budgetTotal / 12);

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
  const totalWorkingCapital = (totalReceivables - totalPayables) + totalLiquidity;
  
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
      />
    );
  }

  const isAdminMode = viewMode === ViewMode.ADMIN || viewMode === ViewMode.USER_ADMIN;

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-slate-900 pb-32 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300 ${isSortMode ? 'sort-mode-active touch-none' : ''}`}>
      {/* Header same as before */}
      <header className="bg-white/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20 shadow-sm backdrop-blur-md transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <a href="https://www.attentio.no" target="_blank" rel="noreferrer" className="flex items-center gap-3 group">
               <div className="bg-white/10 p-1.5 rounded-lg">
                  <img src="https://ucarecdn.com/4eb31f4f-55eb-4331-bfe6-f98fbdf6f01b/meetingicon.png" alt="Attentio" className="h-8 w-8 rounded-lg shadow-sm" />
               </div>
               <div className="hidden sm:block">
                  <h1 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight leading-tight">{userProfile.groupName || 'Konsernoversikt'}</h1>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Powered by Attentio</p>
               </div>
            </a>

            {isAdminMode && (
                <div className="flex items-center bg-slate-100 dark:bg-slate-700/50 p-1 rounded-full border border-slate-200 dark:border-slate-600 absolute left-1/2 transform -translate-x-1/2">
                    <button onClick={() => setViewMode(ViewMode.ADMIN)} className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${viewMode === ViewMode.ADMIN ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}><Building2 size={12} /> Selskaper</button>
                    <button onClick={() => setViewMode(ViewMode.USER_ADMIN)} className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${viewMode === ViewMode.USER_ADMIN ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}><Users size={12} /> Brukere</button>
                </div>
            )}
            
            <div className="flex items-center space-x-4 md:space-x-6">
              {isDemo && (
                  <div className="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                      <button onClick={() => setDemoRole('controller')} className={`px-2 py-1 text-[10px] uppercase font-bold rounded-md transition-all ${demoRole === 'controller' ? 'bg-white dark:bg-slate-600 text-sky-600 dark:text-sky-300 shadow-sm' : 'text-slate-400'}`}>Controller</button>
                      <button onClick={() => { setDemoRole('leader'); setViewMode(ViewMode.GRID); }} className={`px-2 py-1 text-[10px] uppercase font-bold rounded-md transition-all ${demoRole === 'leader' ? 'bg-white dark:bg-slate-600 text-emerald-600 dark:text-emerald-300 shadow-sm' : 'text-slate-400'}`}>Leder</button>
                  </div>
              )}

              <button onClick={toggleMode} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${isDemo ? 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200'}`} title={isDemo ? "Klikk for å koble til Database" : "Klikk for å se demo-data"}>{isDemo ? <MonitorPlay size={14}/> : <Database size={14}/>}<span>{isDemo ? 'DEMO' : 'LIVE'}</span></button>

              <div className="hidden md:flex items-center text-slate-500 dark:text-slate-400 text-sm font-medium bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700"><UserCircle className="w-4 h-4 mr-2 text-slate-400 dark:text-slate-500" /><span className="hidden lg:inline">Velkommen: </span>{userProfile.fullName || 'Bruker'}</div>
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">{isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button>
              <button onClick={handleLogout} className="p-2 rounded-full text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors" title="Logg ut / Tilbake"><LogOut className="w-5 h-5" /></button>

              {effectiveRole === 'controller' && (
                <button onClick={() => setViewMode(isAdminMode ? ViewMode.GRID : ViewMode.ADMIN)} className={`p-2 rounded-full transition-colors ${isAdminMode ? 'bg-sky-100 text-sky-600 dark:bg-sky-900/50 dark:text-sky-400' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`} title="Admin / Innstillinger"><Settings className="w-5 h-5" /></button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        {/* Same view rendering */}
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

        {viewMode === ViewMode.ADMIN && effectiveRole === 'controller' && (
           <AdminView companies={companies} onAdd={handleAddCompany} onUpdate={handleUpdateCompany} onDelete={handleDeleteCompany} />
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
                    </div>
                    <div className="flex bg-slate-200/60 dark:bg-slate-800 p-1 rounded-lg self-end md:self-auto transition-colors duration-300">
                        <button onClick={() => setViewMode(ViewMode.GRID)} className={`flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === ViewMode.GRID ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}><LayoutGrid className="w-3.5 h-3.5 mr-1.5" />Kort</button>
                        <button onClick={() => setViewMode(ViewMode.ANALYTICS)} className={`flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === ViewMode.ANALYTICS ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}><BarChart3 className="w-3.5 h-3.5 mr-1.5" />Analyse</button>
                        <button onClick={() => setViewMode(ViewMode.CONTROL)} className={`flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === ViewMode.CONTROL ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}><ShieldAlert className="w-3.5 h-3.5 mr-1.5" />Kontroll</button>
                        <button onClick={handleSortToggle} className={`flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition-all text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white`}><ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />Sort</button>
                    </div>
                </div>
                <div className={`flex items-center justify-center mb-6 text-xs text-slate-400 dark:text-slate-500 gap-2 transition-opacity duration-300 ${isSortMode ? 'opacity-0' : 'opacity-100'}`}><CalendarClock className="w-3.5 h-3.5" /><span>Viser tall beregnet mot: <strong className="text-slate-600 dark:text-slate-300">{isTodayMode ? 'Daglig akkumulert budsjett' : 'Budsjett pr. forrige månedsslutt'}</strong></span></div>
                
                {viewMode === ViewMode.ANALYTICS ? (
                    <AnalyticsView data={sortedData} />
                ) : (
                    <>
                        {viewMode === ViewMode.CONTROL && displayedData.length === 0 && (
                            <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700"><div className="bg-emerald-100 dark:bg-emerald-900/30 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"><ShieldAlert className="text-emerald-600 dark:text-emerald-400" size={24} /></div><h3 className="text-lg font-bold text-slate-900 dark:text-white">Ingen selskaper krever kontroll</h3></div>
                        )}
                        
                        <AnimatedGrid className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 md:gap-6 pb-24">
                            {sortedData.map((company, index) => (
                                <MetricCard 
                                    key={company.id} 
                                    data={company} 
                                    onSelect={setSelectedCompany}
                                    isSortMode={isSortMode}
                                    onDragStart={onDragStart}
                                    onDragEnter={onDragEnter}
                                    onDragEnd={onDragEnd}
                                    index={index}
                                />
                            ))}
                        </AnimatedGrid>
                    </>
                )}
            </>
        )}
      </main>
      
      {/* Footer */}
      {viewMode !== ViewMode.ADMIN && viewMode !== ViewMode.USER_ADMIN && !isSortMode && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur border-t border-slate-200 dark:border-slate-700 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] z-20 transition-colors duration-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 text-center md:text-left overflow-x-auto whitespace-nowrap pb-2">
                    <div className="flex flex-col px-2 border-r border-slate-100 dark:border-slate-700"><span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1">Omsetning</span><span className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(totalRevenue)}</span></div>
                    <div className="flex flex-col px-2 border-r border-slate-100 dark:border-slate-700"><span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1">Kostnader</span><span className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(totalExpenses)}</span></div>
                    <div className="flex flex-col px-2 border-r border-slate-100 dark:border-slate-700"><span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1">Resultat YTD</span><span className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(totalResult)}</span></div>
                    <div className="flex flex-col px-2 border-r border-slate-100 dark:border-slate-700"><span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1">Budsjett YTD</span><span className="text-sm font-bold text-slate-500 dark:text-slate-400">{formatCurrency(totalBudgetYTD)}</span></div>
                    <div className="flex flex-col px-2 border-r border-slate-100 dark:border-slate-700"><span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1">Likviditet</span><span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalLiquidity)}</span></div>
                    <div className="flex flex-col px-2 border-r border-slate-100 dark:border-slate-700"><span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1">Fordringer</span><span className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(totalReceivables)}</span></div>
                    <div className="flex flex-col px-2 border-r border-slate-100 dark:border-slate-700"><span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1">Gjeld</span><span className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(totalPayables)}</span></div>
                    <div className="flex flex-col px-2"><span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1">Arbeidskapital</span><span className="text-sm font-bold text-sky-600 dark:text-sky-400">{formatCurrency(totalWorkingCapital)}</span></div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}

export default App;