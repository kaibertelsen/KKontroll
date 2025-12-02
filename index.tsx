import React, { useState, useEffect, ErrorInfo, ReactNode, Component } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import LoginScreen from './components/LoginScreen';
import { getNEON } from './utils/neon';
import { INITIAL_DATA } from './constants';
import { MonitorPlay, Loader2, XCircle, RefreshCw, LogOut } from 'lucide-react';

console.log("KonsernKontroll Script Loaded");

// Define global interface for window
declare global {
  interface Window {
    initKonsernKontroll: (userId?: string | number, demoMode?: boolean) => Promise<void>;
    konsernRoot?: ReactDOM.Root; 
    $memberstackDom?: any;
  }
}

// --- ERROR BOUNDARY ---
interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: string;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: '' };

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error: error.toString() };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-rose-50 text-rose-900 p-8 font-sans">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold mb-4">Noe gikk galt</h1>
            <p className="mb-4 text-sm">Applikasjonen krasjet under visning.</p>
            <pre className="bg-rose-100 p-4 rounded text-xs text-left overflow-auto mb-4 border border-rose-200">
              {this.state.error}
            </pre>
            <button onClick={() => window.location.reload()} className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-2 rounded-lg font-bold transition-colors shadow-md">
                Last inn siden på nytt
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- LOADING LOGGER COMPONENT ---
interface LogEntry {
    time: string;
    message: string;
    type: 'info' | 'success' | 'error';
}

interface ActionButton {
    label: string;
    onClick: () => void;
    icon?: React.ElementType;
    variant?: 'primary' | 'secondary' | 'danger';
}

interface LoadingLoggerProps {
    logs: LogEntry[];
    actions?: ActionButton[];
}

const LoadingLogger = ({ logs, actions }: LoadingLoggerProps) => {
    const hasError = logs.some(l => l.type === 'error');
    const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;

    // ERROR STATE
    if (hasError) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 font-sans p-4">
                <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-rose-200 dark:border-rose-900/50 p-8 flex flex-col items-center text-center animate-in zoom-in-95 duration-300">
                    <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mb-6 shadow-inner">
                        <XCircle className="text-rose-600 dark:text-rose-400 w-8 h-8" />
                    </div>
                    
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Noe gikk galt</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                        Vi støtte på et problem under oppstarten.
                    </p>

                    <div className="text-left w-full bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/30 rounded-lg p-4 mb-6 max-h-48 overflow-y-auto shadow-sm">
                        {logs.filter(l => l.type === 'error').map((l, i) => (
                            <div key={i} className="flex gap-2 text-xs text-rose-700 dark:text-rose-300 mb-1 last:mb-0 font-mono">
                                <span className="opacity-50 select-none">•</span>
                                <span>{l.message}</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col gap-3 w-full">
                        {actions?.map((action, idx) => (
                             <button 
                                key={idx}
                                onClick={action.onClick}
                                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold shadow-sm transition-all text-sm w-full
                                    ${action.variant === 'danger' 
                                        ? 'bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 dark:bg-rose-950 dark:border-rose-900 dark:text-rose-300' 
                                        : action.variant === 'secondary'
                                            ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-white'
                                            : 'bg-sky-600 text-white hover:bg-sky-500 shadow-sky-200 dark:shadow-none'
                                    }
                                `}
                            >
                                {action.icon && <action.icon size={16} />}
                                {action.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // LOADING STATE (Smooth)
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 font-sans">
             <div className="relative flex flex-col items-center animate-in fade-in duration-1000">
                 {/* Logo Area */}
                 <div className="mb-12 relative">
                     <div className="absolute inset-0 bg-sky-400 blur-2xl opacity-20 rounded-full animate-pulse"></div>
                     <img 
                        src="https://ucarecdn.com/b3e83749-8c8a-4382-b28b-fe1d988eff42/Attentioshlogo.png" 
                        alt="Logo" 
                        className="h-16 w-auto relative z-10 drop-shadow-sm"
                     />
                 </div>
                 
                 {/* Loader */}
                 <div className="relative w-12 h-12 mb-8">
                     <div className="absolute inset-0 border-4 border-slate-200 dark:border-slate-800 rounded-full"></div>
                     <div className="absolute inset-0 border-4 border-sky-500 rounded-full border-t-transparent animate-spin"></div>
                 </div>
                 
                 {/* Status Text */}
                 <div className="h-6 flex items-center justify-center">
                    <p className="text-xs font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500 animate-pulse">
                        {lastLog ? lastLog.message : 'Initialiserer...'}
                    </p>
                 </div>
             </div>
        </div>
    );
};

// The initialization function
window.initKonsernKontroll = async (userId?: string | number, demoMode?: boolean) => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error("Could not find root element to mount to");
    return;
  }

  let root = window.konsernRoot;
  if (!root) {
      root = ReactDOM.createRoot(rootElement);
      window.konsernRoot = root;
  }

  // --- LOGGING MECHANISM ---
  const logs: LogEntry[] = [];
  
  const renderLog = (actions?: ActionButton[]) => {
       root.render(
        <React.StrictMode>
            <LoadingLogger logs={[...logs]} actions={actions} />
        </React.StrictMode>
      );
  };

  const addLog = (msg: string, type: LogEntry['type'] = 'info') => {
      console.log(`[System] ${msg}`);
      logs.push({
          time: new Date().toLocaleTimeString('no-NO', { hour12: false, hour: '2-digit', minute: '2-digit', second:'2-digit' }),
          message: msg,
          type
      });
      renderLog();
  };

  addLog("Startet opp...");

  // 1. AUTH CHECK
  const localUserId = localStorage.getItem("konsern_user_id");
  const forceDemo = demoMode || localStorage.getItem('konsern_mode') === 'demo';

  if (!forceDemo) {
      if (localUserId) {
          addLog(`Verifiserer sesjon...`, 'info');
      } else {
          addLog("Sjekker innlogging...");
      }
  }

  // 2. DETERMINE MODE
  let shouldStartApp = false;
  let isDemo = false;

  if (forceDemo) {
      shouldStartApp = true;
      isDemo = true;
      addLog("Klargjør demo-miljø...", 'info');
  } else if (localUserId) {
      shouldStartApp = true;
      isDemo = false;
  }
  
  if (!shouldStartApp) {
      addLog("Viser innloggingsskjerm.");
      
      // RENDER LOGIN SCREEN
      root.render(
        <React.StrictMode>
            <LoginScreen 
                onLoginSuccess={() => window.initKonsernKontroll()} 
                onDemoStart={() => window.initKonsernKontroll(undefined, true)}
            />
        </React.StrictMode>
      );
      return;
  }

  // --- DEMO MODE START ---
  if (isDemo) {
    localStorage.setItem('konsern_mode', 'demo'); 
    
    const mockUserProfile = {
        id: 999, 
        fullName: "Demo Controller",
        role: 'controller' as const,
        groupId: 1,
        groupName: "Demo Konsern AS",
        companyIds: [1, 2]
    };

    setTimeout(() => {
        addLog("Demodata lastet. Starter UI.", 'success');
        root.render(
            <React.StrictMode>
                <ErrorBoundary>
                    <App userProfile={mockUserProfile} initialCompanies={INITIAL_DATA} isDemo={true} />
                </ErrorBoundary>
            </React.StrictMode>
        );
    }, 1500); // Slightly longer delay to show off the loader
    return;
  }

  // --- REAL MODE START ---
  const effectiveUserId = userId || localUserId;

  try {
    addLog("Kobler til database...");
    
    const userWhere = { id: effectiveUserId };
    
    // We expect the headers in neon.ts to handle the "door key" (AppID/Key)
    // Here we just fetch the user row to see if they exist and get their profile
    const userRes = await getNEON({ table: 'users', where: userWhere });
    const rawUser = userRes.rows[0];

    if (!rawUser) {
        addLog("Fant ikke bruker.", 'error');
        
        renderLog([
            {
                label: "Logg ut / Prøv igjen",
                icon: LogOut,
                onClick: () => { 
                    localStorage.removeItem("konsern_user_id");
                    window.location.reload(); 
                }
            },
             {
                label: "Start Demo Modus",
                icon: MonitorPlay,
                variant: 'secondary',
                onClick: () => window.initKonsernKontroll(undefined, true)
            }
        ]);
        return;
    }

    addLog(`Henter brukerdata...`, 'success');
    localStorage.setItem('konsern_mode', 'live'); 

    // --- FETCH MULTI-COMPANY ACCESS ---
    addLog("Henter selskaper...");
    let accessList: number[] = [];
    
    try {
        const accessRes = await getNEON({ table: 'usercompanyaccess', where: { userId: rawUser.id } });
        if (accessRes.rows && accessRes.rows.length > 0) {
            accessList = accessRes.rows.map((r: any) => r.companyId || r.company_id);
        } else {
            // Fallback to legacy single company ID
            const legacyId = rawUser.companyId || rawUser.company_id;
            if (legacyId) {
                accessList = [legacyId];
            }
        }
    } catch (e) {
        console.warn("Failed to fetch user access table, falling back to legacy", e);
        const legacyId = rawUser.companyId || rawUser.company_id;
        if(legacyId) accessList = [legacyId];
    }

    // --- FETCH GROUP ---
    let groupName = "Mitt Konsern";
    let logoUrl = undefined;

    const groupId = rawUser.groupId || rawUser.group_id;
    
    if (groupId) {
        const groupRes = await getNEON({ table: 'groups', where: { id: groupId } });
        if(groupRes.rows[0]) {
            groupName = groupRes.rows[0].name;
            logoUrl = groupRes.rows[0].logoUrl || groupRes.rows[0].logo_url;
        }
    }

    // --- FETCH COMPANIES ---
    let companyWhere: any = {};
    const userRole = rawUser.role;

    if (userRole === 'leader' && accessList.length > 0) {
        companyWhere = { group_id: groupId };
    } else {
        companyWhere = { group_id: groupId };
    }
    
    const compRes = await getNEON({ table: 'companies', where: companyWhere });
    const rawCompanies = compRes.rows || [];

    addLog("Klargjør dashboard...");
    
    const mappedCompanies = rawCompanies.map((c: any) => {
        // AGGRESSIVE BUDGET EXTRACTION & PARSING
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
        } catch(e) { console.warn("Budget parse fail", e); }

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
            trendHistory: Number(c.trendHistory || c.trend_history || 0),
            prevLiquidity: Number(c.prevLiquidity || c.prev_liquidity || 0),
            prevDeviation: Number(c.prev_trend || c.prev_trend || 0),
            name: c.name || '',
            fullName: c.fullName || c.full_name || '', 
            manager: c.manager || '',
            sortOrder: Number(c.sortOrder || c.sort_order || 0),
            revenue: Number(c.revenue || 0),
            expenses: Number(c.expenses || 0),
            liquidityDate: c.liquidity_date || c.liquidityDate || '',
            receivablesDate: c.receivables_date || c.receivablesDate || '',
            accountsPayableDate: c.accountsPayable_date || c.accountsPayableDate || '',
            lastReportDate: c.last_report_date || c.lastReportDate || '',
            lastReportBy: c.last_report_by || c.lastReportBy || '',
            comment: c.current_comment || c.currentComment || '',
            pnlDate: c.pnl_date || c.pnlDate || ''
        };
    });

    mappedCompanies.sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));

    const userProfile = {
        id: rawUser.id,
        fullName: rawUser.fullName || rawUser.full_name,
        role: rawUser.role as 'controller' | 'leader',
        groupId: groupId,
        groupName: groupName,
        logoUrl: logoUrl,
        companyIds: accessList // NEW: Pass the list of accessible company IDs
    };

    addLog("Alt klart.", 'success');
    
    setTimeout(() => {
        root.render(
        <React.StrictMode>
            <ErrorBoundary>
                <App userProfile={userProfile} initialCompanies={mappedCompanies} isDemo={false} />
            </ErrorBoundary>
        </React.StrictMode>
        );
    }, 500);

  } catch (e: any) {
    console.error("Init Error:", e);
    let msg = e.message || String(e);
    
    if (msg.includes("Failed to fetch")) {
        msg = "Kan ikke koble til serveren.";
        addLog(`${msg}`, 'error');
        
        // Show retry button
        renderLog([
            {
                label: "Prøv igjen",
                icon: RefreshCw,
                onClick: () => window.initKonsernKontroll()
            },
            {
                label: "Start Demo",
                icon: MonitorPlay,
                variant: 'secondary',
                onClick: () => window.initKonsernKontroll(undefined, true)
            }
        ]);
        return;
    }
    
    addLog(`${msg}`, 'error');
    
    renderLog([
        {
            label: "Prøv igjen",
            icon: RefreshCw,
            onClick: () => window.initKonsernKontroll()
        },
        {
            label: "Logg ut",
            icon: LogOut,
            onClick: () => {
                localStorage.removeItem("konsern_user_id");
                window.location.reload(); 
            }
        },
        {
            label: "Start Demo Modus",
            icon: MonitorPlay,
            variant: 'secondary',
            onClick: () => window.initKonsernKontroll(undefined, true)
        }
    ]);
  }
};

window.addEventListener('DOMContentLoaded', async () => {
    // Start app on load
    setTimeout(() => {
        window.initKonsernKontroll();
    }, 100);
});