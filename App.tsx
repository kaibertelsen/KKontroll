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
import { hashPassword } from './utils/crypto';
import { logActivity } from './utils/logging';
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
  X,
  Lock,
  Save,
  KeyRound,
  Grid2X2,
  LayoutTemplate,
  RefreshCw,
  FileText,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

interface UserProfile {
    id: number;
    fullName: string;
    role: 'controller' | 'leader';
    groupId: number;
    groupName: string;
    logoUrl?: string;
    companyIds?: number[]; // Updated to support multiple companies
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

  // Determine grid columns based on zoom level (Applies primarily to XL screens)
  const getGridColumnClass = () => {
      if (zoomLevel >= 110) return 'xl:grid-cols-2 gap-8';
      if (zoomLevel === 100) return 'xl:grid-cols-3 gap-6'; // Standard
      if (zoomLevel >= 80) return 'xl:grid-cols-4 gap-4';
      return 'xl:grid-cols-5 gap-3'; // 60-70%
  };


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
            // For each user, we also need to fetch their multi-company access
            // In a real optimized backend we would do a JOIN. Here we might need N+1 query or fetch all access
            const accessRes = await getNEON({ table: 'usercompanyaccess' });
            const allAccess = accessRes.rows || [];

            const mappedUsers = res.rows.map((u: any) => {
                // Find all company IDs for this user
                const userAccess = allAccess
                    .filter((a: any) => (a.userId || a.user_id) === u.id)
                    .map((a: any) => a.companyId || a.company_id);
                
                // Fallback to legacy
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
                    companyId: legacyId, // keep legacy prop populated just in case
                    companyIds: userAccess // Populate the array
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
         salaryExpenses: r.salaryExpenses || r.salary_expenses, // New field
         liquidityDate: r.liquidityDate || r.liquidity_date || '',
         receivablesDate: r.receivablesDate || r.receivables_date || '',
         accountsPayableDate: r.accountsPayableDate || r.accounts_payable_date || '',
         publicFeesDate: r.publicFeesDate || r.public_fees_date || '',
         salaryExpensesDate: r.salaryExpensesDate || r.salary_expenses_date || '', // New field
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
            // Since API doesn't support IN clause easily, fetch all group companies then filter
             companyWhere = { groupId: userProfile.groupId };
        } else {
            companyWhere = { groupId: userProfile.groupId };
        }

        const compRes = await getNEON({ table: 'companies', where: companyWhere });
        if(compRes.rows) {
            let filteredRows = compRes.rows;
            // Manual filtering for Leader if they have specific access
            if (effectiveRole === 'leader' && userProfile.companyIds && userProfile.companyIds.length > 0) {
                filteredRows = filteredRows.filter((c: any) => userProfile.companyIds!.includes(c.id));
            }

            const mapped = filteredRows.map((c: any) => {
                // AGGRESSIVE BUDGET EXTRACTION & PARSING
                let bMonths: number[] = [];
                const rawMonths = c.budgetMonths ?? c.budget_months; // Try both
                
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

                // Determine Budget Total
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
                    salaryExpenses: Number(c.salaryExpenses || c.salary_expenses || 0), // LOAD NEW field
                    trendHistory: Number(c.trendHistory || c.trend_history || 0),
                    prevLiquidity: Number(c.prevLiquidity || c.prev_liquidity || 0),
                    prevDeviation: Number(c.prevTrend || c.prev_trend || 0),
                    name: c.name || '',
                    fullName: c.fullName || c.full_name || '', 
                    manager: c.manager || '',
                    sortOrder: Number(c.sortOrder || c.sort_order || 0), // LOAD SORT
                    revenue: Number(c.revenue || 0),
                    expenses: Number(c.expenses || 0),
                    liquidityDate: c.liquidityDate || c.liquidity_date || '',
                    receivablesDate: c.receivablesDate || c.receivables_date || '',
                    accountsPayableDate: c.accountsPayableDate || c.accounts_payable_date || '',
                    publicFeesDate: c.publicFeesDate || c.public_fees_date || '', 
                    salaryExpensesDate: c.salaryExpensesDate || c.salary_expenses_date || '', // LOAD NEW FIELD DATE
                    lastReportDate: c.lastReportDate || c.last_report_date || '',
                    lastReportBy: c.lastReportBy || c.last_report_by || '',
                    comment: c.currentComment || c.current_comment || '',
                    pnlDate: c.pnlDate || c.pnl_date || ''
                };
            });
            
            // SORT
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
      // For each company, calculate leader string and patch DB
      if (companyIds.length === 0) return;
      const uniqueIds = [...new Set(companyIds)];
      
      try {
        // 1. Fetch all leaders
        const lRes = await getNEON({ table: 'users', where: { role: 'leader' } });
        const allLeaders = lRes.rows || [];
        
        // 2. Fetch all access
        const aRes = await getNEON({ table: 'usercompanyaccess' });
        const allAccess = aRes.rows || [];

        for (const cid of uniqueIds) {
            // Find leaders for this company (via access table)
            const linkedUserIds = allAccess
                .filter((a: any) => (a.companyId === cid || a.company_id === cid))
                .map((a: any) => a.userId || a.user_id);
            
            // Also find leaders via legacy companyId (if any) that are NOT in linkedUserIds
            const legacyLeaders = allLeaders.filter((u:any) => 
                (u.companyId === cid || u.company_id === cid) && !linkedUserIds.includes(u.id)
            );
            
            // Combine both sources
            const linkedLeaders = allLeaders.filter((u: any) => linkedUserIds.includes(u.id));
            const combinedLeaders = [...linkedLeaders, ...legacyLeaders];

            // Deduplicate based on ID
            const uniqueLeaders = Array.from(new Set(combinedLeaders.map((u:any) => u.id)))
                .map(id => combinedLeaders.find((u:any) => u.id === id));

            const managerStr = uniqueLeaders.map((u: any) => u.fullName || u.full_name).join(', ') || 'Ingen leder';
            
            await patchNEON({ table: 'companies', data: { id: cid, manager: managerStr } });
        }
        
        // Reload companies to refresh UI with new manager strings
        await reloadCompanies();
      } catch (err) {
        console.error("Failed to sync manager names", err);
      }
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
          // 1. Verify old password (fetch current user data first)
          const res = await getNEON({ table: 'users', where: { id: userProfile.id } });
          const user = res.rows[0];
          
          if (!user) {
              alert("Feil: Fant ikke bruker.");
              return;
          }

          const oldHash = await hashPassword(passwordForm.oldPassword);
          const legacyMatch = user.password === passwordForm.oldPassword;
          const hashMatch = user.password === oldHash;

          if (!legacyMatch && !hashMatch) {
               alert("Gammelt passord er feil.");
               return;
          }

          // 2. Hash new password and update
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
              salaryExpenses: newCompany.salaryExpenses, // New
              pnlDate: newCompany.pnlDate,
              liquidityDate: newCompany.liquidityDate,
              receivablesDate: newCompany.receivablesDate,
              accountsPayableDate: newCompany.accountsPayableDate,
              publicFeesDate: newCompany.publicFeesDate,
              salaryExpensesDate: newCompany.salaryExpensesDate, // New
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
              salaryExpenses: updatedCompany.salaryExpenses, // New
              pnlDate: updatedCompany.pnlDate,
              liquidityDate: updatedCompany.liquidityDate,
              receivablesDate: updatedCompany.receivablesDate,
              accountsPayableDate: updatedCompany.accountsPayableDate,
              publicFeesDate: updatedCompany.publicFeesDate,
              salaryExpensesDate: updatedCompany.salaryExpensesDate, // New
              trendHistory: updatedCompany.trendHistory
          };

          if (!isDemo) {
              await patchNEON({ table: 'companies', data: dbPayload });
              logActivity(userProfile.id, 'UPDATE_COMPANY', 'companies', updatedCompany.id, `Oppdaterte selskap: ${updatedCompany.name}`);
              await reloadCompanies();
          } else {
              setCompanies(companies.map(c => c.id === updatedCompany.id ? updatedCompany : c));
          }
          
          // Force immediate calculation update in selectedCompany to avoid stale data in detail view
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
          // Identify target company ID (handle both CompanyDetail view and Admin view)
          const targetCompanyId = selectedCompany?.id || reportData.companyId;

          if (!targetCompanyId) {
             console.error("No company ID found for report submission");
             return;
          }

          if (isDemo) {
               // ... demo logic ...
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
      // ... (Existing logic logic) ...
       if (!window.confirm("Er du sikker på at du vil slette denne rapporten?")) return;
       // Simply call delete logic as before...
       try {
            await deleteNEON({ table: 'reports', data: reportId });
            logActivity(userProfile.id, 'DELETE_REPORT', 'reports', reportId, 'Slettet rapport');
            setReports(prev => prev.filter(r => r.id !== reportId));
            setAllReports(prev => prev.filter(r => r.id !== reportId));
            // Trigger reload to update company totals if needed
            await reloadCompanies();
       } catch (e) {
           console.error("Delete report error", e);
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
          logActivity(userProfile.id, 'APPROVE_REPORT', 'reports', reportId, 'Godkjente rapport');
          
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
      // ... existing logic ...
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
          logActivity(userProfile.id, 'UNLOCK_REPORT', 'reports', reportId, 'Låste opp rapport (tilbake til submitted)');
          const updater = (r: ReportLogItem) => r.id === reportId ? { ...r, status: 'submitted' as const, approvedBy: undefined } : r;
          setReports(prev => prev.map(updater));
          setAllReports(prev => prev.map(updater));
      } catch (e) { console.error("Unlock error", e); }
  };

  const handleForecastSubmit = async (submittedForecasts: ForecastItem[]) => {
      // ... existing logic ...
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
          logActivity(userProfile.id, 'UPDATE_FORECAST', 'forecasts', undefined, 'Oppdaterte likviditetsprognose');
          if(selectedCompany) {
             fetchForecasts(selectedCompany.id);
          }
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

      setSelectedCompany({
          ...raw,
          calculatedBudgetYTD: targetBudget,
          calculatedDeviationPercent: deviationPercent
      });
  };

  // --- REFRESH HANDLERS ---
  const handleGlobalRefresh = async () => {
      setIsGlobalRefreshing(true);
      await reloadCompanies();
      if (viewMode === ViewMode.ADMIN) await fetchAllReports();
      // Artificial delay for UI feedback
      await new Promise(r => setTimeout(r, 600));
      setIsGlobalRefreshing(false);
  };
  
  const handleCompanyRefresh = async (companyId: number) => {
      await reloadCompanies();
      await fetchCompanyReports(companyId);
      await fetchForecasts(companyId);
      // Small delay for UI inside the child
      await new Promise(r => setTimeout(r, 600));
  };

  // --- USER HANDLERS (MULTI-COMPANY SUPPORT) ---
  const handleAddUser = async (user: Omit<UserData, 'id'>) => {
      try {
          const payload = {
              email: user.email,
              password: user.password,
              fullName: user.fullName,
              role: user.role,
              groupId: userProfile.groupId,
              companyId: null // Legacy support: set null or default
          };
          
          // 1. Create User
          const res = await postNEON({ table: 'users', data: payload });
          // Ensure we get the ID. The `inserted` field contains the rows.
          const createdUser = res.inserted[0];
          logActivity(userProfile.id, 'CREATE_USER', 'users', createdUser.id, `Opprettet bruker: ${user.email}`);

          // 2. Add Company Access Rows
          if (user.companyIds && user.companyIds.length > 0) {
              const accessRows = user.companyIds.map(cid => ({
                  userId: createdUser.id,
                  companyId: cid
              }));
              await postNEON({ table: 'usercompanyaccess', data: accessRows });
          }
          
          fetchUsers();

          // --- AUTO-UPDATE MANAGER NAMES ---
          if (user.role === 'leader' && user.companyIds && user.companyIds.length > 0) {
              await syncManagers(user.companyIds);
          }

      } catch (e) {
          console.error("Add user error", e);
          alert("Kunne ikke legge til bruker");
      }
  };

  const handleUpdateUser = async (user: UserData) => {
      try {
          // 1. Update User Details
          const payload: any = {
              id: user.id,
              email: user.email,
              fullName: user.fullName,
              role: user.role
          };
          if (user.password) payload.password = user.password;
          await patchNEON({ table: 'users', data: payload });

          // 2. Update Company Access (Delete all, then Insert new)
          // Fetch existing to delete
          const accessRes = await getNEON({ table: 'usercompanyaccess', where: { userId: user.id } });
          const existingIds = (accessRes.rows || []).map((r:any) => r.id);
          const existingCompanyIds = (accessRes.rows || []).map((r:any) => r.companyId || r.company_id);
          
          if (existingIds.length > 0) {
              await deleteNEON({ table: 'usercompanyaccess', data: existingIds });
          }

          // Insert new
          if (user.companyIds && user.companyIds.length > 0) {
              const accessRows = user.companyIds.map(cid => ({
                  userId: user.id,
                  companyId: cid
              }));
              await postNEON({ table: 'usercompanyaccess', data: accessRows });
          }
           
          logActivity(userProfile.id, 'UPDATE_USER', 'users', user.id, `Oppdaterte bruker: ${user.email}`);
          fetchUsers();
          
          // Sync managers for old and new companies
          const allAffectedIds = [...new Set([...existingCompanyIds, ...(user.companyIds || [])])];
          await syncManagers(allAffectedIds);

      } catch (e) {
          console.error("Update user error", e);
          alert("Kunne ikke oppdatere bruker");
      }
  };

  const handleDeleteUser = async (id: number) => {
       try {
          // Fetch existing to know which companies to sync
          const accessRes = await getNEON({ table: 'usercompanyaccess', where: { userId: id } });
          const existingCompanyIds = (accessRes.rows || []).map((r:any) => r.companyId || r.company_id);

          // Delete access rows
          await deleteNEON({ table: 'usercompanyaccess', data: id, field: 'userId' });
          
          // Then delete user
          await deleteNEON({ table: 'users', data: id });
          logActivity(userProfile.id, 'DELETE_USER', 'users', id, 'Slettet bruker');
          
          setUsers(users.filter(u => u.id !== id));
          
          // Sync managers
          await syncManagers(existingCompanyIds);
      } catch (e) {
          console.error("Delete user error", e);
          alert("Kunne ikke slette bruker (sjekk om brukeren har rapporter)");
      }
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
          if (isDemo) return companies.filter(c => c.name === 'BCC' || c.name === 'PHR'); // Demo example
          // Logic: User sees companies in their companyIds list
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
      default: return data; // Uses default load order (sortOrder)
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
  const totalSalaryExpenses = computedData.reduce((acc, curr) => acc + (curr.salaryExpenses || 0), 0); // New Aggregation
  
  // Updated Working Capital: Liquidity + Receivables - Payables - PublicFees - SalaryExpenses
  const totalWorkingCapital = (totalLiquidity + totalReceivables) - (totalPayables + totalPublicFees + totalSalaryExpenses);
  
  const currentDateDisplay = new Date().toLocaleDateString('no-NO', { day: 'numeric', month: 'long' });
  const lastMonthDisplay = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toLocaleDateString('no-NO', { day: 'numeric', month: 'long' });

  // --- FOOTER CHIP HELPER ---
  const MetricChip = ({ label, value, bgClass, textClass }: { label: string, value: number, bgClass: string, textClass?: string }) => {
        const isNeg = value < 0;
        return (
            <div className={`flex flex-col justify-center px-3 py-1.5 rounded-xl border border-opacity-60 shadow-sm min-w-[90px] backdrop-blur-sm ${bgClass}`}>
                <span className={`text-[9px] uppercase font-bold tracking-wider mb-0.5 ${textClass || 'text-slate-500 dark:text-slate-400'}`}>{label}</span>
                <span className={`text-xs sm:text-sm font-bold tabular-nums leading-tight ${isNeg ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                    {formatCurrency(value)}
                </span>
            </div>
        );
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
      />
    );
  }

  const isAdminMode = viewMode === ViewMode.ADMIN || viewMode === ViewMode.ADMIN_REPORTS || viewMode === ViewMode.USER_ADMIN;

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-slate-900 pb-32 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300 ${isSortMode ? 'sort-mode-active touch-none' : ''}`}>
      
      <header className="bg-white/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20 shadow-sm backdrop-blur-md transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* LOGO LINK - CHANGED TO INTERNAL NAVIGATION */}
            <button 
                onClick={() => {
                    setViewMode(ViewMode.GRID);
                    setSelectedCompany(null);
                }}
                className="flex items-center gap-3 group focus:outline-none"
            >
               <div className="bg-white/10 p-2 rounded-lg group-hover:bg-white/20 transition-colors">
                  <img 
                      src="https://ucarecdn.com/b3e83749-8c8a-4382-b28b-fe1d988eff42/Attentioshlogo.png" 
                      alt="Logo" 
                      className="h-8 w-auto"
                  />
               </div>
               <div>
                  <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">KonsernKontroll</h1>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-widest">{userProfile.groupName}</p>
               </div>
            </button>

            {/* Right Side Actions */}
            <div className="flex items-center gap-4">
                {/* View Modes */}
                <div className="flex bg-slate-100 dark:bg-slate-700/50 p-1 rounded-lg">
                    <button onClick={() => setViewMode(ViewMode.GRID)} className={`p-2 rounded-md transition-all ${viewMode === ViewMode.GRID ? 'bg-white dark:bg-slate-600 shadow-sm text-sky-600 dark:text-sky-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`} title="Kortvisning">
                        <LayoutGrid size={18} />
                    </button>
                    <button onClick={() => setViewMode(ViewMode.ANALYTICS)} className={`p-2 rounded-md transition-all ${viewMode === ViewMode.ANALYTICS ? 'bg-white dark:bg-slate-600 shadow-sm text-sky-600 dark:text-sky-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`} title="Analyse">
                        <BarChart3 size={18} />
                    </button>
                     {effectiveRole === 'controller' && (
                        <button onClick={() => setViewMode(ViewMode.ADMIN)} className={`p-2 rounded-md transition-all ${viewMode === ViewMode.ADMIN ? 'bg-white dark:bg-slate-600 shadow-sm text-sky-600 dark:text-sky-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`} title="Admin">
                            <Settings size={18} />
                        </button>
                    )}
                </div>
                
                 {/* User Menu */}
                <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-700">
                     <div className="text-right hidden sm:block">
                        <div className="text-sm font-bold text-slate-900 dark:text-white">{userProfile.fullName}</div>
                        <div className="text-xs text-slate-500 capitalize">{userProfile.role}</div>
                     </div>
                     <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-rose-600 transition-colors" title="Logg ut">
                        <LogOut size={18} />
                     </button>
                </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
         {/* Main Content Switch */}
         {viewMode === ViewMode.GRID && (
             <>
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsTodayMode(!isTodayMode)} className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${isTodayMode ? 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800' : 'bg-white text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
                            {isTodayMode ? 'Visning: Hittil i dag' : 'Visning: Hittil i måneden'}
                        </button>
                        
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-1">
                            <button onClick={handleZoomOut} className="p-1 text-slate-400 hover:text-slate-600"><ZoomOut size={14} /></button>
                            <span className="text-xs font-mono text-slate-500 w-8 text-center">{zoomLevel}%</span>
                            <button onClick={handleZoomIn} className="p-1 text-slate-400 hover:text-slate-600"><ZoomIn size={14} /></button>
                        </div>
                    </div>
                    
                    <div className="flex gap-2">
                        <button onClick={handleSortToggle} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isSortMode ? 'bg-amber-100 text-amber-700' : 'bg-white text-slate-600 border border-slate-200'}`}>
                            <ArrowUpDown size={14} /> {isSortMode ? 'Lagre Rekkefølge' : 'Sorter'}
                        </button>
                    </div>
                </div>

                <AnimatedGrid className={`grid grid-cols-1 md:grid-cols-2 ${getGridColumnClass()} transition-all duration-300`}>
                    {sortedData.map((company, index) => (
                        <MetricCard 
                            key={company.id} 
                            index={index}
                            data={company} 
                            onSelect={setSelectedCompany}
                            isSortMode={isSortMode}
                            onDragStart={onDragStart}
                            onDragEnter={onDragEnter}
                            onDragEnd={onDragEnd}
                            cardSize={cardSize}
                            zoomLevel={zoomLevel}
                        />
                    ))}
                </AnimatedGrid>
             </>
         )}

         {viewMode === ViewMode.ANALYTICS && (
             <AnalyticsView data={computedData} />
         )}

         {(viewMode === ViewMode.ADMIN || viewMode === ViewMode.ADMIN_REPORTS) && (
             <AdminView 
                currentView={viewMode === ViewMode.ADMIN ? 'companies' : 'reports'}
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
         
         {viewMode === ViewMode.USER_ADMIN && (
             <UserAdminView 
                users={users} 
                companies={companies}
                onAdd={handleAddUser}
                onUpdate={handleUpdateUser}
                onDelete={handleDeleteUser}
             />
         )}

      </main>

      {/* Footer Summary */}
      {!isAdminMode && (
          <div className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-4 z-20 shadow-lg">
              <div className="max-w-7xl mx-auto flex flex-nowrap overflow-x-auto gap-4 md:justify-center pb-2 md:pb-0 scrollbar-hide">
                    <MetricChip label="Total Omsetning" value={totalRevenue} bgClass="bg-slate-100 dark:bg-slate-800" />
                    <MetricChip label="Total Resultat" value={totalResult} bgClass="bg-emerald-50 dark:bg-emerald-900/20" textClass="text-emerald-600 dark:text-emerald-400" />
                    <MetricChip label="Total Likviditet" value={totalLiquidity} bgClass="bg-blue-50 dark:bg-blue-900/20" textClass="text-blue-600 dark:text-blue-400" />
                    <MetricChip label="Arbeidskapital" value={totalWorkingCapital} bgClass="bg-indigo-50 dark:bg-indigo-900/20" textClass="text-indigo-600 dark:text-indigo-400" />
              </div>
          </div>
      )}

      {/* Password Modal */}
      {isPasswordModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 dark:border-slate-700 p-6 animate-in zoom-in-95">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Bytt Passord</h3>
                  <form onSubmit={handleChangePassword} className="space-y-4">
                      <input 
                        type="password" 
                        placeholder="Gammelt passord" 
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                        value={passwordForm.oldPassword}
                        onChange={e => setPasswordForm({...passwordForm, oldPassword: e.target.value})}
                      />
                      <input 
                        type="password" 
                        placeholder="Nytt passord" 
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                        value={passwordForm.newPassword}
                        onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                      />
                      <input 
                        type="password" 
                        placeholder="Bekreft nytt passord" 
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500"
                        value={passwordForm.confirmPassword}
                        onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                      />
                      <div className="flex gap-2 pt-2">
                          <button type="button" onClick={() => setIsPasswordModalOpen(false)} className="flex-1 py-2 text-slate-500 text-sm font-bold">Avbryt</button>
                          <button type="submit" className="flex-1 py-2 bg-sky-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-sky-500">Lagre</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

    </div>
  );
}

export default App;