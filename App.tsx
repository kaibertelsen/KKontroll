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
    logoUrl?: string;
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
  const [isTodayMode, setIsTodayMode] = useState<boolean>(false);
  const [selectedCompany, setSelectedCompany] = useState<ComputedCompanyData | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

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

  // --- DATA POLLING ---
  useEffect(() => {
      if (isDemo) return;

      const interval = setInterval(async () => {
          console.log("Polling data...");
          await reloadCompanies();
          if (viewMode === ViewMode.ADMIN) {
              fetchAllReports();
          }
          if (selectedCompany) {
              fetchCompanyReports(selectedCompany.id);
          }
      }, 30000); // 30 seconds

      return () => clearInterval(interval);
  }, [isDemo, selectedCompany, viewMode]);


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
      setIsSortMode(false);
      dragItem.current = null;
      dragOverItem.current = null;
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
          
          // Fetch ALL reports for admin view
          fetchAllReports();
      }
  }, [isDemo, userProfile, viewMode, effectiveRole]);

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
         liquidityDate: r.liquidityDate || r.liquidity_date || '',
         receivablesDate: r.receivablesDate || r.receivables_date || '',
         accountsPayableDate: r.accountsPayableDate || r.accounts_payable_date || '',
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
        if (effectiveRole === 'leader' && userProfile.companyId) {
            companyWhere = { id: userProfile.companyId };
        } else {
            companyWhere = { groupId: userProfile.groupId };
        }

        const compRes = await getNEON({ table: 'companies', where: companyWhere });
        if(compRes.rows) {
            const mapped = compRes.rows.map((c: any) => {
                // AGGRESSIVE BUDGET EXTRACTION & PARSING
                let bMonths: number[] = [];
                const rawMonths = c.budgetMonths ?? c.budget_months; // Try both
                
                try {
                    if (Array.isArray(rawMonths)) {
                        bMonths = rawMonths.map(Number);
                    } else if (typeof rawMonths === 'object' && rawMonths !== null) {
                        // Handle generic object case {0: 100, 1: 200}
                        bMonths = Object.values(rawMonths).map(Number);
                    } else if (typeof rawMonths === 'string') {
                        // Handle JSON format "[1,2,3]" OR Postgres Array format "{1,2,3}"
                        let cleanStr = rawMonths.trim();
                        // If it looks like Postgres array { ... }, convert to JSON [ ... ]
                        if (cleanStr.startsWith('{') && cleanStr.endsWith('}')) {
                            cleanStr = cleanStr.replace('{', '[').replace('}', ']');
                        }
                        
                        try {
                            const parsed = JSON.parse(cleanStr);
                            if (Array.isArray(parsed)) bMonths = parsed.map(Number);
                        } catch (jsonErr) {
                            console.warn("JSON parse failed in reload, trying comma split", cleanStr);
                            // Fallback: Split by comma if strictly numbers
                            const parts = cleanStr.replace(/[\[\]\{\}]/g, '').split(',');
                            if (parts.length > 0 && !parts.some(p => isNaN(Number(p)))) {
                                bMonths = parts.map(Number);
                            }
                        }
                    }
                } catch(e) {
                    console.warn("Budget parsing error in reload", e);
                }

                if (!bMonths || bMonths.length !== 12 || bMonths.some(isNaN)) {
                    bMonths = Array(12).fill(0);
                }

                // Determine Budget Total
                const bTotal = Number(c.budgetTotal || c.budget_total || 0);
                const sumMonths = bMonths.reduce((a, b) => a + b, 0);

                // Fallback: If total budget exists but month distribution is empty/zero/NaN, distribute flat
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
                    trendHistory: Number(c.trendHistory || c.trend_history || 0),
                    prevLiquidity: Number(c.prevLiquidity || c.prev_liquidity || 0),
                    prevDeviation: Number(c.prevTrend || c.prev_trend || 0),
                    name: c.name || '',
                    fullName: c.fullName || c.full_name || '', 
                    manager: c.manager || '',
                    revenue: Number(c.revenue || 0),
                    expenses: Number(c.expenses || 0),
                    liquidityDate: c.liquidityDate || c.liquidity_date || '',
                    receivablesDate: c.receivablesDate || c.receivables_date || '',
                    accountsPayableDate: c.accountsPayableDate || c.accounts_payable_date || '',
                    lastReportDate: c.lastReportDate || c.last_report_date || '',
                    lastReportBy: c.lastReportBy || c.last_report_by || '',
                    comment: c.currentComment || c.current_comment || '',
                    pnlDate: c.pnlDate || c.pnl_date || ''
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
          const dbPayload = {
              groupId: userProfile.groupId, 
              name: newCompany.name,
              fullName: newCompany.fullName,
              manager: newCompany.manager,
              revenue: newCompany.revenue,
              expenses: newCompany.expenses,
              resultYtd: newCompany.resultYTD, 
              budgetTotal: newCompany.budgetTotal,
              budget_total: newCompany.budgetTotal, // Backup snake_case
              budgetMode: newCompany.budgetMode,
              budget_mode: newCompany.budgetMode, // Backup snake_case
              budgetMonths: newCompany.budgetMonths,
              budget_months: newCompany.budgetMonths, // Backup snake_case
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
           const dbPayload = {
              id: updatedCompany.id,
              name: updatedCompany.name,
              fullName: updatedCompany.fullName,
              manager: updatedCompany.manager,
              revenue: updatedCompany.revenue,
              expenses: updatedCompany.expenses,
              resultYtd: updatedCompany.resultYTD,
              budgetTotal: updatedCompany.budgetTotal,
              budget_total: updatedCompany.budgetTotal, // Backup snake_case
              budgetMode: updatedCompany.budgetMode,
              budget_mode: updatedCompany.budgetMode, // Backup snake_case
              budgetMonths: updatedCompany.budgetMonths,
              budget_months: updatedCompany.budgetMonths, // Backup snake_case
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
          // Identify target company ID (handle both CompanyDetail view and Admin view)
          const targetCompanyId = selectedCompany?.id || reportData.companyId;

          if (!targetCompanyId) {
             console.error("No company ID found for report submission");
             return;
          }

          if (isDemo) {
               const newReport: ReportLogItem = {
                   id: Math.random(),
                   date: new Date().toLocaleDateString('no-NO'),
                   author: userProfile.fullName,
                   comment: reportData.comment,
                   status: 'submitted',
                   companyId: targetCompanyId,
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
               
               // Also update allReports if in Admin view
               setAllReports(prev => [newReport, ...prev]);
               return;
          }

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

          if (reportData.id) {
              await patchNEON({ table: 'reports', data: { id: reportData.id, ...reportPayload } });
          } else {
              await postNEON({ table: 'reports', data: reportPayload });
          }

          // 2. UPDATE COMPANY SNAPSHOT IMMEDIATELY
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

          companyUpdate.lastReportDate = new Date().toLocaleDateString('no-NO');
          companyUpdate.lastReportBy = userProfile.fullName;
          companyUpdate.currentComment = reportData.comment;

          await patchNEON({ table: 'companies', data: companyUpdate });

          // 3. Refresh App State
          await reloadCompanies();

          if (selectedCompany) {
              fetchCompanyReports(selectedCompany.id);
          }
          // Refresh Admin List
          fetchAllReports();

      } catch (e) {
          console.error("Report submit error", e);
          alert("Feil ved innsending av rapport.");
      }
  };

  // Handle Delete Report
  const handleDeleteReport = async (reportId: number) => {
      if (!window.confirm("Er du sikker på at du vil slette denne rapporten?")) return;
      
      let companyIdToUpdate: number | undefined;

      if (isDemo) {
          // Identify company from local state
          const report = reports.find(r => r.id === reportId) || allReports.find(r => r.id === reportId);
          companyIdToUpdate = report?.companyId;

          const newReports = reports.filter(r => r.id !== reportId);
          setReports(newReports);
          setAllReports(prev => prev.filter(r => r.id !== reportId));
          
          if (companyIdToUpdate) {
              // In demo, simplistic update: if we have reports left, assume the latest one dictates state
              const relevantReports = newReports.filter(r => r.companyId === companyIdToUpdate);
              relevantReports.sort((a, b) => {
                   // Quick parse DD.MM.YYYY
                   const da = a.date.split('.').reverse().join('-');
                   const db = b.date.split('.').reverse().join('-');
                   return new Date(db).getTime() - new Date(da).getTime();
              });

              const latest = relevantReports[0];
              
              // We need to update the `companies` state
              setCompanies(prev => prev.map(c => {
                   if (c.id !== companyIdToUpdate) return c;
                   
                   if (latest) {
                       return {
                           ...c,
                           revenue: latest.revenue || 0,
                           expenses: latest.expenses || 0,
                           resultYTD: latest.result || ((latest.revenue || 0) - (latest.expenses || 0)),
                           liquidity: latest.liquidity || 0,
                           receivables: latest.receivables || 0,
                           accountsPayable: latest.accountsPayable || 0,
                           currentComment: latest.comment
                           // Note: dates are strings in demo mock, simple copy if present
                       };
                   } else {
                       // Reset to 0
                       return {
                           ...c,
                           revenue: 0,
                           expenses: 0,
                           resultYTD: 0,
                           liquidity: 0,
                           receivables: 0,
                           accountsPayable: 0,
                           currentComment: ''
                       };
                   }
              }));
              
              // If selected company is the one updated, we need to force update it from the new companies list
              if (selectedCompany && selectedCompany.id === companyIdToUpdate) {
                   setSelectedCompany(prev => {
                       if (!prev) return null;
                       if (latest) {
                            return {
                                ...prev,
                                revenue: latest.revenue || 0,
                                expenses: latest.expenses || 0,
                                resultYTD: latest.result || ((latest.revenue || 0) - (latest.expenses || 0)),
                                liquidity: latest.liquidity || 0,
                                receivables: latest.receivables || 0,
                                accountsPayable: latest.accountsPayable || 0
                            };
                       } else {
                            return {
                                ...prev,
                                revenue: 0, expenses: 0, resultYTD: 0, liquidity: 0, receivables: 0, accountsPayable: 0
                            };
                       }
                   });
              }
          }
          return;
      }

      try {
          // 1. Identify Company ID
          const localReport = reports.find(r => r.id === reportId) || allReports.find(r => r.id === reportId);
          if (localReport) {
              companyIdToUpdate = localReport.companyId;
          } else {
               const res = await getNEON({ table: 'reports', where: { id: reportId } });
               if (res.rows && res.rows.length > 0) {
                   companyIdToUpdate = res.rows[0].companyId || res.rows[0].company_id;
               }
          }

          // 2. Delete the Report
          await deleteNEON({ table: 'reports', data: reportId });
          
          // Update local UI lists
          setReports(prev => prev.filter(r => r.id !== reportId));
          setAllReports(prev => prev.filter(r => r.id !== reportId));

          // 3. Recalculate Company State
          if (companyIdToUpdate) {
              const res = await getNEON({ table: 'reports', where: { companyId: companyIdToUpdate } });
              // Explicitly filter out the deleted ID just in case
              const validReports = (res.rows || []).filter((r: any) => r.id !== reportId);
              
              // Sort by date/created desc
              validReports.sort((a: any, b: any) => {
                  const dateA = new Date(a.reportDate || a.report_date).getTime();
                  const dateB = new Date(b.reportDate || b.report_date).getTime();
                  if (dateA === dateB) return b.id - a.id;
                  return dateB - dateA;
              });
              
              const latest = validReports[0];
              const companyUpdate: any = { id: companyIdToUpdate };
              
              // Helper to safely access row props (camel or snake)
              const getVal = (row: any, ...keys: string[]) => {
                  for (const k of keys) {
                      if (row[k] !== undefined && row[k] !== null) return row[k];
                  }
                  return null;
              };

              if (latest) {
                 const l_revenue = Number(getVal(latest, 'revenue') ?? 0);
                 const l_expenses = Number(getVal(latest, 'expenses') ?? 0);
                 const l_result = Number(getVal(latest, 'resultYtd', 'result_ytd') ?? (l_revenue - l_expenses));
                 
                 companyUpdate.revenue = l_revenue;
                 companyUpdate.expenses = l_expenses;
                 companyUpdate.resultYtd = l_result;
                 companyUpdate.result_ytd = l_result; 

                 const l_liq = getVal(latest, 'liquidity');
                 if (l_liq !== null) companyUpdate.liquidity = Number(l_liq);
                 
                 const l_rec = getVal(latest, 'receivables');
                 if (l_rec !== null) companyUpdate.receivables = Number(l_rec);
                 
                 const l_pay = getVal(latest, 'accountsPayable', 'accounts_payable');
                 if (l_pay !== null) {
                     companyUpdate.accountsPayable = Number(l_pay);
                     companyUpdate.accounts_payable = Number(l_pay);
                 }

                 // Dates
                 const l_liqDate = getVal(latest, 'liquidityDate', 'liquidity_date');
                 if(l_liqDate) { companyUpdate.liquidityDate = l_liqDate; companyUpdate.liquidity_date = l_liqDate; }
                 
                 const l_recDate = getVal(latest, 'receivablesDate', 'receivables_date');
                 if(l_recDate) { companyUpdate.receivablesDate = l_recDate; companyUpdate.receivables_date = l_recDate; }

                 const l_payDate = getVal(latest, 'accountsPayableDate', 'accounts_payable_date');
                 if(l_payDate) { companyUpdate.accountsPayableDate = l_payDate; companyUpdate.accounts_payable_date = l_payDate; }
                 
                 const l_pnlDate = getVal(latest, 'pnlDate', 'pnl_date');
                 if(l_pnlDate) { companyUpdate.pnlDate = l_pnlDate; companyUpdate.pnl_date = l_pnlDate; }
                 
                 const l_reportDate = getVal(latest, 'reportDate', 'report_date');
                 if (l_reportDate) {
                     const d = new Date(l_reportDate).toLocaleDateString('no-NO');
                     companyUpdate.lastReportDate = d;
                     companyUpdate.last_report_date = d;
                 }
                 
                 const l_author = getVal(latest, 'authorName', 'author_name');
                 if(l_author) {
                     companyUpdate.lastReportBy = l_author;
                     companyUpdate.last_report_by = l_author;
                 }

                 const l_comment = getVal(latest, 'comment');
                 if(l_comment) {
                     companyUpdate.currentComment = l_comment;
                     companyUpdate.current_comment = l_comment;
                 }

              } else {
                 // Reset values if no reports
                 companyUpdate.revenue = 0;
                 companyUpdate.expenses = 0;
                 companyUpdate.resultYtd = 0;
                 companyUpdate.result_ytd = 0;
                 companyUpdate.liquidity = 0;
                 companyUpdate.receivables = 0;
                 companyUpdate.accountsPayable = 0;
                 companyUpdate.accounts_payable = 0;
                 companyUpdate.currentComment = '';
                 companyUpdate.current_comment = '';
                 companyUpdate.lastReportDate = '';
                 companyUpdate.last_report_date = '';
                 companyUpdate.lastReportBy = '';
                 companyUpdate.last_report_by = '';
              }
              
              await patchNEON({ table: 'companies', data: companyUpdate });
              
              // 4. Reload Data
              await reloadCompanies();
              if (viewMode === ViewMode.ADMIN) fetchAllReports();
          }

      } catch (e) {
          console.error("Delete report error", e);
          alert("Kunne ikke slette rapporten.");
      }
  };

  const handleApproveReport = async (reportId: number) => {
      if (isDemo) {
          const updater = (r: ReportLogItem) => r.id === reportId ? { ...r, status: 'approved' as const, approvedBy: 'Demo Controller' } : r;
          setReports(prev => prev.map(updater));
          setAllReports(prev => prev.map(updater));
          return;
      }
      try {
          await patchNEON({ 
              table: 'reports', 
              data: { 
                  id: reportId, 
                  status: 'approved', 
                  approvedByUserId: userProfile.id 
              } 
          });
          
          // Update lists immediately
          const updater = (r: ReportLogItem) => r.id === reportId ? { ...r, status: 'approved' as const, approvedBy: 'Kontroller' } : r;
          setReports(prev => prev.map(updater));
          setAllReports(prev => prev.map(updater));

      } catch (e) {
          console.error("Approval error", e);
          alert("Feil ved godkjenning.");
      }
  };

  const handleUnlockReport = async (reportId: number) => {
      if(isDemo) {
           const updater = (r: ReportLogItem) => r.id === reportId ? { ...r, status: 'submitted' as const, approvedBy: undefined } : r;
           setReports(prev => prev.map(updater));
           setAllReports(prev => prev.map(updater));
           return;
      }
      try {
          await patchNEON({ 
              table: 'reports', 
              data: { 
                  id: reportId, 
                  status: 'submitted', 
                  approvedAt: null,
                  approvedByUserId: null
              } 
          });
          const updater = (r: ReportLogItem) => r.id === reportId ? { ...r, status: 'submitted' as const, approvedBy: undefined } : r;
          setReports(prev => prev.map(updater));
          setAllReports(prev => prev.map(updater));
      } catch (e) {
          console.error("Unlock error", e);
      }
  };

  const handleForecastSubmit = async (submittedForecasts: ForecastItem[]) => {
      console.log("App.tsx: handleForecastSubmit called with", submittedForecasts);
      if(isDemo) {
          setForecasts(submittedForecasts);
          return;
      }
      try {
          for (const f of submittedForecasts) {
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
        // Rely on pre-processed budgetMonths from reloadCompanies/initKonsernKontroll
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
                <div className="flex items-center bg-slate-100 dark:bg-slate-700/50 p-1 rounded-full border border-slate-200 dark:border-slate-600 absolute left-1/2 transform -translate-x-1/2 hidden md:flex">
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
        
        {/* ... (Sort overlay logic remains) ... */}
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
           <AdminView 
               companies={companies} 
               allReports={allReports}
               onAdd={handleAddCompany} 
               onUpdate={handleUpdateCompany} 
               onDelete={handleDeleteCompany}
               // Removed onLogoUpload
               onViewReport={(r) => {}} 
               onReportSubmit={handleSubmitReport}
               onApproveReport={handleApproveReport}
               onUnlockReport={handleUnlockReport}
               onDeleteReport={handleDeleteReport}
           />
        )}
        {/* ... (UserAdminView logic remains) ... */}
        {viewMode === ViewMode.USER_ADMIN && effectiveRole === 'controller' && (
            <UserAdminView users={users} companies={companies} onAdd={handleAddUser} onUpdate={handleUpdateUser} onDelete={handleDeleteUser} />
        )}
        
        {!isAdminMode && (
            <>
                {/* ... (Dashboard buttons / filters logic remains) ... */}
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
      
      {/* Footer - REBUILT */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur border-t border-slate-200 dark:border-slate-700 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] z-20 transition-colors duration-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Aggregates - Show simpler version on mobile */}
              {!isAdminMode && (
                <div className="flex-1 overflow-x-auto whitespace-nowrap scrollbar-hide">
                     <div className="flex gap-4 text-center sm:text-left">
                        <div className="flex flex-col px-2 border-r border-slate-100 dark:border-slate-700"><span className="text-[9px] uppercase font-bold text-slate-400">Omsetning</span><span className="text-xs font-bold text-slate-900 dark:text-white">{formatCurrency(totalRevenue)}</span></div>
                        <div className="flex flex-col px-2 border-r border-slate-100 dark:border-slate-700"><span className="text-[9px] uppercase font-bold text-slate-400">Resultat</span><span className="text-xs font-bold text-slate-900 dark:text-white">{formatCurrency(totalResult)}</span></div>
                        <div className="flex flex-col px-2"><span className="text-[9px] uppercase font-bold text-slate-400">Likviditet</span><span className="text-xs font-bold text-emerald-600">{formatCurrency(totalLiquidity)}</span></div>
                     </div>
                </div>
              )}
              
              {/* Attentio Footer Branding */}
              <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
                 <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Powered by</span>
                 <a href="https://www.attentio.no" target="_blank" rel="noreferrer">
                     <img src="https://ucarecdn.com/a57dd98f-5b74-4f56-8480-2ff70d700b09/667bf8f6e052ebdb5596b770_Logo1.png" alt="Attentio" className="h-4 w-auto grayscale hover:grayscale-0 transition-all" />
                 </a>
              </div>
          </div>
      </div>
    </div>
  );
}

export default App;