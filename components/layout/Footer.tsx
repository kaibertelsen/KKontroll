import React from 'react';
import { formatCurrency } from '../../constants';
import { VisibleFields } from './DashboardGrid';
import { LiquidityPool, CompanyData } from '../../types';
import { Banknote } from 'lucide-react';

interface FooterProps {
  totalRevenue: number;
  totalExpenses: number;
  totalResult: number;
  totalBudgetYTD: number;
  totalLiquidity: number;
  totalReceivables: number;
  totalPayables: number;
  totalShortTermDebt: number;
  totalPublicFees: number;
  totalSalaryExpenses: number;
  totalWorkingCapital: number;
  totalLoyaltyBonusYTD: number;
  showShortTermDebt: boolean;
  showLoyaltyBonus: boolean;
  visibleFields: VisibleFields;
  isAdminMode: boolean;
  liquidityPools: LiquidityPool[];
  companies: CompanyData[];
}

const Chip = ({
  label,
  value,
  bgClass,
  textClass,
  labelClass,
}: {
  label: string;
  value: number;
  bgClass: string;
  textClass?: string;
  labelClass?: string;
}) => {
  const isNeg = value < 0;
  return (
    <div className={`flex flex-col justify-center px-2.5 py-1 rounded-xl border border-opacity-60 shadow-sm min-w-[80px] backdrop-blur-sm ${bgClass}`}>
      <span className={`text-[8px] uppercase font-bold tracking-wider mb-0.5 truncate ${labelClass || textClass || 'text-slate-500 dark:text-slate-400'}`}>{label}</span>
      <span className={`text-xs font-bold tabular-nums leading-tight ${isNeg ? 'text-rose-600 dark:text-rose-400' : (textClass ? textClass : 'text-slate-900 dark:text-white')}`}>
        {formatCurrency(value)}
      </span>
    </div>
  );
};

const Divider = () => (
  <div className="w-px h-7 bg-slate-200 dark:bg-slate-700 mx-0.5 shrink-0" />
);

const Footer: React.FC<FooterProps> = ({
  totalRevenue,
  totalExpenses,
  totalResult,
  totalBudgetYTD,
  totalLiquidity,
  totalReceivables,
  totalPayables,
  totalShortTermDebt,
  totalPublicFees,
  totalSalaryExpenses,
  totalWorkingCapital,
  totalLoyaltyBonusYTD,
  showShortTermDebt,
  showLoyaltyBonus,
  visibleFields,
  isAdminMode,
  liquidityPools,
  companies,
}) => {
  if (isAdminMode) return null;

  const hasPnL = visibleFields.omsetning || visibleFields.kostnader || visibleFields.resultat || visibleFields.budsjett;
  const hasBalance = visibleFields.likviditet || visibleFields.fordringer || visibleFields.leverandorgjeld || visibleFields.kortsiktigGjeld || visibleFields.offAvgifter || visibleFields.lonnskostnad || visibleFields.nettoArbeidskapital;

  const poolsWithData = liquidityPools.map(pool => {
    const total = pool.companyIds.reduce((sum, cid) => {
      const c = companies.find(x => x.id === cid);
      return sum + (c?.liquidity || 0);
    }, 0);
    return { ...pool, totalLiquidity: total };
  });

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur border-t border-slate-200 dark:border-slate-700 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] z-20 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-1 space-y-1.5">

        {/* Row 1: P&L */}
        {hasPnL && (
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 items-center min-w-0">
              <span className="text-[8px] uppercase font-bold tracking-widest text-slate-300 dark:text-slate-600 shrink-0 w-12">Drift</span>
              {visibleFields.omsetning && <Chip label="Omsetning" value={totalRevenue} bgClass="bg-blue-50/60 border-blue-100/60 dark:bg-blue-900/10 dark:border-blue-800/50" textClass="text-blue-600 dark:text-blue-400" />}
              {visibleFields.kostnader && <Chip label="Kostnader" value={totalExpenses} bgClass="bg-slate-50/60 border-slate-100/60 dark:bg-slate-800/30 dark:border-slate-700/50" />}
              {showLoyaltyBonus && totalLoyaltyBonusYTD > 0 && <Chip label="Loj.Bonus" value={totalLoyaltyBonusYTD} bgClass="bg-amber-50/60 border-amber-100/60 dark:bg-amber-900/10 dark:border-amber-800/50" textClass="text-amber-600 dark:text-amber-400" />}
              {visibleFields.resultat && <Chip label="Resultat" value={totalResult - (showLoyaltyBonus ? totalLoyaltyBonusYTD : 0)} bgClass="bg-indigo-50/60 border-indigo-100/60 dark:bg-indigo-900/10 dark:border-indigo-800/50" textClass="text-indigo-600 dark:text-indigo-400" />}
              {visibleFields.budsjett && <Chip label="Budsjett" value={totalBudgetYTD} bgClass="bg-violet-50/60 border-violet-100/60 dark:bg-violet-900/10 dark:border-violet-800/50" textClass="text-violet-600 dark:text-violet-400" />}
            </div>
          </div>
        )}

        {/* Row 2: Balance + Pools */}
        {hasBalance && (
          <div className="overflow-x-auto scrollbar-hide">
            <div className="flex gap-2 items-center min-w-0">
              <span className="text-[8px] uppercase font-bold tracking-widest text-slate-300 dark:text-slate-600 shrink-0 w-12">Balanse</span>
              {visibleFields.likviditet && (
                <>
                  <Chip label="Likviditet" value={totalLiquidity} bgClass="bg-emerald-50/60 border-emerald-100/60 dark:bg-emerald-900/10 dark:border-emerald-800/50" textClass="text-emerald-600 dark:text-emerald-400" />
                  {poolsWithData.length > 0 && <Divider />}
                  {poolsWithData.map((pool, i) => (
                    <React.Fragment key={pool.id}>
                      <div className="flex flex-col justify-center px-2.5 py-1 rounded-xl border border-emerald-200/60 dark:border-emerald-800/40 shadow-sm min-w-[80px] bg-emerald-50/30 dark:bg-emerald-900/5">
                        <span className="text-[8px] uppercase font-bold tracking-wider mb-0.5 text-emerald-500 dark:text-emerald-500 flex items-center gap-0.5 truncate">
                          <Banknote size={8} className="shrink-0" />{pool.name}
                        </span>
                        <span className={`text-xs font-bold tabular-nums leading-tight ${pool.totalLiquidity < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-300'}`}>
                          {formatCurrency(pool.totalLiquidity)}
                        </span>
                      </div>
                      {i < poolsWithData.length - 1 && <div className="w-px h-5 bg-emerald-100 dark:bg-emerald-900/30 shrink-0" />}
                    </React.Fragment>
                  ))}
                  {poolsWithData.length > 0 && <Divider />}
                </>
              )}
              {visibleFields.fordringer && <Chip label="Fordringer" value={totalReceivables} bgClass="bg-sky-50/60 border-sky-100/60 dark:bg-sky-900/10 dark:border-sky-800/50" textClass="text-sky-600 dark:text-sky-400" />}
              {visibleFields.leverandorgjeld && <Chip label="Lev.Gjeld" value={totalPayables} bgClass="bg-amber-50/60 border-amber-100/60 dark:bg-amber-900/10 dark:border-amber-800/50" textClass="text-amber-600 dark:text-amber-400" />}
              {visibleFields.kortsiktigGjeld && showShortTermDebt && <Chip label="Kort.Gjeld" value={totalShortTermDebt} bgClass="bg-orange-50/60 border-orange-100/60 dark:bg-orange-900/10 dark:border-orange-800/50" textClass="text-orange-600 dark:text-orange-400" />}
              {visibleFields.lonnskostnad && <Chip label="Lønn" value={totalSalaryExpenses} bgClass="bg-pink-50/60 border-pink-100/60 dark:bg-pink-900/10 dark:border-pink-800/50" textClass="text-pink-600 dark:text-pink-400" />}
              {visibleFields.offAvgifter && <Chip label="Off.Avg" value={totalPublicFees} bgClass="bg-orange-50/60 border-orange-100/60 dark:bg-orange-900/10 dark:border-orange-800/50" textClass="text-orange-600 dark:text-orange-400" />}
              {visibleFields.nettoArbeidskapital && <><Divider /><Chip label="Arb.Kapital" value={totalWorkingCapital} bgClass="bg-teal-50/60 border-teal-100/60 dark:bg-teal-900/10 dark:border-teal-800/50" textClass="text-teal-600 dark:text-teal-400" /></>}
            </div>
          </div>
        )}
      </div>

      <div className="text-center pb-1">
        <a href="https://www.attentio.no" target="_blank" rel="noreferrer" className="text-[9px] text-slate-300 dark:text-slate-600 hover:text-slate-400 dark:hover:text-slate-500 transition-colors tracking-wider">
          Powered by Attentio
        </a>
      </div>
    </div>
  );
};

export default Footer;
