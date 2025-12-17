import React from 'react';
import { 
  LayoutGrid, 
  BarChart3, 
  ArrowUpDown, 
  UserCircle, 
  Moon,
  Sun,
  Settings,
  Database,
  MonitorPlay,
  LogOut,
  ShieldAlert
} from 'lucide-react';
import { ViewMode, UserProfile } from '../../types';

interface HeaderProps {
  userProfile: UserProfile;
  isDemo: boolean;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  demoRole: 'controller' | 'leader';
  setDemoRole: (role: 'controller' | 'leader') => void;
  handleLogout: () => void;
  toggleMode: () => void;
  setIsPasswordModalOpen: (val: boolean) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  effectiveRole: 'controller' | 'leader';
  isAdminMode: boolean;
  onResetView: () => void; // Reset to grid/clear selection
}

const Header: React.FC<HeaderProps> = ({
  userProfile,
  isDemo,
  isDarkMode,
  setIsDarkMode,
  demoRole,
  setDemoRole,
  handleLogout,
  toggleMode,
  setIsPasswordModalOpen,
  viewMode,
  setViewMode,
  effectiveRole,
  isAdminMode,
  onResetView
}) => {
  return (
    <header className="bg-white/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20 shadow-sm backdrop-blur-md transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          <button 
              onClick={onResetView}
              className="flex items-center gap-3 group focus:outline-none"
          >
             <div className="bg-white/10 p-1.5 rounded-lg">
                <img src="https://ucarecdn.com/4eb31f4f-55eb-4331-bfe6-f98fbdf6f01b/meetingicon.png" alt="Attentio" className="h-8 w-8 rounded-lg shadow-sm" />
             </div>
             <div className="hidden sm:block text-left">
                <h1 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight leading-tight">{userProfile.groupName || 'Konsernoversikt'}</h1>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Powered by Attentio</p>
             </div>
          </button>

          <div className="flex items-center space-x-4 md:space-x-6">
            {isDemo && (
                <div className="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                    <button onClick={() => setDemoRole('controller')} className={`px-2 py-1 text-[10px] uppercase font-bold rounded-md transition-all ${demoRole === 'controller' ? 'bg-white dark:bg-slate-600 text-sky-600 dark:text-sky-300 shadow-sm' : 'text-slate-400'}`}>Controller</button>
                    <button onClick={() => { setDemoRole('leader'); setViewMode(ViewMode.GRID); }} className={`px-2 py-1 text-[10px] uppercase font-bold rounded-md transition-all ${demoRole === 'leader' ? 'bg-white dark:bg-slate-600 text-emerald-600 dark:text-emerald-300 shadow-sm' : 'text-slate-400'}`}>Leder</button>
                </div>
            )}

            <button onClick={toggleMode} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${isDemo ? 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200'}`} title={isDemo ? "Klikk for å koble til Database" : "Klikk for å se demo-data"}>{isDemo ? <MonitorPlay size={14}/> : <Database size={14}/>}<span>{isDemo ? 'DEMO' : 'LIVE'}</span></button>

            <button 
              onClick={() => setIsPasswordModalOpen(true)}
              className="hidden md:flex items-center text-slate-500 dark:text-slate-400 text-sm font-medium bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              title="Endre passord"
            >
                <UserCircle className="w-4 h-4 mr-2 text-slate-400 dark:text-slate-500" />
                <span className="hidden lg:inline">{userProfile.fullName || 'Bruker'}</span>
            </button>
            
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">{isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button>
            <button onClick={handleLogout} className="p-2 rounded-full text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors" title="Logg ut"><LogOut className="w-5 h-5" /></button>

            {effectiveRole === 'controller' && (
              <button onClick={() => setViewMode(isAdminMode ? ViewMode.GRID : ViewMode.ADMIN)} className={`p-2 rounded-full transition-colors ${isAdminMode ? 'bg-sky-100 text-sky-600 dark:bg-sky-900/50 dark:text-sky-400' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`} title="Admin / Innstillinger"><Settings className="w-5 h-5" /></button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;