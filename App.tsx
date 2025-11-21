
import React, { useState, useMemo, useEffect } from 'react';
import { formatCurrency } from './constants';
import { ComputedCompanyData, SortField, ViewMode, CompanyData, UserData, ReportLogItem } from './types';
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
  Briefcase
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

  // Demo Role State (Only used if isDemo is true)
  const [demoRole, setDemoRole] = useState<'controller' | 'leader'>(userProfile.role);

  // Effective Role (Use demoRole if in demo mode, otherwise use real profile role)
  const effectiveRole = isDemo ? demoRole : userProfile.role;

  // DATA STATE
  const [companies, setCompanies] = useState<CompanyData[]>(initialCompanies || []);
  const [users, setUsers] = useState<UserData[]>([]);
  const [reports, setReports] = useState<ReportLogItem[]>([]);

  // --- FETCH USERS (Only for Admin) ---
  useEffect(() => {
      if (!isDemo && effectiveRole === 'controller' && (viewMode === ViewMode.ADMIN || viewMode === ViewMode.USER_ADMIN)) {
          getNEON({ table: 'users', where: { group_id: userProfile.groupId } })
            .then(res => {
                if(res.rows) {
                    const mappedUsers = res.rows.map((u: any) => ({
                        id: u.id,
                        authId: u.auth_id,
                        email: u.email,
                        fullName: u.full_name,
                        role: u.role,
                        groupId: u.group_id,
                        companyId: u.company_id
                    }));
                    setUsers(mappedUsers);
                }
            })
            .catch(err => console.error("Error fetching users", err));
      }
  }, [isDemo, userProfile, viewMode, effectiveRole]);

  // --- FETCH REPORTS (When Company Selected) ---
  useEffect(() => {
      if (!selectedCompany) return;

      if (!isDemo) {
          // Clear reports initially or keep them? Better clear to avoid mixing.
          // But for optimistic updates, we want to avoid reset.
          // Since we changed dependency to selectedCompany.id, this only runs on company switch.
          setReports([]); 
          getNEON({ table: 'reports', where: { company_id: selectedCompany.id } })
            .then(res => {
                if (res.rows) {
                    const mappedReports = res.rows.map((r: any) => ({
                        id: r.id,
                        date: r.report_date ? new Date(r.report_date).toLocaleDateString('no-NO') : '',
                        author: r.author_name || 'Ukjent',
                        comment: r.comment,
                        status: r.status,
                        result: r.result_ytd,
                        liquidity: r.liquidity,
                        source: r.source || 'Manuell',
                        approvedBy: r.approved_by_user_id ? 'Kontroller' : undefined, // Simplify for now, ideally fetch user name
                        approvedAt: r.approved_at ? new Date(r.approved_at).toLocaleDateString('no-NO') : undefined
                    }));
                    // Sort by date desc
                    mappedReports.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
                    setReports(mappedReports);
                }
            })
            .catch(err => console.error("Error fetching reports", err));
      } else {
          // Mock reports for demo
          // Only set if switching companies (based on dep array)
          setReports([
              { id: 1, date: '15.10.2023', author: 'Anna Hansen', comment: 'Sterk vekst i Q3.', status: 'approved', result: 1240000, liquidity: 540000, source: 'Manuell', approvedBy: 'Demo Controller' },
              { id: 2, date: '15.09.2023', author: 'System', comment: 'Stabil drift.', status: 'approved', result: 1100000, liquidity: 500000, source: 'Tripletex' }
          ]);
      }
  }, [selectedCompany?.id, isDemo]); // Changed dependency from selectedCompany to selectedCompany.id


  // --- COMPANY CRUD HANDLERS ---

  const handleAddCompany = async (newCompany: Omit<CompanyData, 'id'>) => {
    const payload = { ...newCompany, groupId: userProfile.groupId };
    const tempId = Date.now();
    const companyWithTempId = { ...payload, id: tempId } as CompanyData;
    setCompanies(prev => [...prev, companyWithTempId]);
    setViewMode(ViewMode.GRID);

    if (!isDemo) {
        try {
            const dbPayload = {
                name: payload.name,
                manager: payload.manager,
                result_ytd: payload.resultYTD,
                budget_total: payload.budgetTotal,
                liquidity: payload.liquidity,
                liquidity_date: payload.liquidityDate,
                trend_history: payload.trendHistory,
                last_report_date: payload.lastReportDate,
                last_report_by: payload.lastReportBy,
                current_comment: payload.comment,
                group_id: payload.groupId
            };
            const res = await postNEON({ table: 'companies', data: dbPayload });
            if(res && res.rows) reloadCompanies();
        } catch (e) {
            console.error("Failed to add company", e);
            setCompanies(prev => prev.filter(c => c.id !== tempId)); 
            alert("Kunne ikke lagre selskap. Sjekk tilkobling.");
        }
    }
  };

  const handleUpdateCompany = async (updatedCompany: CompanyData) => {
    setCompanies(prev => prev.map(c => c.id === updatedCompany.id ? updatedCompany : c));
    if (!isDemo) {
        try {
            const { id, ...fields } = updatedCompany;
            const dbFields = {
                name: fields.name,
                manager: fields.manager,
                result_ytd: fields.resultYTD,
                budget_total: fields.budgetTotal,
                liquidity: fields.liquidity,
                liquidity_date: fields.liquidityDate,
                trend_history: fields.trendHistory,
                last_report_date: fields.lastReportDate,
                last_report_by: fields.lastReportBy,
                current_comment: fields.comment
            };
            await patchNEON({ table: 'companies', data: { id, fields: dbFields } });
        } catch (e) {
            console.error("Failed to update company", e);
            alert("Kunne ikke oppdatere selskap.");
        }
    }
  };

  const handleDeleteCompany = async (id: number) => {
    const prevCompanies = [...companies];
    setCompanies(prev => prev.filter(c => c.id !== id));
    if (!isDemo) {
        try {
            await deleteNEON({ table: 'companies', data: id });
        } catch (e) {
            console.error("Failed to delete company", e);
            setCompanies(prevCompanies);
            alert("Kunne ikke slette selskap.");
        }
    }
  };

  const reloadCompanies = async () => {
      const res = await getNEON({ table: 'companies', where: { group_id: userProfile.groupId } });
      if(res.rows) {
          setCompanies(res.rows.map((c: any) => ({
            ...c,
            resultYTD: Number(c.result_ytd || 0),
            budgetTotal: Number(c.budget_total || 0),
            liquidity: Number(c.liquidity || 0),
            trendHistory: Number(c.trend_history || 0),
            name: c.name || '',
            manager: c.manager || '',
            liquidityDate: c.liquidity_date || '',
            lastReportDate: c.last_report_date || '',
            lastReportBy: c.last_report_by || '',
            comment: c.current_comment || '',
        })));
      }
  };

  // --- REPORT HANDLERS ---

  const handleSubmitReport = async (reportData: any) => {
      if (!selectedCompany) return;

      // IF REPORT ID EXISTS, IT IS AN UPDATE
      if (reportData.id) {
          // Update state
          setReports(prev => prev.map(r => r.id === reportData.id ? { 
              ...r, 
              result: reportData.resultYTD,
              liquidity: reportData.liquidity,
              comment: reportData.comment,
              source: reportData.source
          } : r));

          if (!isDemo) {
              try {
                  await patchNEON({ table: 'reports', data: {
                      id: reportData.id,
                      fields: {
                          result_ytd: reportData.resultYTD,
                          liquidity: reportData.liquidity,
                          comment: reportData.comment,
                          source: reportData.source
                      }
                  }});
              } catch (e) {
                  console.error("Failed to update report", e);
                  alert("Kunne ikke oppdatere rapport.");
              }
          }
          return;
      }

      // --- CREATE NEW REPORT ---

      const newReportLog: ReportLogItem = {
          id: Date.now(),
          date: new Date().toLocaleDateString('no-NO'),
          author: userProfile.fullName,
          comment: reportData.comment,
          status: 'submitted',
          result: reportData.resultYTD,
          liquidity: reportData.liquidity,
          source: reportData.source
      };

      // Optimistic UI
      setReports(prev => [newReportLog, ...prev]);
      
      // Update Company Snapshot Optimistically
      const updatedCompany = { 
          ...selectedCompany, 
          resultYTD: reportData.resultYTD, 
          liquidity: reportData.liquidity,
          comment: reportData.comment,
          lastReportDate: newReportLog.date,
          lastReportBy: newReportLog.author
      };
      setSelectedCompany(updatedCompany);
      setCompanies(prev => prev.map(c => c.id === selectedCompany.id ? updatedCompany : c));

      if (!isDemo) {
          try {
              // 1. Save Report
              await postNEON({ table: 'reports', data: {
                  company_id: selectedCompany.id,
                  author_name: userProfile.fullName,
                  result_ytd: reportData.resultYTD,
                  liquidity: reportData.liquidity,
                  comment: reportData.comment,
                  source: reportData.source,
                  status: 'submitted'
              }});

              // 2. Update Company Snapshot
              await handleUpdateCompany(updatedCompany);

          } catch (e) {
              console.error("Failed to submit report", e);
              alert("Kunne ikke lagre rapporten.");
          }
      }
  };

  const handleApproveReport = async (reportId: number) => {
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'approved', approvedBy: userProfile.fullName } : r));

      if (!isDemo) {
          try {
              await patchNEON({ table: 'reports', data: { 
                  id: reportId, 
                  fields: { 
                      status: 'approved',
                      approved_at: new Date().toISOString(),
                      // In real app, save approved_by_user_id
                  } 
              }});
          } catch (e) {
              console.error("Failed to approve", e);
          }
      }
  };

  const handleUnlockReport = async (reportId: number) => {
      // Reset to submitted
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'submitted', approvedBy: undefined } : r));

      if (!isDemo) {
          try {
              await patchNEON({ table: 'reports', data: { 
                  id: reportId, 
                  fields: { 
                      status: 'submitted',
                      approved_at: null,
                      approved_by_user_id: null
                  } 
              }});
          } catch (e) {
              console.error("Failed to unlock", e);
          }
      }
  };

  // --- USER HANDLERS (Simplified) ---
  const handleAddUser = async (u: any) => { /* ... */ };
  const handleUpdateUser = async (u: any) => { /* ... */ };
  const handleDeleteUser = async (id: number) => { /* ... */ };


  // --- APP LOGIC ---

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const visibleCompanies = useMemo(() => {
      if (effectiveRole === 'leader') {
          if (isDemo) {
              return companies.filter(c => c.name === 'VPS'); 
          }
          if (userProfile.companyId) {
              return companies.filter(c => c.id === userProfile.companyId);
          }
      }
      return companies;
  }, [companies, effectiveRole, isDemo, userProfile.companyId]);

  const computedData: ComputedCompanyData[] = useMemo(() => {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const diff = now.getTime() - startOfYear.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    const currentMonthIndex = now.getMonth(); 
    
    return visibleCompanies.map(company => {
        let targetBudget = 0;
        if (isTodayMode) {
            targetBudget = (company.budgetTotal / 365) * dayOfYear;
        } else {
            const monthsToCount = Math.max(0, currentMonthIndex);
            targetBudget = (company.budgetTotal / 12) * monthsToCount;
        }
        const deviation = company.resultYTD - targetBudget;
        const deviationPercent = targetBudget !== 0 ? (deviation / targetBudget) * 100 : 0;
        return {
            ...company,
            calculatedBudgetYTD: targetBudget,
            calculatedDeviationPercent: deviationPercent
        };
    });
  }, [isTodayMode, visibleCompanies]);

  const displayedData = useMemo(() => {
    if (viewMode === ViewMode.CONTROL) {
      return computedData.filter(c => c.calculatedDeviationPercent < 0);
    }
    return computedData;
  }, [computedData, viewMode]);

  const sortedData = useMemo(() => {
    const data = [...displayedData];
    switch (sortField) {
      case SortField.RESULT:
        return data.sort((a, b) => b.resultYTD - a.resultYTD);
      case SortField.DEVIATION:
        return data.sort((a, b) => a.calculatedDeviationPercent - b.calculatedDeviationPercent);
      case SortField.LIQUIDITY:
        return data.sort((a, b) => b.liquidity - a.liquidity);
      default:
        return data.sort((a, b) => a.id - b.id);
    }
  }, [displayedData, sortField]);

  const totalResult = computedData.reduce((acc, curr) => acc + curr.resultYTD, 0);
  const totalBudgetYTD = computedData.reduce((acc, curr) => acc + curr.calculatedBudgetYTD, 0);
  const totalAnnualBudget = computedData.reduce((acc, curr) => acc + curr.budgetTotal, 0);
  const totalLiquidity = computedData.reduce((acc, curr) => acc + curr.liquidity, 0);
  
  const currentDateDisplay = new Date().toLocaleDateString('no-NO', { day: 'numeric', month: 'long' });
  const lastMonthDisplay = new Date(new Date().getFullYear(), new Date().getMonth(), 0).toLocaleDateString('no-NO', { day: 'numeric', month: 'long' });

  const toggleMode = () => {
      const newMode = isDemo ? 'live' : 'demo';
      localStorage.setItem('konsern_mode', newMode);
      window.location.reload();
  };

  if (selectedCompany) {
    return (
      <CompanyDetailView 
        company={selectedCompany} 
        reports={reports}
        userRole={effectiveRole}
        onBack={() => setSelectedCompany(null)} 
        onReportSubmit={handleSubmitReport}
        onApproveReport={handleApproveReport}
        onUnlockReport={handleUnlockReport}
      />
    );
  }

  const isAdminMode = viewMode === ViewMode.ADMIN || viewMode === ViewMode.USER_ADMIN;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-32 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <header className="bg-white/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20 shadow-sm backdrop-blur-md transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
               <div className="bg-slate-900 dark:bg-slate-700 text-white p-2 rounded-lg shadow-md">
                  <Building2 size={20} />
               </div>
               <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight hidden sm:block">{userProfile.groupName || 'Konsernoversikt'}</h1>
            </div>

            {isAdminMode && (
                <div className="flex items-center bg-slate-100 dark:bg-slate-700/50 p-1 rounded-full border border-slate-200 dark:border-slate-600 absolute left-1/2 transform -translate-x-1/2">
                    <button 
                        onClick={() => setViewMode(ViewMode.ADMIN)}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${viewMode === ViewMode.ADMIN ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        <Building2 size={12} /> Selskaper
                    </button>
                    <button 
                        onClick={() => setViewMode(ViewMode.USER_ADMIN)}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ${viewMode === ViewMode.USER_ADMIN ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                        <Users size={12} /> Brukere
                    </button>
                </div>
            )}
            
            <div className="flex items-center space-x-4 md:space-x-6">
              
              {isDemo && (
                  <div className="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                      <button 
                        onClick={() => setDemoRole('controller')}
                        className={`px-2 py-1 text-[10px] uppercase font-bold rounded-md transition-all ${demoRole === 'controller' ? 'bg-white dark:bg-slate-600 text-sky-600 dark:text-sky-300 shadow-sm' : 'text-slate-400'}`}
                      >
                        Controller
                      </button>
                      <button 
                        onClick={() => { setDemoRole('leader'); setViewMode(ViewMode.GRID); }}
                        className={`px-2 py-1 text-[10px] uppercase font-bold rounded-md transition-all ${demoRole === 'leader' ? 'bg-white dark:bg-slate-600 text-emerald-600 dark:text-emerald-300 shadow-sm' : 'text-slate-400'}`}
                      >
                        Leder
                      </button>
                  </div>
              )}

              <button 
                onClick={toggleMode}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                    isDemo 
                    ? 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200' 
                    : 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200'
                }`}
                title={isDemo ? "Klikk for å koble til Database" : "Klikk for å se demo-data"}
              >
                {isDemo ? <MonitorPlay size={14}/> : <Database size={14}/>}
                <span>{isDemo ? 'DEMO' : 'LIVE'}</span>
              </button>

              <div className="hidden md:flex items-center text-slate-500 dark:text-slate-400 text-sm font-medium bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
                <UserCircle className="w-4 h-4 mr-2 text-slate-400 dark:text-slate-500" />
                <span className="hidden lg:inline">Velkommen: </span>{userProfile.fullName || 'Bruker'}
              </div>
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">{isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button>
              
              {effectiveRole === 'controller' && (
                <button 
                    onClick={() => setViewMode(isAdminMode ? ViewMode.GRID : ViewMode.ADMIN)} 
                    className={`p-2 rounded-full transition-colors ${isAdminMode ? 'bg-sky-100 text-sky-600 dark:bg-sky-900/50 dark:text-sky-400' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`} 
                    title="Admin / Innstillinger"
                >
                    <Settings className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {viewMode === ViewMode.ADMIN && effectiveRole === 'controller' && (
           <AdminView companies={companies} onAdd={handleAddCompany} onUpdate={handleUpdateCompany} onDelete={handleDeleteCompany} />
        )}

        {viewMode === ViewMode.USER_ADMIN && effectiveRole === 'controller' && (
            <UserAdminView 
                users={users} 
                companies={companies} 
                onAdd={handleAddUser} 
                onUpdate={handleUpdateUser} 
                onDelete={handleDeleteUser} 
            />
        )}

        {!isAdminMode && (
            <>
                <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                    
                    <div className="flex items-center space-x-1 bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm w-full md:w-auto overflow-x-auto transition-colors duration-300">
                        <span className="text-xs font-bold text-slate-400 dark:text-slate-500 px-3 uppercase tracking-wider whitespace-nowrap flex items-center gap-1">Sortering</span>
                        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
                        <button onClick={() => setSortField(SortField.RESULT)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${sortField === SortField.RESULT ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>Resultat</button>
                        <button onClick={() => setSortField(SortField.DEVIATION)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${sortField === SortField.DEVIATION ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>Avvik %</button>
                        <button onClick={() => setSortField(SortField.LIQUIDITY)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${sortField === SortField.LIQUIDITY ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}>Likviditet</button>
                        {sortField !== SortField.DEFAULT && (<button onClick={() => setSortField(SortField.DEFAULT)} className="px-2 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400"><ArrowUpDown size={14} /></button>)}
                        
                        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>

                        <button 
                            onClick={() => setIsTodayMode(false)} 
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${!isTodayMode ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                        >
                            Siste mnd <span className="hidden xl:inline text-[10px] font-normal text-slate-400 dark:text-slate-500 ml-1">({lastMonthDisplay})</span>
                        </button>
                        <button 
                            onClick={() => setIsTodayMode(true)} 
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${isTodayMode ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                        >
                            I dag <span className="hidden xl:inline text-[10px] font-normal text-slate-400 dark:text-slate-500 ml-1">({currentDateDisplay})</span>
                        </button>
                    </div>

                    <div className="flex bg-slate-200/60 dark:bg-slate-800 p-1 rounded-lg self-end md:self-auto transition-colors duration-300">
                        <button onClick={() => setViewMode(ViewMode.GRID)} className={`flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === ViewMode.GRID ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}><LayoutGrid className="w-3.5 h-3.5 mr-1.5" />Kort</button>
                        <button onClick={() => setViewMode(ViewMode.ANALYTICS)} className={`flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === ViewMode.ANALYTICS ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}><BarChart3 className="w-3.5 h-3.5 mr-1.5" />Analyse</button>
                        <button onClick={() => setViewMode(ViewMode.CONTROL)} className={`flex items-center px-3 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === ViewMode.CONTROL ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}><ShieldAlert className="w-3.5 h-3.5 mr-1.5" />Kontroll</button>
                    </div>
                </div>

                <div className="flex items-center justify-center mb-6 text-xs text-slate-400 dark:text-slate-500 gap-2"><CalendarClock className="w-3.5 h-3.5" /><span>Viser tall beregnet mot: <strong className="text-slate-600 dark:text-slate-300">{isTodayMode ? 'Daglig akkumulert budsjett' : 'Budsjett pr. forrige månedsslutt'}</strong></span></div>

                {viewMode === ViewMode.ANALYTICS ? (
                    <AnalyticsView data={sortedData} />
                ) : (
                    <>
                        {viewMode === ViewMode.CONTROL && displayedData.length === 0 && (
                            <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                                <div className="bg-emerald-100 dark:bg-emerald-900/30 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"><ShieldAlert className="text-emerald-600 dark:text-emerald-400" size={24} /></div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Ingen selskaper krever kontroll</h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Alle selskaper ligger likt med eller over budsjett.</p>
                            </div>
                        )}
                        <AnimatedGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
                            {sortedData.map((company) => (<MetricCard key={company.id} data={company} onSelect={setSelectedCompany} />))}
                        </AnimatedGrid>
                    </>
                )}
            </>
        )}
      </main>
      {viewMode !== ViewMode.ADMIN && viewMode !== ViewMode.USER_ADMIN && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur border-t border-slate-200 dark:border-slate-700 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] z-20 transition-colors duration-300">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center md:text-left">
                <div className="flex flex-col md:border-r border-slate-100 dark:border-slate-700 px-2 relative group cursor-default"><span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1">Resultat YTD</span><span className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalResult)}</span></div>
                <div className="flex flex-col md:border-r border-slate-100 dark:border-slate-700 px-2 relative group cursor-default"><span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1">Budsjett YTD</span><div className="flex items-baseline gap-2 md:block"><span className="text-xl font-bold text-slate-500 dark:text-slate-400">{formatCurrency(totalBudgetYTD)}</span></div></div>
                <div className="flex flex-col md:border-r border-slate-100 dark:border-slate-700 px-2 relative group cursor-default"><span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1">Årsbudsjett Total</span><span className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalAnnualBudget)}</span></div>
                <div className="flex flex-col px-2 relative group cursor-default"><span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-bold mb-1">Total Likviditet</span><span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalLiquidity)}</span></div>
            </div>
            </div>
        </div>
      )}
    </div>
  );
}

export default App;
