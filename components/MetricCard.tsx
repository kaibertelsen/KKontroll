
import React, { useState } from 'react';
import { ComputedCompanyData } from '../types';
import { formatCurrency } from '../constants';
import StatusBadge from './StatusBadge';
import DeviationSlider from './DeviationSlider';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  Activity, 
  Target, 
  FileText, 
  Calendar, 
  User, 
  ArrowRight,
  BarChart3
} from 'lucide-react';

interface MetricCardProps {
  data: ComputedCompanyData;
  onSelect: (company: ComputedCompanyData) => void;
}

const MetricCard: React.FC<MetricCardProps> = ({ data, onSelect }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  // Trend Logic
  const isPositiveTrend = data.trendHistory >= 0;
  const trendColor = isPositiveTrend ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
  const trendBg = isPositiveTrend ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-rose-50 dark:bg-rose-900/20';
  const TrendIcon = isPositiveTrend ? ArrowUpRight : ArrowDownRight;

  // Status Calculation: (Receivables - Payables) + Liquidity
  const statusValue = (data.receivables - data.accountsPayable) + data.liquidity;

  const RowItem = ({ icon: Icon, label, subLabel, value, highlight, extra, valueColor }: any) => (
    <div className="flex justify-between items-center h-7">
      <div className="flex items-center gap-2 overflow-hidden">
        <Icon size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
        <div className="flex items-baseline gap-1 truncate">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{label}</span>
            {subLabel && <span className="text-[10px] text-slate-400 dark:text-slate-600">{subLabel}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {extra}
        <span className={`text-sm font-bold tabular-nums ${valueColor ? valueColor : (highlight ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300')}`}>
            {formatCurrency(value)}
        </span>
      </div>
    </div>
  );

  return (
    <div 
      className="h-[420px] cursor-pointer perspective-[1000px]"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      {/* LAYER 1: HOVER LIFT */}
      <div className="relative w-full h-full transition-all duration-500 ease-out hover:-translate-y-2 hover:shadow-2xl rounded-xl">
        
        {/* LAYER 2: FLIP ROTATION */}
        <div className={`relative w-full h-full transition-transform duration-700 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
          
          {/* FRONT FACE */}
          <div className="absolute inset-0 w-full h-full [backface-visibility:hidden]">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 flex flex-col h-full transition-colors duration-300">
              
              {/* Header */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{data.id}. {data.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{data.manager}</p>
                </div>
                <StatusBadge deviation={data.calculatedDeviationPercent} />
              </div>

              {/* Main List - Strict Order */}
              <div className="flex flex-col gap-0.5 flex-grow">
                  
                  {/* 1. Revenue */}
                  <RowItem 
                    icon={TrendingUp} 
                    label="Omsetning YTD" 
                    value={data.revenue} 
                  />
                  {/* 2. Expenses */}
                  <RowItem 
                    icon={TrendingDown} 
                    label="Kostnader YTD" 
                    value={data.expenses} 
                  />
                  
                  <div className="h-px bg-slate-100 dark:bg-slate-700 my-1.5"></div>
                  
                  {/* 3. Result */}
                  <RowItem 
                    icon={BarChart3} 
                    label="Resultat YTD" 
                    value={data.resultYTD} 
                    highlight
                    extra={
                        <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded ${trendBg}`} title="Endring mot i fjor">
                            <TrendIcon className={`w-3 h-3 ${trendColor}`} />
                            <span className={`text-[10px] font-bold ${trendColor}`}>{Math.abs(data.trendHistory)}%</span>
                        </div>
                    }
                  />
                  <RowItem 
                    icon={Target} 
                    label="Budsjett YTD" 
                    value={data.calculatedBudgetYTD} 
                    valueColor="text-slate-500 dark:text-slate-400"
                  />

                  <div className="h-px bg-slate-100 dark:bg-slate-700 my-1.5"></div>

                  {/* 4. Liquidity */}
                  <RowItem 
                    icon={Wallet} 
                    label="Likviditet" 
                    subLabel={data.liquidityDate ? `(${data.liquidityDate})` : ''}
                    value={data.liquidity} 
                  />
                  {/* 5. Receivables */}
                  <RowItem 
                    icon={ArrowUpRight} 
                    label="Fordringer" 
                    subLabel={data.receivablesDate ? `(${data.receivablesDate})` : ''}
                    value={data.receivables} 
                  />
                  {/* 6. Payables */}
                  <RowItem 
                    icon={ArrowDownRight} 
                    label="Leverandørgjeld" 
                    subLabel={data.accountsPayableDate ? `(${data.accountsPayableDate})` : ''}
                    value={data.accountsPayable} 
                  />
                  
                  <div className="h-px bg-slate-100 dark:bg-slate-700 my-1.5"></div>

                  {/* 7. Status */}
                  <RowItem 
                    icon={Activity} 
                    label="Netto Arbeidskapital" 
                    value={statusValue} 
                    valueColor="text-sky-600 dark:text-sky-400"
                    highlight
                  />

              </div>

              {/* Footer: Deviation Text + Slider */}
              {/* Removed mt-1, now mt-0 for tighter spacing */}
              <div className="mt-0 pt-1 border-t border-slate-50 dark:border-slate-700/50">
                <div className="flex justify-end mb-1">
                    <span className={`text-xs font-bold ${data.calculatedDeviationPercent < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        Avvik {data.calculatedDeviationPercent > 0 ? '+' : ''}{data.calculatedDeviationPercent.toFixed(1)}%
                    </span>
                </div>
                <DeviationSlider value={data.calculatedDeviationPercent} />
              </div>

            </div>
          </div>

          {/* BACK FACE */}
          <div className="absolute inset-0 w-full h-full [transform:rotateY(180deg)] [backface-visibility:hidden]">
            <div className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 p-5 flex flex-col h-full text-slate-50 relative overflow-hidden">
              
              <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2">
                <h3 className="text-lg font-bold text-white">{data.name} - Status</h3>
                <div className="p-1.5 bg-slate-700 rounded-full">
                  <FileText className="w-4 h-4 text-sky-400" />
                </div>
              </div>

              <div className="space-y-2 flex-grow">
                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Sist rapportert</p>
                    <p className="text-sm font-medium text-slate-100">{data.lastReportDate}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <User className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Rapportert av</p>
                    <p className="text-sm font-medium text-slate-100">{data.lastReportBy}</p>
                  </div>
                </div>

                <div className="bg-slate-700/50 rounded-lg p-3 border border-slate-600 mt-1">
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">Kommentar</p>
                  <p className="text-xs text-slate-300 italic leading-relaxed line-clamp-4">
                    "{data.comment}"
                  </p>
                </div>
              </div>

              <button 
                className="mt-auto w-full py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-lg"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(data);
                }}
              >
                Gå til Firmaside
                <ArrowRight className="w-4 h-4" />
              </button>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default MetricCard;
