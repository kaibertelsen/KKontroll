import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
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

// Fallback user ID for testing "Live" mode without Memberstack
const TEST_USER_ID = "mem_sb_cmi4ny448009m0sr4ew3hdge1";

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
                    <div className="text-[10px] text-slate-400">v1.3.11</div>
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
  const forceDemo = demoMode || localStorage.getItem('konsern_mode') === 'demo';

  if (!forceDemo) {
      if (localToken) {
          addLog("Fant lokal sesjonsnøkkel (_ms-mid).", 'info');
          
          // WAIT for Memberstack DOM if not ready yet
          if (!window.$memberstackDom) {
              addLog("Venter på at Memberstack skal laste...");
              for (let i = 0; i < 30; i++) { // Wait up to 3 seconds (30 * 100ms)
                  if (window.$memberstackDom) break;
                  await new Promise(resolve => setTimeout(resolve, 100));
              }
          }
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
              addLog("Memberstack DOM ikke klar - men token finnes. Prøver auto-login...");
              // We trust the token if MS dom isn't ready yet, it will verify against API later
              if (localToken) {
                   // Minimal mock user for "Assume logged in" state until verified by DB
                   memberstackUser = { id: "mem_temp", customFields: {} }; 
              }
          }
      } catch (e: any) { 
          addLog(`Feil under Memberstack sjekk: ${e.message}`, 'error');
      }
  }

  // 2. DETERMINE MODE
  let shouldStartApp = false;
  let isDemo = false;

  if (forceDemo) {
      shouldStartApp = true;
      isDemo = true;
      addLog("Modus satt til: DEMO", 'info');
  } else if (localToken || memberstackUser) {
      shouldStartApp = true;
      isDemo = false;
      addLog("Modus satt til: LIVE", 'info');
  }
  
  if (!shouldStartApp) {
      addLog("Ingen gyldig sesjon. Viser innloggingsskjerm.");
      
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
    addLog("Klargjør demodata...");
    localStorage.setItem('konsern_mode', 'demo'); 
    
    const mockUserProfile = {
        id: 999, 
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
  
  // Try to use the Memberstack ID if we have the real object, otherwise rely on the DB lookup via token logic (Neon handles AuthID)
  if (!effectiveUserId && memberstackUser && memberstackUser.id !== "mem_temp") {
      if (memberstackUser.customFields && memberstackUser.customFields['neonid']) {
          effectiveUserId = memberstackUser.customFields['neonid'];
          addLog(`Bruker Custom Field 'neonid': ${effectiveUserId}`, 'info');
      } else {
          effectiveUserId = memberstackUser.id;
          addLog(`Bruker standard Auth ID: ${effectiveUserId}`, 'info');
      }
  }

  // If we still only have the token (mem_temp), we need to rely on the neon.ts to pick up the token from localStorage
  // But for the DB query below, we need an ID. 
  
  if (!effectiveUserId && localToken) {
       // We can try to decode the token but MS tokens are opaque.
       // Rely on the Memberstack script to give us the ID after it loaded.
       if (window.$memberstackDom) {
            try {
                const member = await window.$memberstackDom.getCurrentMember();
                if(member?.data) effectiveUserId = member.data.id;
            } catch(e) {}
       }
  }

  if (!effectiveUserId) {
       // Last resort fallback if we have a token but couldn't get ID -> Maybe invalid session?
       addLog("Fant token, men kunne ikke hente Member ID. Prøver å laste på nytt...", 'error');
       
       renderLog([
            {
                label: "Prøv igjen",
                icon: RefreshCw,
                onClick: () => window.location.reload()
            },
            {
                label: "Logg ut",
                icon: LogOut,
                onClick: () => {
                    localStorage.removeItem("_ms-mid");
                    window.location.reload();
                }
            }
        ]);
      return;
  }

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
                    localStorage.removeItem("_ms-mid");
                    if(window.$memberstackDom) window.$memberstackDom.logout(); 
                    window.location.reload(); 
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
    let logoUrl = undefined;

    addLog(`Henter konserndata (Group ID: ${user.groupId})...`);
    
    if (user.groupId) {
        const groupRes = await getNEON({ table: 'groups', where: { id: user.groupId } });
        if(groupRes.rows[0]) {
            groupName = groupRes.rows[0].name;
            logoUrl = groupRes.rows[0].logoUrl || groupRes.rows[0].logo_url; // Map logo
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
            if (Array.isArray(c.budgetMonths)) bMonths = c.budgetMonths;
            else if (typeof c.budgetMonths === 'string') bMonths = JSON.parse(c.budgetMonths);
            else if (Array.isArray(c.budget_months)) bMonths = c.budget_months;
            else if (typeof c.budget_months === 'string') bMonths = JSON.parse(c.budget_months);
            
            // STRICTLY CAST TO NUMBERS
            bMonths = bMonths.map((m: any) => Number(m) || 0);

        } catch(e) { console.warn("Budget parsing error", e); }

        // Determine Budget Total and Distribution
        const bTotal = Number(c.budgetTotal || c.budget_total || 0);
        const sumMonths = bMonths.reduce((a: number, b: number) => a + b, 0);

        // Fallback: If total budget exists but month distribution is empty/zero, distribute flat
        if (bTotal > 0 && sumMonths === 0) {
                const perMonth = Math.round(bTotal / 12);
                bMonths = Array(12).fill(perMonth);
                // Adjust last month for remainder
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

    const userProfile = {
        id: user.id,
        fullName: user.fullName,
        role: user.role as 'controller' | 'leader',
        groupId: user.groupId,
        groupName: groupName,
        logoUrl: logoUrl, // Pass logo to App
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
        addLog(`KRITISK NETTVERKSFEIL: ${msg}`, 'error');
        addLog("Dette skyldes ofte at serveren er utilgjengelig, CORS-blokkering eller manglende tilgang.", 'error');
        
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
    // Start app on load
    setTimeout(() => {
        window.initKonsernKontroll();
    }, 100);
});