
import React, { useState } from 'react';
import { ComputedCompanyData } from '../types';
import { formatCurrency } from '../constants';
import StatusBadge from './StatusBadge';
import DeviationSlider from './DeviationSlider';
import { TrendingUp, Wallet, AlertCircle, Calendar, User, FileText, ArrowRight, Target, ArrowUpRight, ArrowDownRight } from 'lucide-react';

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

  return (
    <div 
      className="h-[300px] cursor-pointer perspective-[1000px]"
      onClick={() => setIsFlipped(!isFlipped)}
    >
      {/* 
        LAYER 1: HOVER LIFT 
        This container handles the vertical movement and shadow on hover.
        It is separate from the rotation container to avoid CSS transform conflicts.
      */}
      <div className="relative w-full h-full transition-all duration-500 ease-out hover:-translate-y-2 hover:shadow-2xl rounded-xl">
        
        {/* 
          LAYER 2: FLIP ROTATION
          This container handles the 3D flip.
        */}
        <div className={`relative w-full h-full transition-transform duration-700 [transform-style:preserve-3d] ${isFlipped ? '[transform:rotateY(180deg)]' : ''}`}>
          
          {/* FRONT FACE */}
          <div className="absolute inset-0 w-full h-full [backface-visibility:hidden]">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 flex flex-col h-full transition-colors duration-300">
              {/* Header */}
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{data.id}. {data.name}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{data.manager}</p>
                </div>
                <StatusBadge deviation={data.calculatedDeviationPercent} />
              </div>

              {/* Metrics Grid */}
              <div className="space-y-2 mb-2 flex-grow">
                
                {/* Result with Trend Arrow */}
                <div className="flex justify-between items-center group/item h-9">
                    <div className="flex items-center text-slate-600 dark:text-slate-400 text-sm">
                        <TrendingUp className="w-4 h-4 mr-2 text-slate-400 dark:text-slate-500 group-hover/item:text-slate-600 dark:group-hover/item:text-slate-300 transition-colors" />
                        <span className="font-medium">Resultat YTD</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        {/* TREND INDICATOR */}
                        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md ${trendBg} border border-transparent dark:border-slate-700/50`} title="Endring mot samme periode i fjor">
                            <TrendIcon className={`w-3 h-3 ${trendColor}`} />
                            <span className={`text-[10px] font-bold ${trendColor}`}>
                                {Math.abs(data.trendHistory)}%
                            </span>
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white text-lg tabular-nums">{formatCurrency(data.resultYTD)}</span>
                    </div>
                </div>

                {/* Budget */}
                <div className="flex justify-between items-center group/item h-9">
                    <div className="flex items-center text-slate-600 dark:text-slate-400 text-sm">
                        <Target className="w-4 h-4 mr-2 text-slate-400 dark:text-slate-500 group-hover/item:text-slate-600 dark:group-hover/item:text-slate-300 transition-colors" />
                        <span className="font-medium">Budsjett YTD</span>
                    </div>
                    <div className="flex flex-col items-end leading-none">
                      <span className="font-bold text-slate-500 dark:text-slate-400 text-lg tabular-nums">{formatCurrency(Math.round(data.calculatedBudgetYTD))}</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">pr. år {formatCurrency(data.budgetTotal)}</span>
                    </div>
                </div>

                {/* Divider */}
                <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>

                {/* Deviation */}
                <div className="flex justify-between items-center h-8">
                    <div className="flex items-center text-slate-600 dark:text-slate-400 text-sm">
                        <AlertCircle className="w-4 h-4 mr-2 text-slate-400 dark:text-slate-500" />
                        <span className="font-medium">Avvik %</span>
                    </div>
                    <span className={`font-bold tabular-nums ${data.calculatedDeviationPercent < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {data.calculatedDeviationPercent > 0 ? '+' : ''}{data.calculatedDeviationPercent.toFixed(1)}%
                    </span>
                </div>

                {/* Liquidity */}
                <div className="flex justify-between items-center mt-1 h-9">
                    <div className="flex items-center text-slate-600 dark:text-slate-400 text-sm">
                        <Wallet className="w-4 h-4 mr-2 text-slate-400 dark:text-slate-500" />
                        <div className="flex flex-col leading-none">
                          <span className="font-medium">Likviditet</span>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{data.liquidityDate}</span>
                        </div>
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white tabular-nums">{formatCurrency(data.liquidity)}</span>
                </div>
              </div>

              {/* Visual Slider */}
              <div className="mt-auto pt-0">
                <DeviationSlider value={data.calculatedDeviationPercent} />
                <div className="mt-2 text-center text-[10px] text-slate-300 dark:text-slate-600 font-medium uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                  Klikk for detaljer
                </div>
              </div>
            </div>
          </div>

          {/* BACK FACE */}
          <div className="absolute inset-0 w-full h-full [transform:rotateY(180deg)] [backface-visibility:hidden]">
            <div className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 p-5 flex flex-col h-full text-slate-50 relative overflow-hidden">
              
              {/* Header */}
              <div className="flex justify-between items-center mb-3 border-b border-slate-700 pb-2">
                <h3 className="text-lg font-bold text-white">{data.name} - Status</h3>
                <div className="p-1.5 bg-slate-700 rounded-full">
                  <FileText className="w-4 h-4 text-sky-400" />
                </div>
              </div>

              {/* Content */}
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

              {/* Button */}
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
