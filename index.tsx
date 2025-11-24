import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { getNEON } from './utils/neon';
import { INITIAL_DATA } from './constants';
import { Lock, LogIn, MonitorPlay, Loader2 } from 'lucide-react';

// Define global interface for window
declare global {
  interface Window {
    initKonsernKontroll: (userId?: string | number, demoMode?: boolean) => Promise<void>;
    $memberstackDom?: any;
    konsernRoot?: ReactDOM.Root; // Store root globally to reuse
  }
}

// Fallback user ID for testing "Live" mode without Memberstack
const TEST_USER_ID = "mem_sb_cmi4ny448009m0sr4ew3hdge1";
const MEMBERSTACK_APP_ID = "app_cmhvzr10a00bq0ss39szp9ozj";

// --- DYNAMIC SCRIPT LOADER ---
const loadMemberstackScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        // If already loaded, resolve immediately
        if (window.$memberstackDom) {
            return resolve();
        }
        
        // Check if script tag already exists (but maybe not fully loaded yet)
        if (document.querySelector(`script[data-memberstack-app="${MEMBERSTACK_APP_ID}"]`)) {
             // Simple wait loop if script tag exists but object not ready
             const checkInterval = setInterval(() => {
                 if (window.$memberstackDom) {
                     clearInterval(checkInterval);
                     resolve();
                 }
             }, 100);
             // Timeout fallback
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
            // Small delay to ensure window.$memberstackDom is populated
            setTimeout(resolve, 200);
        };
        script.onerror = (e) => {
            console.error("Failed to load Memberstack", e);
            reject(e);
        };

        document.head.appendChild(script);
    });
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
            // Start Demo Mode directly
            window.initKonsernKontroll(undefined, true);
        } else {
            setError(true);
        }
    };

    const handleAttentioLogin = async () => {
        setIsLoadingMs(true);
        try {
            // 1. Load Script dynamically
            await loadMemberstackScript();
            
            // 2. Open Modal
            if (window.$memberstackDom) {
                await window.$memberstackDom.openModal('LOGIN');
            } else {
                // Retry once if not immediately available
                setTimeout(async () => {
                    if(window.$memberstackDom) await window.$memberstackDom.openModal('LOGIN');
                    else alert("Kunne ikke starte innloggingstjenesten. Prøv igjen.");
                }, 500);
            }
        } catch (err) {
            console.error("Login error:", err);
            alert("Feil ved lasting av innlogging. Sjekk nettilgang.");
        } finally {
            setIsLoadingMs(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4 font-sans">
            <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 animate-in zoom-in-95 duration-300">
                
                {/* CARD 1: ATTENTIO BRUKER (LIVE) */}
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
                        {isLoadingMs ? 'Laster...' : 'Logg inn med Attentio'}
                    </button>
                </div>

                {/* CARD 2: DEMO BRUKER */}
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

// The initialization function to be called from Webflow/External Auth
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

  // 1. AUTH CHECK
  // Check if user is logged in via Memberstack (Live Access)
  let memberstackUser = null;
  try {
      if (window.$memberstackDom) {
          const member = await window.$memberstackDom.getCurrentMember();
          if (member?.data) {
              memberstackUser = member.data;
          }
      }
  } catch (e) { console.warn("Memberstack check failed", e); }

  // 2. DETERMINE MODE (Demo vs Live vs Login)
  
  let shouldStartApp = false;
  let isDemo = false;

  if (demoMode === true) {
      // User Explicitly requested Demo (e.g. clicked button in LoginScreen)
      shouldStartApp = true;
      isDemo = true;
  } else if (memberstackUser) {
      // User is logged in -> Start Live
      shouldStartApp = true;
      isDemo = false;
  }
  
  // If neither condition is met, we fall through to LoginScreen.
  if (!shouldStartApp) {
      root.render(<React.StrictMode><LoginScreen /></React.StrictMode>);
      return;
  }

  // Render a loading state
  root.render(
    <div className="flex h-screen items-center justify-center text-slate-500 font-sans bg-slate-50 dark:bg-slate-900 dark:text-slate-400 animate-pulse">
      {isDemo ? 'Starter Demo...' : 'Henter data...'}
    </div>
  );

  // --- DEMO MODE START ---
  if (isDemo) {
    console.log("Running in DEMO MODE");
    localStorage.setItem('konsern_mode', 'demo'); // Track current session mode
    
    const mockUserProfile = {
        fullName: "Demo Controller",
        role: 'controller' as const,
        groupId: 1,
        groupName: "Demo Konsern AS"
    };

    setTimeout(() => {
        root.render(
            <React.StrictMode>
                <App userProfile={mockUserProfile} initialCompanies={INITIAL_DATA} isDemo={true} />
            </React.StrictMode>
        );
    }, 600);
    return;
  }

  // --- REAL MODE START (NEON API) ---
  
  // Determine ID: Memberstack NeonID > Memberstack AuthID > TestID (Dev)
  let effectiveUserId = userId;
  
  if (!effectiveUserId && memberstackUser) {
      if (memberstackUser.customFields && memberstackUser.customFields['neonid']) {
          effectiveUserId = memberstackUser.customFields['neonid'];
          console.log("Using Memberstack Custom Field neonid:", effectiveUserId);
      } else {
          effectiveUserId = memberstackUser.id;
          console.log("Using Memberstack Auth ID:", effectiveUserId);
      }
  }

  // Fallback for local dev if no MS login
  if (!effectiveUserId) effectiveUserId = TEST_USER_ID;

  try {
    let userWhere = {};
    if (/^\d+$/.test(String(effectiveUserId))) {
        userWhere = { id: effectiveUserId };
    } else {
        userWhere = { auth_id: effectiveUserId };
    }

    const userRes = await getNEON({ table: 'users', where: userWhere });
    const user = userRes.rows[0];

    if (!user) {
        root.render(
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
                    <h3 className="text-xl font-bold text-rose-600 mb-2">Bruker ikke funnet</h3>
                    <p className="text-slate-600 mb-4">Vi fant ingen kobling mot din bruker i systemet.</p>
                    <p className="text-xs text-slate-400 mb-6 font-mono bg-slate-100 p-2 rounded">ID: {String(effectiveUserId)}</p>
                    <div className="flex gap-3 justify-center">
                        <button 
                            onClick={() => { if(window.$memberstackDom) window.$memberstackDom.logout(); window.initKonsernKontroll(); }}
                            className="px-4 py-2 border border-slate-300 rounded hover:bg-slate-50"
                        >Logg ut</button>
                        <button 
                            onClick={() => { window.initKonsernKontroll(undefined, true); }}
                            className="px-4 py-2 bg-sky-600 text-white rounded hover:bg-sky-500"
                        >Gå til Demo</button>
                    </div>
                </div>
            </div>
        );
        return;
    }

    localStorage.setItem('konsern_mode', 'live'); // Track current session mode

    // Fetch Group Name
    let groupName = "Mitt Konsern";
    if (user.group_id) {
        const groupRes = await getNEON({ table: 'groups', where: { id: user.group_id } });
        if(groupRes.rows[0]) groupName = groupRes.rows[0].name;
    }

    // Fetch Companies
    let companyWhere: any = {};
    if (user.role === 'leader' && user.company_id) {
        companyWhere = { id: user.company_id };
    } else {
        companyWhere = { group_id: user.group_id };
    }
    
    const compRes = await getNEON({ table: 'companies', where: companyWhere });
    const rawCompanies = compRes.rows || [];

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
            budgetMode: c.budget_mode || 'annual',
            budgetMonths: bMonths,
            liquidity: Number(c.liquidity || 0),
            receivables: Number(c.receivables || 0),
            accountsPayable: Number(c.accounts_payable || 0),
            trendHistory: Number(c.trend_history || c.trendHistory || 0),
            name: c.name || '',
            manager: c.manager || '',
            revenue: Number(c.revenue || 0),
            expenses: Number(c.expenses || 0),
            liquidityDate: c.liquidity_date || c.liquidityDate || '',
            receivablesDate: c.receivables_date || c.receivablesDate || '',
            accountsPayableDate: c.accounts_payable_date || c.accountsPayableDate || '',
            lastReportDate: c.last_report_date || c.lastReportDate || '',
            lastReportBy: c.last_report_by || c.lastReportBy || '',
            comment: c.current_comment || c.comment || '',
        };
    });

    const userProfile = {
        fullName: user.full_name || 'Bruker',
        role: user.role as 'controller' | 'leader',
        groupId: user.group_id,
        groupName: groupName,
        companyId: user.company_id
    };

    root.render(
      <React.StrictMode>
        <App userProfile={userProfile} initialCompanies={mappedCompanies} isDemo={false} />
      </React.StrictMode>
    );

  } catch (e) {
    console.error("Init Error:", e);
    root.render(
        <div className="p-10 text-center font-sans">
            <p className="text-rose-600 mb-4">Feil ved lasting av data.</p>
            <button onClick={() => { window.initKonsernKontroll(); }} className="px-4 py-2 bg-slate-200 rounded hover:bg-slate-300">Prøv igjen</button>
        </div>
    );
  }
};

// --- AUTO-START LOGIC ---
window.addEventListener('DOMContentLoaded', async () => {
    const mode = localStorage.getItem('konsern_mode');
    
    // Only attempt auto-load if we were in LIVE mode previously
    // If we were in Demo, or nothing, we just run init which will show login screen
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