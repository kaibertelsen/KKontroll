
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
      // e.g. await patchNEON({ table: 'companies', data: companies.map((c, i) => ({ id: c.id, sort_order: i })) })
      console.log("New order saved:", companies.map(c => c.name));
  };

  const onDragStart = (e: React.DragEvent, index: number) => {
      dragItem.current = index;
      // Hide the ghost image slightly or style it
      // e.dataTransfer.effectAllowed = "move";
  };

  const onDragEnter = (e: React.DragEvent, index: number) => {
      dragOverItem.current = index;
      
      if (dragItem.current !== null && dragItem.current !== index) {
          const newCompanies = [...companies];
          const draggedItemContent = newCompanies[dragItem.current];
          
          // Remove from old pos
          newCompanies.splice(dragItem.current, 1);
          // Insert at new pos
          newCompanies.splice(index, 0, draggedItemContent);
          
          setCompanies(newCompanies);
          dragItem.current = index; // Update drag index to new position
      }
  };

  const onDragEnd = () => {
      dragItem.current = null;
      dragOverItem.current = null;
  };


  // --- FETCH USERS (Admin) ---
  useEffect(() => {
      if (!isDemo && effectiveRole === 'controller' && (viewMode === ViewMode.ADMIN || viewMode === ViewMode.USER_ADMIN)) {
          getNEON({ table: 'users', where: { group_id: userProfile.groupId } })
            .then(res => {
                if(res.rows) {
                    // FIXED: Use camelCase properties if API returns them (based on user JSON response)
                    // Fallback to snake_case if needed
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
          // Fetch Reports
          getNEON({ table: 'reports', where: { company_id: selectedCompany.id } })
            .then(res => {
                if (res.rows) {
                    const mappedReports = res.rows.map((r: any) => ({
                        id: r.id,
                        date: r.report_date ? new Date(r.report_date).toLocaleDateString('no-NO') : '',
                        author: r.author_name || 'Ukjent',
                        comment: r.comment,
                        status: r.status,
                        result: r.result_ytd != null ? r.result_ytd : undefined,
                        liquidity: r.liquidity != null ? r.liquidity : undefined,
                        revenue: r.revenue != null ? r.revenue : undefined,
                        expenses: r.expenses != null ? r.expenses : undefined,
                        receivables: r.receivables != null ? r.receivables : undefined,
                        accountsPayable: r.accounts_payable != null ? r.accounts_payable : undefined,
                        liquidityDate: r.liquidity_date || '',
                        receivablesDate: r.receivables_date || '',
                        accountsPayableDate: r.accounts_payable_date || '',
                        source: r.source || 'Manuell',
                        approvedBy: r.approved_by_user_id ? 'Kontroller' : undefined,
                        approvedAt: r.approved_at ? new Date(r.approved_at).toLocaleDateString('no-NO') : undefined
                    }));
                    mappedReports.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    setReports(mappedReports);
                }
            })
            .catch(err => console.error("Error fetching reports", err));

          // Fetch Forecasts
          getNEON({ table: 'forecasts', where: { company_id: selectedCompany.id } })
            .then(res => {
                if(res.rows) {
                    const mappedForecasts = res.rows.map((f: any) => ({
                        id: f.id,
                        companyId: f.company_id,
                        month: f.month,
                        estimatedReceivables: f.estimated_receivables || 0,
                        estimatedPayables: f.estimated_payables || 0
                    }));
                    setForecasts(mappedForecasts);
                }
            })
            .catch(err => console.error("Error fetching forecasts", err));

      } else {
          setReports([
              { id: 1, date: '15.10.2023', author: 'Anna Hansen', comment: 'Sterk vekst i Q3.', status: 'approved', result: 1240000, liquidity: 540000, source: 'Manuell', approvedBy: 'Demo Controller' },
              { id: 2, date: '15.09.2023', author: 'System', comment: 'Stabil drift.', status: 'approved', result: 1100000, liquidity: 500000, source: 'Tripletex' }
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
            companyWhere = { group_id: userProfile.groupId };
        }

        const compRes = await getNEON({ table: 'companies', where: companyWhere });
        if(compRes.rows) {
            const mapped = compRes.rows.map((c: any) => {
                let bMonths = [0,0,0,0,0,0,0,0,0,0,0,0];
                try {
                    if (Array.isArray(c.budget_months)) bMonths = c.budget_months;
                    else if (typeof c.budget_months === 'string') bMonths = JSON.parse(c.budget_months);
                } catch(e) { console.warn("Budget parsing error", e); }

                return {
                    ...c,
                    resultYTD: Number(c.result_ytd || 0),
                    budgetTotal: Number(c.budget_total || 0),
                    budgetMode: c.budget_mode || 'annual',
                    budgetMonths: bMonths,
                    liquidity: Number(c.liquidity || 0),
                    receivables: Number(c.receivables || 0),
                    accountsPayable: Number(c.accounts_payable || 0),
                    trendHistory: Number(c.trend_history || 0),
                    prevLiquidity: Number(c.prev_liquidity || 0),
                    prevDeviation: Number(c.prev_trend || 0),
                    name: c.name || '',
                    fullName: c.full_name || '', 
                    manager: c.manager || '',
                    revenue: Number(c.revenue || 0),
                    expenses: Number(c.expenses || 0),
                    liquidityDate: c.liquidity_date || '',
                    receivablesDate: c.receivables_date || '',
                    accountsPayableDate: c.accounts_payable_date || '',
                    lastReportDate: c.last_report_date || '',
                    lastReportBy: c.last_report_by || '',
                    comment: c.current_comment || '',
                };
            });
            setCompanies(mapped);
        }
    } catch(e) { console.error("Reload companies error", e); }
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
              liquidity_date: newCompany.liquidityDate,
              receivables_date: newCompany.receivablesDate,
              accounts_payable_date: newCompany.accountsPayableDate,
              trend_history: newCompany.trendHistory
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
              liquidity: updatedCompany.liquidity,
              receivables: updatedCompany.receivables,
              accounts_payable: updatedCompany.accountsPayable,
              liquidity_date: updatedCompany.liquidityDate,
              receivables_date: updatedCompany.receivablesDate,
              accounts_payable_date: updatedCompany.accountsPayableDate,
              trend_history: updatedCompany.trendHistory
          };

          if (!isDemo) {
              await patchNEON({ table: 'companies', data: dbPayload });
              await reloadCompanies();
          } else {
              setCompanies(companies.map(c => c.id === updatedCompany.id ? updatedCompany : c));
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
                   receivables: reportData.receivables,
                   accountsPayable: reportData.accountsPayable,
                   source: reportData.source || 'Manuell'
               };
               setReports([newReport, ...reports]);
               return;
          }

          const payload: any = {
              company_id: selectedCompany?.id,
              author_name: userProfile.fullName,
              comment: reportData.comment,
              source: reportData.source,
              status: 'submitted',
              report_date: new Date().toISOString()
          };
          
          if(reportData.revenue !== undefined && reportData.revenue !== '') payload.revenue = reportData.revenue;
          if(reportData.expenses !== undefined && reportData.expenses !== '') payload.expenses = reportData.expenses;
          if(reportData.resultYTD !== undefined && reportData.resultYTD !== '') payload.result_ytd = reportData.resultYTD;
          if(reportData.liquidity !== undefined && reportData.liquidity !== '') payload.liquidity = reportData.liquidity;
          if(reportData.receivables !== undefined && reportData.receivables !== '') payload.receivables = reportData.receivables;
          if(reportData.accountsPayable !== undefined && reportData.accountsPayable !== '') payload.accounts_payable = reportData.accountsPayable;
          
          if(reportData.liquidityDate) payload.liquidity_date = reportData.liquidityDate;
          if(reportData.receivablesDate) payload.receivables_date = reportData.receivablesDate;
          if(reportData.accountsPayableDate) payload.accounts_payable_date = reportData.accountsPayableDate;

          if (reportData.id) {
              await patchNEON({ table: 'reports', data: { id: reportData.id, ...payload } });
          } else {
              await postNEON({ table: 'reports', data: payload });
          }

          // Refresh reports for selected company
          if (selectedCompany) {
              const res = await getNEON({ table: 'reports', where: { company_id: selectedCompany.id } });
              if(res.rows) {
                 const mapped = res.rows.map((r:any) => ({
                     id: r.id,
                     date: r.report_date ? new Date(r.report_date).toLocaleDateString('no-NO') : '',
                     author: r.author_name || 'Ukjent',
                     comment: r.comment,
                     status: r.status,
                     result: r.result_ytd,
                     liquidity: r.liquidity,
                     revenue: r.revenue,
                     expenses: r.expenses,
                     receivables: r.receivables,
                     accountsPayable: r.accounts_payable,
                     liquidityDate: r.liquidity_date,
                     receivablesDate: r.receivables_date,
                     accountsPayableDate: r.accounts_payable_date,
                     source: r.source || 'Manuell',
                     approvedBy: r.approved_by_user_id ? 'Kontroller' : undefined,
                     approvedAt: r.approved_at ? new Date(r.approved_at).toLocaleDateString('no-NO') : undefined
                 }));
                 mapped.sort((a:any, b:any) => new Date(b.date).getTime() - new Date(a.date).getTime());
                 setReports(mapped);
              }
          }

      } catch (e) {
          console.error("Report submit error", e);
          alert("Feil ved innsending av rapport.");
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

          // 1. Update Report Status
          await patchNEON({ 
              table: 'reports', 
              data: { 
                  id: reportId, 
                  status: 'approved', 
                  approved_at: new Date().toISOString() 
              } 
          });

          // 2. Update Company Data
          const companyUpdate: any = { id: selectedCompany?.id };
          if(report.revenue != null) companyUpdate.revenue = report.revenue;
          if(report.expenses != null) companyUpdate.expenses = report.expenses;
          if(report.result != null) companyUpdate.result_ytd = report.result;
          if(report.liquidity != null) companyUpdate.liquidity = report.liquidity;
          if(report.receivables != null) companyUpdate.receivables = report.receivables;
          if(report.accountsPayable != null) companyUpdate.accounts_payable = report.accountsPayable;
          
          if(report.liquidityDate) companyUpdate.liquidity_date = report.liquidityDate;
          if(report.receivablesDate) companyUpdate.receivables_date = report.receivablesDate;
          if(report.accountsPayableDate) companyUpdate.accounts_payable_date = report.accountsPayableDate;
          
          companyUpdate.last_report_date = report.date;
          companyUpdate.last_report_by = report.author;
          companyUpdate.current_comment = report.comment;

          await patchNEON({ table: 'companies', data: companyUpdate });

          // Refresh everything
          await reloadCompanies();
          
          // Update local reports list state
          setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'approved', approvedBy: 'Kontroller' } : r));
          
          // Force update selected company to show new values immediately (re-find from updated companies list)
          // Ideally rely on `companies` update, but since we are in `selectedCompany` view, we might need to manually update `selectedCompany` state or let the view re-render.
          // Since `selectedCompany` is state, we should update it.
          // But `reloadCompanies` sets `companies`. `visibleCompanies` derives from `companies`. `computedData` derives from `visibleCompanies`.
          // If `selectedCompany` is just a reference, it won't auto-update if it's a copy. 
          // `MetricCard` onSelect sets the copy. 
          // We need to re-set selectedCompany from the new companies list.
          // Simplified:
          // const updatedC = companies.find(c => c.id === selectedCompany.id); 
          // But `companies` state update is async.
          // For now, let's rely on user going back or we manually patch selectedCompany state.
          // Actually, we can just patch `selectedCompany` state with the values we just sent to DB.
          if (selectedCompany) {
               setSelectedCompany(prev => prev ? ({ ...prev, ...companyUpdate }) : null);
          }

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
          await patchNEON({ 
              table: 'reports', 
              data: { 
                  id: reportId, 
                  status: 'submitted', 
                  approved_at: null,
                  approved_by_user_id: null
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
              const payload = {
                  company_id: f.companyId,
                  month: f.month,
                  estimated_receivables: f.estimatedReceivables,
                  estimated_payables: f.estimatedPayables
              };
              
              if (f.id) {
                   await patchNEON({ table: 'forecasts', data: { id: f.id, ...payload } });
              } else {
                   await postNEON({ table: 'forecasts', data: payload });
              }
          }
          // Reload forecasts
          if(selectedCompany) {
               const res = await getNEON({ table: 'forecasts', where: { company_id: selectedCompany.id } });
                if(res.rows) {
                    const mapped = res.rows.map((f: any) => ({
                        id: f.id,
                        companyId: f.company_id,
                        month: f.month,
                        estimatedReceivables: f.estimated_receivables || 0,
                        estimatedPayables: f.estimated_payables || 0
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
          const payload = {
              auth_id: user.authId,
              email: user.email,
              full_name: user.fullName,
              role: user.role,
              group_id: userProfile.groupId,
              company_id: user.companyId
          };
          await postNEON({ table: 'users', data: payload });
          
          const res = await getNEON({ table: 'users', where: { group_id: userProfile.groupId } });
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
          const payload = {
              id: user.id,
              auth_id: user.authId,
              email: user.email,
              full_name: user.fullName,
              role: user.role,
              company_id: user.companyId
          };
           await patchNEON({ table: 'users', data: payload });
           
           const res = await getNEON({ table: 'users', where: { group_id: userProfile.groupId } });
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
      // In sort mode, we use the local 'companies' state which is being reordered
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

  // Only sort if NOT in Sort Mode (Manual override)
  const sortedData = useMemo(() => {
    if (isSortMode) return displayedData; // Don't auto-sort while dragging

    const data = [...displayedData];
    switch (sortField) {
      case SortField.RESULT: return data.sort((a, b) => b.resultYTD - a.resultYTD);
      case SortField.DEVIATION: return data.sort((a, b) => a.calculatedDeviationPercent - b.calculatedDeviationPercent);
      case SortField.LIQUIDITY: return data.sort((a, b) => b.liquidity - a.liquidity);
      default: return data; // Default order (as is in state)
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
        onForecastSubmit={handleForecastSubmit}
      />
    );
  }

  const isAdminMode = viewMode === ViewMode.ADMIN || viewMode === ViewMode.USER_ADMIN;

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-slate-900 pb-32 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300 ${isSortMode ? 'sort-mode-active touch-none' : ''}`}>
      
      <header className="bg-white/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20 shadow-sm backdrop-blur-md transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
               <div className="bg-slate-900 dark:bg-slate-700 text-white p-2 rounded-lg shadow-md"><Building2 size={20} /></div>
               <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight hidden sm:block">{userProfile.groupName || 'Konsernoversikt'}</h1>
            </div>

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
        
        {/* SORT MODE OVERLAY UI */}
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
                        
                        <AnimatedGrid className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-3 md:gap-6 pb-24">
                            {sortedData.map((company, index) => (
                                <MetricCard 
                                    key={company.id} 
                                    data={company} 
                                    onSelect={setSelectedCompany}
                                    
                                    // Sorting Props
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