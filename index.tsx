
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { getNEON } from './utils/neon';
import { INITIAL_DATA } from './constants';

// Define global interface for window
declare global {
  interface Window {
    initKonsernKontroll: (userId?: string | number, demoMode?: boolean) => Promise<void>;
    $memberstackDom?: any;
  }
}

// Fallback user ID for testing "Live" mode without Memberstack
const TEST_USER_ID = "mem_sb_cmi4ny448009m0sr4ew3hdge1";

// The initialization function to be called from Webflow/External Auth
window.initKonsernKontroll = async (userId?: string | number, demoMode?: boolean) => {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error("Could not find root element to mount to");
    return;
  }

  const root = ReactDOM.createRoot(rootElement);
  
  // 1. Check LocalStorage Preference first
  const storedMode = localStorage.getItem('konsern_mode');
  
  // Logic: If arg provided, use it. Else if stored exists, use it. Else default to Demo (true).
  // 'live' stored means isDemo = false.
  let isDemo = true;
  
  if (demoMode !== undefined) {
      isDemo = demoMode;
  } else if (storedMode === 'live') {
      isDemo = false;
  } else {
      isDemo = true; // Default
  }

  // Render a loading state initially
  root.render(
    <div className="flex h-screen items-center justify-center text-slate-500 font-sans bg-slate-50 dark:bg-slate-900 dark:text-slate-400">
      {isDemo ? 'Starter Demo-modus...' : 'Kobler til database...'}
    </div>
  );

  // --- DEMO MODE ---
  if (isDemo) {
    console.log("Running in DEMO MODE with mock data.");
    
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
    }, 500);
    return;
  }

  // --- REAL MODE (NEON API) ---
  
  // Use provided ID or fallback to test ID if we are forcing "Live" mode in dev
  const effectiveUserId = userId || TEST_USER_ID;

  if (!effectiveUserId) {
      root.render(<div className="p-10 text-center text-rose-600 font-sans">Ingen bruker-ID funnet. Logg inn på nytt.</div>);
      return;
  }

  try {
    // 1. Determine Lookup Strategy (Neon ID vs Auth ID)
    // If effectiveUserId is numeric (or numeric string), treat as Neon DB ID. Otherwise treat as Auth ID.
    let userWhere = {};
    if (/^\d+$/.test(String(effectiveUserId))) {
        console.log("Looking up user by Neon ID:", effectiveUserId);
        userWhere = { id: effectiveUserId };
    } else {
        console.log("Looking up user by Auth ID:", effectiveUserId);
        userWhere = { auth_id: effectiveUserId };
    }

    // 2. Fetch User
    const userRes = await getNEON({ table: 'users', where: userWhere });
    const user = userRes.rows[0];

    if (!user) {
        // If user not found, maybe DB is empty or ID is wrong?
        root.render(
            <div className="p-10 text-center font-sans dark:text-white">
                <h3 className="text-xl font-bold text-rose-600 mb-2">Bruker ikke funnet</h3>
                <p>Fant ingen bruker med ID: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{String(effectiveUserId)}</code></p>
                <p className="mt-4 text-sm text-slate-500">Sjekk at brukeren er registrert i 'users'-tabellen og at ID-koblingen mot Memberstack (neonid) er korrekt.</p>
                <button 
                    onClick={() => { localStorage.setItem('konsern_mode', 'demo'); window.location.reload(); }}
                    className="mt-6 px-4 py-2 bg-sky-600 text-white rounded-lg"
                >
                    Gå tilbake til Demo
                </button>
            </div>
        );
        return;
    }

    // 3. Fetch Group Name
    let groupName = "Mitt Konsern";
    if (user.group_id) {
        const groupRes = await getNEON({ table: 'groups', where: { id: user.group_id } });
        if(groupRes.rows[0]) groupName = groupRes.rows[0].name;
    }

    // 4. Fetch Companies
    let companyWhere: any = {};
    if (user.role === 'leader' && user.company_id) {
        companyWhere = { id: user.company_id };
    } else {
        companyWhere = { group_id: user.group_id };
    }
    
    const compRes = await getNEON({ table: 'companies', where: companyWhere });
    const rawCompanies = compRes.rows || [];

    const mappedCompanies = rawCompanies.map((c: any) => ({
        ...c,
        resultYTD: Number(c.result_ytd || c.resultYTD || 0),
        budgetTotal: Number(c.budget_total || c.budgetTotal || 0),
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
    }));

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
            <p className="text-rose-600 mb-4">Feil ved lasting av data (API).</p>
            <button 
                onClick={() => { localStorage.setItem('konsern_mode', 'demo'); window.location.reload(); }}
                className="px-4 py-2 bg-slate-200 rounded hover:bg-slate-300"
            >
                Start i Demo-modus
            </button>
        </div>
    );
  }
};

// --- AUTO-START LOGIC ---
window.addEventListener('DOMContentLoaded', async () => {
    // Try to get ID from Memberstack if present
    let startId: string | number | undefined = undefined;

    try {
        if (window.$memberstackDom) {
            const member = await window.$memberstackDom.getCurrentMember();
            if (member && member.data) {
                // Check if 'neonid' exists in custom fields (Prioritized)
                const neonId = member.data.customFields && member.data.customFields['neonid'];
                
                if (neonId) {
                    startId = neonId;
                    console.log("Found Neon ID in Memberstack:", startId);
                } else {
                    // Fallback to Auth ID
                    startId = member.data.id;
                    console.log("Found Memberstack Auth ID:", startId);
                }
            }
        }
    } catch (e) {
        // Memberstack not loaded or error, ignore and fall back
        console.log("Memberstack check skipped or failed", e);
    }

    // Start app (will use startId if found, or fallback logic in initKonsernKontroll)
    window.initKonsernKontroll(startId);
});
