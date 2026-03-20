import React, { useState } from 'react';
import { LiquidityPool, CompanyData } from '../types';
import { formatCurrency } from '../constants';
import { Plus, Trash2, ChevronDown, ChevronUp, Banknote } from 'lucide-react';


interface LiquidityPoolViewProps {
  pools: LiquidityPool[];
  companies: CompanyData[];
  onCreatePool: (name: string) => void;
  onDeletePool: (id: number) => void;
  onToggleCompany: (poolId: number, companyId: number) => void;
}

const LiquidityPoolView: React.FC<LiquidityPoolViewProps> = ({
  pools,
  companies,
  onCreatePool,
  onDeletePool,
  onToggleCompany,
}) => {
  const [newPoolName, setNewPoolName] = useState('');
  const [expandedPool, setExpandedPool] = useState<number | null>(null);

  const handleCreate = () => {
    const name = newPoolName.trim();
    if (!name) return;
    onCreatePool(name);
    setNewPoolName('');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
          <Banknote size={20} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Likviditetspooler</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Grupper selskaper med felles likviditetspool for enkel oversikt i footeren.</p>
        </div>
      </div>

      {/* Create new pool */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">Opprett ny pool</p>
        <div className="flex gap-3">
          <input
            type="text"
            value={newPoolName}
            onChange={e => setNewPoolName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            placeholder="Navn på pool..."
            className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow"
          />
          <button
            onClick={handleCreate}
            disabled={!newPoolName.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 text-white rounded-xl font-bold text-sm transition-colors"
          >
            <Plus size={16} /> Opprett
          </button>
        </div>
      </div>

      {/* Pool list */}
      {pools.length === 0 ? (
        <div className="text-center py-16 text-slate-400 dark:text-slate-500">
          <Banknote size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Ingen pools opprettet ennå.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pools.map(pool => {
            const poolCompanies = companies.filter(c => pool.companyIds.includes(c.id));
            const totalLiquidity = poolCompanies.reduce((sum, c) => sum + (c.liquidity || 0), 0);
            const isExpanded = expandedPool === pool.id;

            return (
              <div key={pool.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                {/* Pool header */}
                <div className="flex items-center gap-3 px-5 py-4">
                  <button
                    onClick={() => setExpandedPool(isExpanded ? null : pool.id)}
                    className="flex-1 flex items-center gap-3 text-left"
                  >
                    <div className="p-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                      <Banknote size={14} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 dark:text-white text-sm">{pool.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {poolCompanies.length} selskap{poolCompanies.length !== 1 ? 'er' : ''} &middot; Likviditet: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalLiquidity)}</span>
                      </p>
                    </div>
                    {isExpanded ? <ChevronUp size={16} className="text-slate-400 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 shrink-0" />}
                  </button>
                  <button
                    onClick={() => onDeletePool(pool.id)}
                    className="p-2 text-slate-300 hover:text-rose-500 dark:text-slate-600 dark:hover:text-rose-400 transition-colors rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/10"
                    title="Slett pool"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {/* Company toggles */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-700/60">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500 px-5 py-2.5">Selskaper i pool</p>
                    <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {companies.map(company => {
                        const isActive = pool.companyIds.includes(company.id);
                        return (
                          <label
                            key={company.id}
                            className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                          >
                            <div>
                              <p className={`text-sm font-semibold ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>
                                {company.fullName || company.name}
                              </p>
                              {isActive && (
                                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                  {formatCurrency(company.liquidity || 0)}
                                </p>
                              )}
                            </div>
                            <div className="relative">
                              <input
                                type="checkbox"
                                checked={isActive}
                                onChange={() => onToggleCompany(pool.id, company.id)}
                                className="sr-only"
                              />
                              <div className={`w-10 h-5.5 rounded-full transition-colors duration-200 ${isActive ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-600'}`}
                                   style={{ height: '22px', width: '40px' }}>
                                <div
                                  className="w-4 h-4 bg-white rounded-full shadow-sm absolute transition-all duration-200"
                                  style={{ top: '3px', left: isActive ? '19px' : '3px' }}
                                />
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LiquidityPoolView;
