import React from 'react';
import { formatCurrency } from '../../constants';

interface FooterProps {
  totalRevenue: number;
  totalExpenses: number;
  totalResult: number;
  totalBudgetYTD: number;
  totalLiquidity: number;
  totalReceivables: number;
  totalPayables: number;
  totalPublicFees: number;
  totalSalaryExpenses: number;
  totalWorkingCapital: number;
  isAdminMode: boolean;
}

const MetricChip = ({ label, value, bgClass, textClass }: { label: string, value: number, bgClass: string, textClass?: string }) => {
    const isNeg = value < 0;
    return (
        <div className={`flex flex-col justify-center px-3 py-1.5 rounded-xl border border-opacity-60 shadow-sm min-w-[90px] backdrop-blur-sm ${bgClass}`}>
            <span className={`text-[9px] uppercase font-bold tracking-wider mb-0.5 ${textClass || 'text-slate-500 dark:text-slate-400'}`}>{label}</span>
            <span className={`text-xs sm:text-sm font-bold tabular-nums leading-tight ${isNeg ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                {formatCurrency(value)}
            </span>
        </div>
    );
};

const Footer: React.FC<FooterProps> = ({
  totalRevenue,
  totalExpenses,
  totalResult,
  totalBudgetYTD,
  totalLiquidity,
  totalReceivables,
  totalPayables,
  totalPublicFees,
  totalSalaryExpenses,
  totalWorkingCapital,
  isAdminMode
}) => {
  if (isAdminMode) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur border-t border-slate-200 dark:border-slate-700 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] z-20 transition-colors duration-300">
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-center">
            {/* Aggregates - Centered */}
            <div className="overflow-x-auto whitespace-nowrap scrollbar-hide w-full flex justify-start md:justify-center items-center pb-1 sm:pb-0">
                    <div className="flex gap-3 px-2">
                    <MetricChip 
                        label="Omsetning" 
                        value={totalRevenue} 
                        bgClass="bg-blue-50/50 border-blue-100/50 dark:bg-blue-900/10 dark:border-blue-800/50" 
                        textClass="text-blue-600 dark:text-blue-400"
                    />
                    <MetricChip 
                        label="Kostnader" 
                        value={totalExpenses} 
                        bgClass="bg-slate-50/50 border-slate-100/50 dark:bg-slate-800/30 dark:border-slate-700/50" 
                    />
                    <MetricChip 
                        label="Resultat" 
                        value={totalResult} 
                        bgClass="bg-indigo-50/50 border-indigo-100/50 dark:bg-indigo-900/10 dark:border-indigo-800/50" 
                        textClass="text-indigo-600 dark:text-indigo-400"
                    />
                    <MetricChip 
                        label="Budsjett" 
                        value={totalBudgetYTD} 
                        bgClass="bg-violet-50/50 border-violet-100/50 dark:bg-violet-900/10 dark:border-violet-800/50" 
                        textClass="text-violet-600 dark:text-violet-400"
                    />
                    <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                    <MetricChip 
                        label="Likviditet" 
                        value={totalLiquidity} 
                        bgClass="bg-emerald-50/50 border-emerald-100/50 dark:bg-emerald-900/10 dark:border-emerald-800/50" 
                        textClass="text-emerald-600 dark:text-emerald-400"
                    />
                    <MetricChip 
                        label="Fordringer" 
                        value={totalReceivables} 
                        bgClass="bg-sky-50/50 border-sky-100/50 dark:bg-sky-900/10 dark:border-sky-800/50" 
                        textClass="text-sky-600 dark:text-sky-400"
                    />
                    <MetricChip 
                        label="Lev.Gjeld" 
                        value={totalPayables} 
                        bgClass="bg-amber-50/50 border-amber-100/50 dark:bg-amber-900/10 dark:border-amber-800/50" 
                        textClass="text-amber-600 dark:text-amber-400"
                    />
                    {/* Salary Chip */}
                    <MetricChip 
                        label="Lønn" 
                        value={totalSalaryExpenses} 
                        bgClass="bg-pink-50/50 border-pink-100/50 dark:bg-pink-900/10 dark:border-pink-800/50" 
                        textClass="text-pink-600 dark:text-pink-400"
                    />
                    <MetricChip 
                        label="Off.Avg" 
                        value={totalPublicFees} 
                        bgClass="bg-orange-50/50 border-orange-100/50 dark:bg-orange-900/10 dark:border-orange-800/50" 
                        textClass="text-orange-600 dark:text-orange-400"
                    />
                    <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                    <MetricChip 
                        label="Arb.Kapital" 
                        value={totalWorkingCapital} 
                        bgClass="bg-teal-50/50 border-teal-100/50 dark:bg-teal-900/10 dark:border-teal-800/50" 
                        textClass="text-teal-600 dark:text-teal-400"
                    />
                    </div>
            </div>
            
            {/* Attentio Footer Branding */}
            <div className="absolute right-6 top-1/2 -translate-y-1/2 hidden xl:flex items-center gap-2 opacity-30 hover:opacity-100 transition-all duration-500 grayscale hover:grayscale-0">
                <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Powered by</span>
                <a href="https://www.attentio.no" target="_blank" rel="noreferrer">
                    <img 
                    src="https://ucarecdn.com/a57dd98f-5b74-4f56-8480-2ff70d700b09/667bf8f6e052ebdb5596b770_Logo1.png" 
                    alt="Attentio" 
                    className="h-3 w-auto dark:hidden" 
                    />
                    <img 
                    src="https://ucarecdn.com/6db62825-75c5-487d-a4cb-ce1b9721b707/Attentiologohvit.png" 
                    alt="Attentio" 
                    className="h-3 w-auto hidden dark:block" 
                    />
                </a>
            </div>
        </div>
    </div>
  );
};

export default Footer;