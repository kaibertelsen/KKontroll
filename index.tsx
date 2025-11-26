import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { getNEON } from './utils/neon';
import { INITIAL_DATA } from './constants';
import { Lock, LogIn, MonitorPlay, Loader2, Terminal, CheckCircle2, XCircle, RefreshCw, LogOut } from 'lucide-react';

// Define global interface for window
declare global {
  interface Window {
    initKonsernKontroll: (userId?: string | number, demoMode?: boolean) => Promise<void>;
    $memberstackDom?: any;
    konsernRoot?: ReactDOM.Root; 
  }
}

// --- ERROR BOUNDARY ---
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: string }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error: error.toString() };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-rose-50 text-rose-900 p-8">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold mb-4">Noe gikk galt</h1>
            <p className="mb-4">Applikasjonen krasjet under visning.</p>
            <pre className="bg-rose-100 p-4 rounded text-xs text-left overflow-auto mb-4">
              {this.state.error}
            </pre>
            <button onClick={() => window.location.reload()} className="bg-rose-600 text-white px-4 py-2 rounded font-bold">
                Last inn siden på nytt
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Fallback user ID for testing "Live" mode without Memberstack
const TEST_USER_ID = "mem_sb_cmi4ny448009m0sr4ew3hdge1";
const MEMBERSTACK_APP_ID = "app_cmhvzr10a00bq0ss39szp9ozj";

// --- DYNAMIC SCRIPT LOADER ---
const loadMemberstackScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (window.$memberstackDom) {
            return resolve();
        }
        
        if (document.querySelector(`script[data-memberstack-app="${MEMBERSTACK_APP_ID}"]`)) {
             const checkInterval = setInterval(() => {
                 if (window.$memberstackDom) {
                     clearInterval(checkInterval);
                     resolve();
                 }
             }, 100);
             setTimeout(() => { clearInterval(checkInterval); resolve(); }, 5000);
             return;
        }

        console.log("Loading Memberstack dynamically...");
        const script = document.createElement('script');
        script.src = "https://static.memberstack.com/scripts/v2/memberstack.js";
        script.dataset.memberstackApp = MEMBERSTACK_APP_ID;
        script.type = "text/javascript";
        script.async = true;

        script.onload = () => {
            console.log("Memberstack script loaded.");
            setTimeout(resolve, 200);
        };
        script.onerror = (e) => {
            console.error("Failed to load Memberstack", e);
            reject(e);
        };

        document.head.appendChild(script);
    });
};

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
    
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 font-mono p-4">
            <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-300 flex flex-col max-h-[80vh]">
                <div className="bg-slate-100 dark:bg-slate-900 px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        {hasError ? <XCircle className="text-rose-500" size={18} /> : <Loader2 className="animate-spin text-sky-600" size={18} />}
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                            {hasError ? 'Systemstopp' : 'Systemstart'}
                        </span>
                    </div>
                    <div className="text-[10px] text-slate-400">v1.1.7</div>
                </div>
                
                <div className="p-4 overflow-y-auto bg-slate-50 dark:bg-slate-950/50 scroll-smooth flex-grow font-mono text-xs space-y-2">
                    {logs.map((log, idx) => (
                        <div key={idx} className={`flex gap-3 p-1.5 rounded border ${
                            log.type === 'error' ? 'text-rose-700 bg-rose-50 border-rose-100 dark:bg-rose-900/20 dark:border-rose-900/50 dark:text-rose-300' : 
                            log.type === 'success' ? 'text-emerald-700 bg-emerald-50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/30 dark:text-emerald-400' : 
                            'text-slate-600 border-transparent dark:text-slate-400'
                        }`}>
                            <span className="opacity-40 shrink-0 select-none">[{log.time}]</span>
                            <span className="break-all">{log.message}</span>
                        </div>
                    ))}
                    <div id="log-end" />
                </div>

                {actions && actions.length > 0 && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-slate-700 shrink-0 flex flex-wrap justify-center gap-3">
                        {actions.map((action, idx) => (
                             <button 
                                key={idx}
                                onClick={action.onClick}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold shadow-sm transition-all text-sm
                                    ${action.variant === 'danger' 
                                        ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 border border-rose-200' 
                                        : action.variant === 'secondary'
                                            ? 'bg-slate-200 text-slate-700 hover:bg-slate-300 border border-slate-300'
                                            : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
                                    }
                                `}
                            >
                                {action.icon && <action.icon size={16} />}
                                {action.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
            {!actions && (
                <p className="mt-4 text-xs text-slate-400 max-w-xs text-center animate-pulse">
                    Jobber...
                </p>
            )}
        </div>
    );
};


// --- LOGIN SCREEN COMPONENT ---
const LoginScreen = () => {
    const [pwd, setPwd] = useState('');
    const [error, setError] = useState(false);
    const [isLoadingMs, setIsLoadingMs] = useState(false);

    const handleDemoSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (pwd === 'KonsernDemo2025') {
            localStorage.setItem('konsern_access', 'granted');
            window.initKonsernKontroll(undefined, true);
        } else {
            setError(true);
        }
    };

    const handleAttentioLogin = async () => {
        setIsLoadingMs(true);
        try {
            await loadMemberstackScript();
            
            if (window.$memberstackDom) {
                const loginCheckInterval = setInterval(() => {
                    const token = localStorage.getItem("_ms-mid");
                    if (token) {
                        clearInterval(loginCheckInterval);
                        console.log("Login detected via _ms-mid. Initializing app...");
                        setTimeout(() => window.initKonsernKontroll(), 500);
                    }
                }, 1000); 

                await window.$memberstackDom.openModal('LOGIN');
            } else {
                setTimeout(async () => {
                    if(window.$memberstackDom) {
                         const loginCheckInterval = setInterval(() => {
                            if (localStorage.getItem("_ms-mid")) {
                                clearInterval(loginCheckInterval);
                                window.initKonsernKontroll();
                            }
                        }, 1000);
                        await window.$memberstackDom.openModal('LOGIN');
                    }
                    else alert("Kunne ikke starte innloggingstjenesten. Prøv igjen.");
                }, 500);
            }
        } catch (err) {
            console.error("Login error:", err);
            alert("Feil ved lasting av innlogging. Sjekk nettilgang.");
        } finally {
            if (!localStorage.getItem("_ms-mid")) {
                 setIsLoadingMs(false);
            }
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 font-sans">
            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 animate-in zoom-in-95 duration-300">
                
                <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center text-center h-full justify-center relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-sky-500 to-blue-600"></div>
                    
                    <div className="mb-8">
                        <img 
                            src="https://ucarecdn.com/a57dd98f-5b74-4f56-8480-2ff70d700b09/667bf8f6e052ebdb5596b770_Logo1.png" 
                            alt="Attentio Logo" 
                            className="h-12 object-contain mx-auto"
                        />
                    </div>
                    
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Attentio Bruker</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm">
                        Logg inn med din Attentio-konto for å få tilgang til live data og rapportering.
                    </p>

                    <button 
                        onClick={handleAttentioLogin}
                        disabled={isLoadingMs}
                        className="w-full max-w-xs bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 px-6 rounded-lg transition-all shadow-lg hover:shadow-sky-500/30 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait"
                    >
                        {isLoadingMs ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
                        {isLoadingMs ? 'Venter på innlogging...' : 'Logg inn med Attentio'}
                    </button>
                </div>

                <div className="bg-slate-100 dark:bg-slate-800/50 p-8 rounded-2xl shadow-inner border border-slate-200 dark:border-slate-700 flex flex-col justify-center">
                    <div className="text-center mb-6">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 text-amber-600 mb-4">
                            <MonitorPlay size={24} />
                        </div>
                        <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200">Demo Bruker</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider mt-1">Kun for demonstrasjon</p>
                    </div>

                    <form onSubmit={handleDemoSubmit} className="space-y-4 w-full max-w-xs mx-auto">
                        <div>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                <input 
                                    type="password" 
                                    value={pwd}
                                    onChange={e => {setPwd(e.target.value); setError(false);}}
                                    className="w-full pl-10 p-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none transition-all text-sm"
                                    placeholder="Skriv inn demo-passord..."
                                />
                            </div>
                        </div>
                        {error && <p className="text-rose-600 text-xs font-medium text-center animate-pulse">Feil passord</p>}
                        <button type="submit" className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-lg transition-colors shadow flex justify-center items-center gap-2 text-sm">
                            Start Demo
                        </button>
                    </form>
                </div>

            </div>
            
            <div className="fixed bottom-4 text-center w-full text-slate-400 text-[10px]">
                KonsernKontroll 2025 &copy; Powered by Attentio
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
      setTimeout(() => {
          const el = document.getElementById('log-end');
          if(el) el.scrollIntoView({ behavior: "smooth" });
      }, 50);
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

  addLog("Initialiserer applikasjon...");

  // 1. AUTH CHECK
  let memberstackUser = null;
  const localToken = localStorage.getItem("_ms-mid");
  if (localToken) {
      addLog("Fant lokal sesjonsnøkkel (_ms-mid).", 'info');
  }

  try {
      addLog("Sjekker Memberstack status...");
      if (window.$memberstackDom) {
          const member = await window.$memberstackDom.getCurrentMember();
          if (member?.data) {
              memberstackUser = member.data;
              addLog(`Memberstack bruker funnet: ${memberstackUser.id}`, 'success');
          } else {
              addLog("Ingen aktiv Memberstack sesjon funnet.");
          }
      } else {
          addLog("Memberstack DOM ikke tilgjengelig.");
      }
  } catch (e: any) { 
      addLog(`Feil under Memberstack sjekk: ${e.message}`, 'error');
  }

  // 2. DETERMINE MODE
  let shouldStartApp = false;
  let isDemo = false;

  if (demoMode === true) {
      shouldStartApp = true;
      isDemo = true;
      addLog("Modus satt til: DEMO", 'info');
  } else if (memberstackUser) {
      shouldStartApp = true;
      isDemo = false;
      addLog("Modus satt til: LIVE", 'info');
  }
  
  if (!shouldStartApp) {
      addLog("Ingen gyldig sesjon. Viser innloggingsskjerm.");
      setTimeout(() => {
          root.render(<React.StrictMode><LoginScreen /></React.StrictMode>);
      }, 800);
      return;
  }

  // --- DEMO MODE START ---
  if (isDemo) {
    addLog("Klargjør demodata...");
    localStorage.setItem('konsern_mode', 'demo'); 
    
    const mockUserProfile = {
        fullName: "Demo Controller",
        role: 'controller' as const,
        groupId: 1,
        groupName: "Demo Konsern AS"
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
    }, 1200);
    return;
  }

  // --- REAL MODE START ---
  let effectiveUserId = userId;
  
  if (!effectiveUserId && memberstackUser) {
      if (memberstackUser.customFields && memberstackUser.customFields['neonid']) {
          effectiveUserId = memberstackUser.customFields['neonid'];
          addLog(`Bruker Custom Field 'neonid': ${effectiveUserId}`, 'info');
      } else {
          effectiveUserId = memberstackUser.id;
          addLog(`Bruker standard Auth ID: ${effectiveUserId}`, 'info');
      }
  }

  if (!effectiveUserId) effectiveUserId = TEST_USER_ID;

  try {
    addLog("Kobler til Neon database...");
    
    let userWhere = {};
    const userIdStr = String(effectiveUserId);
    
    if (userIdStr.startsWith('mem_')) {
        userWhere = { authId: userIdStr }; 
        addLog(`Søkemetode: authId (Memberstack ID)`, 'info');
    } else if (/^\d+$/.test(userIdStr)) {
        userWhere = { id: userIdStr };
        addLog(`Søkemetode: id (Intern ID)`, 'info');
    } else {
        userWhere = { authId: userIdStr };
        addLog(`Søkemetode: authId (Generisk)`, 'info');
    }

    addLog(`Kjører databasesøk: ${JSON.stringify(userWhere)}`);
    
    const userRes = await getNEON({ table: 'users', where: userWhere });
    const rawUser = userRes.rows[0];

    if (!rawUser) {
        addLog("FEIL: Bruker ikke funnet i databasen.", 'error');
        addLog(`Søkte etter: ${JSON.stringify(userWhere)}`, 'error');
        addLog("Dette betyr at Memberstack-brukeren ikke er koblet mot en rad i users-tabellen.", 'error');
        
        renderLog([
            {
                label: "Start Demo Modus",
                icon: MonitorPlay,
                variant: 'secondary',
                onClick: () => window.initKonsernKontroll(undefined, true)
            },
            {
                label: "Logg ut og prøv igjen",
                icon: LogOut,
                onClick: () => { 
                    if(window.$memberstackDom) window.$memberstackDom.logout(); 
                    window.initKonsernKontroll(); 
                }
            }
        ]);
        return;
    }

    const user = {
        id: rawUser.id,
        authId: rawUser.authId || rawUser.auth_id,
        fullName: rawUser.fullName || rawUser.full_name || 'Ukjent Bruker',
        role: rawUser.role,
        groupId: rawUser.groupId || rawUser.group_id,
        companyId: rawUser.companyId || rawUser.company_id
    };

    addLog(`Bruker verifisert: ${user.fullName} (${user.role})`, 'success');
    localStorage.setItem('konsern_mode', 'live'); 

    let groupName = "Mitt Konsern";
    addLog(`Henter konserndata (Group ID: ${user.groupId})...`);
    
    if (user.groupId) {
        const groupRes = await getNEON({ table: 'groups', where: { id: user.groupId } });
        if(groupRes.rows[0]) {
            groupName = groupRes.rows[0].name;
            addLog(`Konsern: ${groupName}`, 'success');
        }
    }

    let companyWhere: any = {};
    if (user.role === 'leader' && user.companyId) {
        companyWhere = { id: user.companyId };
        addLog(`Henter selskap for leder (ID: ${user.companyId})...`);
    } else {
        companyWhere = { group_id: user.groupId };
        addLog(`Henter alle selskaper i konsernet...`);
    }
    
    const compRes = await getNEON({ table: 'companies', where: companyWhere });
    const rawCompanies = compRes.rows || [];
    addLog(`Fant ${rawCompanies.length} selskaper.`, 'success');

    addLog("Prosesserer finansielle data...");
    const mappedCompanies = rawCompanies.map((c: any) => {
        let bMonths = [0,0,0,0,0,0,0,0,0,0,0,0];
        try {
            if (Array.isArray(c.budget_months)) bMonths = c.budget_months;
            else if (typeof c.budget_months === 'string') bMonths = JSON.parse(c.budget_months);
        } catch(e) { console.warn("Budget parsing error", e); }

        return {
            ...c,
            resultYTD: Number(c.result_ytd || c.resultYTD || 0),
            budgetTotal: Number(c.budget_total || c.budgetTotal || 0),
            budgetMode: c.budget_mode || c.budgetMode || 'annual',
            budgetMonths: bMonths,
            liquidity: Number(c.liquidity || 0),
            receivables: Number(c.receivables || 0),
            accountsPayable: Number(c.accounts_payable || c.accountsPayable || 0),
            trendHistory: Number(c.trend_history || c.trendHistory || 0),
            prevLiquidity: Number(c.prev_liquidity || c.prevLiquidity || 0),
            prevDeviation: Number(c.prev_trend || c.prevTrend || 0),
            name: c.name || '',
            fullName: c.full_name || c.fullName || '', 
            manager: c.manager || '',
            revenue: Number(c.revenue || 0),
            expenses: Number(c.expenses || 0),
            liquidityDate: c.liquidity_date || c.liquidityDate || '',
            receivablesDate: c.receivables_date || c.receivablesDate || '',
            accountsPayableDate: c.accounts_payable_date || c.accountsPayableDate || '',
            lastReportDate: c.last_report_date || c.lastReportDate || '',
            lastReportBy: c.last_report_by || c.lastReportBy || '',
            comment: c.current_comment || c.currentComment || '',
        };
    });

    const userProfile = {
        fullName: user.fullName,
        role: user.role as 'controller' | 'leader',
        groupId: user.groupId,
        groupName: groupName,
        companyId: user.companyId
    };

    addLog("Alt klart. Starter dashboard.", 'success');
    
    setTimeout(() => {
        root.render(
        <React.StrictMode>
            <ErrorBoundary>
                <App userProfile={userProfile} initialCompanies={mappedCompanies} isDemo={false} />
            </ErrorBoundary>
        </React.StrictMode>
        );
    }, 800);

  } catch (e: any) {
    console.error("Init Error:", e);
    let msg = e.message || String(e);
    
    if (msg.includes("Failed to fetch")) {
        msg = "Kan ikke koble til serveren. Starter Demo-modus automatisk...";
        addLog(`KRITISK FEIL: ${msg}`, 'error');
        setTimeout(() => {
            window.initKonsernKontroll(undefined, true);
        }, 1500);
        return;
    }
    
    addLog(`KRITISK FEIL: ${msg}`, 'error');
    
    renderLog([
        {
            label: "Prøv igjen",
            icon: RefreshCw,
            onClick: () => window.initKonsernKontroll()
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
    const mode = localStorage.getItem('konsern_mode');
    if (mode === 'live') {
        try {
            await loadMemberstackScript();
        } catch (e) {
            console.warn("Background MS load failed", e);
        }
    }
    
    setTimeout(() => {
        window.initKonsernKontroll();
    }, 100);
});