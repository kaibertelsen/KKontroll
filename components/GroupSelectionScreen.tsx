import React from 'react';
import { Building2, Settings, LogOut } from 'lucide-react';

interface GroupOption {
  id: number;
  name: string;
  logoUrl?: string | null;
  logo_url?: string | null;
}

interface GroupSelectionScreenProps {
  groups: GroupOption[];
  isSuperAdmin: boolean;
  userName: string;
  onSelectGroup: (groupId: number, groupName: string, logoUrl?: string) => void;
  onAdminView: () => void;
  onLogout: () => void;
}

const GroupSelectionScreen: React.FC<GroupSelectionScreenProps> = ({
  groups,
  isSuperAdmin,
  userName,
  onSelectGroup,
  onAdminView,
  onLogout
}) => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 font-sans p-6 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20 pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-sky-900 blur-[100px]"></div>
        <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] rounded-full bg-slate-800 blur-[100px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-3xl flex flex-col items-center animate-in fade-in zoom-in-95 duration-500">
        <div className="mb-8 text-center">
          <img
            src="https://ucarecdn.com/b3e83749-8c8a-4382-b28b-fe1d988eff42/Attentioshlogo.png"
            alt="Logo"
            className="h-14 w-auto mx-auto mb-6 drop-shadow-sm"
          />
          <p className="text-slate-400 text-sm">Innlogget som <span className="text-slate-300 font-medium">{userName}</span></p>
          <h1 className="text-white text-2xl font-bold mt-1">Velg konsern</h1>
        </div>

        <div className={`grid gap-4 w-full mb-8 ${groups.length === 1 ? 'grid-cols-1 max-w-xs' : groups.length === 2 ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
          {groups.map(group => {
            const logo = group.logoUrl || group.logo_url;
            return (
              <button
                key={group.id}
                onClick={() => onSelectGroup(group.id, group.name, logo || undefined)}
                className="bg-white/5 border border-white/10 rounded-xl p-6 text-left hover:bg-white/10 hover:border-sky-500/40 transition-all group"
              >
                {logo ? (
                  <img src={logo} alt={group.name} className="h-10 w-auto object-contain mb-4" />
                ) : (
                  <div className="h-10 w-10 bg-sky-600/30 border border-sky-500/30 rounded-lg flex items-center justify-center mb-4">
                    <Building2 className="text-sky-400" size={20} />
                  </div>
                )}
                <h3 className="text-white font-semibold text-lg group-hover:text-sky-300 transition-colors">{group.name}</h3>
              </button>
            );
          })}
        </div>

        {isSuperAdmin && (
          <button
            onClick={onAdminView}
            className="flex items-center gap-2 text-sky-400 hover:text-sky-300 font-medium transition-colors mb-6 px-4 py-2 rounded-lg hover:bg-sky-500/10"
          >
            <Settings size={16} />
            Gå til AdminView
          </button>
        )}

        <button
          onClick={onLogout}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-400 text-sm transition-colors"
        >
          <LogOut size={14} />
          Logg ut
        </button>
      </div>

      <div className="absolute bottom-4 text-slate-700 text-[10px] uppercase tracking-wider font-semibold z-10">
        Attentio FinanceHub
      </div>
    </div>
  );
};

export default GroupSelectionScreen;
