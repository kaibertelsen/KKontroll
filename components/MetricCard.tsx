import React, { useState, useMemo } from 'react';
import { ComputedCompanyData } from '../types';
import { formatCurrency } from '../constants';
import DeviationSlider from './DeviationSlider';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight, 
  Activity, 
  Target, 
  ArrowRight,
  BarChart3,
  GripHorizontal,
  Landmark,
  Banknote
} from 'lucide-react';
import { 
  AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart 
} from 'recharts';

interface MetricCardProps {
  data: ComputedCompanyData;
  onSelect: (company: ComputedCompanyData) => void;
  
  // Sorting Props
  isSortMode: boolean;
  onDragStart?: (e: React.DragEvent, index: number) => void;
  onDragEnter?: (e: React.DragEvent, index: number) => void;
  onDragEnd?: () => void;
  index: number;
  
  // New Prop
  cardSize?: 'normal' | 'compact';
  zoomLevel?: number; // Added zoomLevel prop
}

const MetricCard: React.FC<MetricCardProps> = ({ 
  data, 
  onSelect, 
  isSortMode, 
  onDragStart,
  onDragEnter,
  onDragEnd,
  index,
  cardSize = 'normal',
  zoomLevel = 100
}) => {
  const [isFlipped, setIsFlipped] = useState(false);

  // --- CHART DATA GENERATION ---
  const chartData = useMemo(() => {
      const items = [];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des'];
      
      // SAFE PARSING OF BUDGET DATA
      let bMonths: number[] = [];
      // @ts-ignore
      const raw = data.budgetMonths || data.budget_months;

      if (Array.isArray(raw)) {
          bMonths = raw.map(x => Number(x) || 0);
      } else if (typeof raw === 'object' && raw !== null) {
          // Handle object case {0: 100, 1: 200}
          bMonths = Object.values(raw).map(Number);
      } else if (typeof raw === 'string') {
          // Handle Postgres Array string "{100,200}" or JSON "[100,200]"
          let cleanStr = raw.trim();
          if (cleanStr.startsWith('{') && cleanStr.endsWith('}')) {
              cleanStr = cleanStr.replace('{', '[').replace('}', ']');
          }
          try {
              const parsed = JSON.parse(cleanStr);
              if (Array.isArray(parsed)) bMonths = parsed.map(Number);
          } catch(e) {
              // Fallback split
              const parts = cleanStr.replace(/[\[\]\{\}]/g, '').split(',');
              if (parts.length > 0) bMonths = parts.map(Number);
          }
      }

      if (bMonths.length !== 12) bMonths = Array(12).fill(0);

      // Force distribute total if months are empty or invalid
      const total = Number(data.budgetTotal || 0);
      const sum = bMonths.reduce((a, b) => a + b, 0);

      if ((sum === 0 || isNaN(sum)) && total > 0) {
          const perMonth = Math.round(total / 12);
          bMonths = Array(12).fill(perMonth);
          bMonths[11] += (total - (perMonth * 12));
      }

      const now = new Date();
      const currentMonthIndex = now.getMonth(); 
      
      const avgResultPerMonth = data.resultYTD / (currentMonthIndex + 1);
      
      for (let i = 0; i <= currentMonthIndex; i++) {
        const variance = 0.8 + Math.random() * 0.4; 
        const result = Math.round(avgResultPerMonth * variance);
        
        const budget = Number(bMonths[i]) || 0;
        
        const prevResult = i > 0 ? items[i-1].cumResult : 0;
        const prevBudget = i > 0 ? items[i-1].cumBudget : 0;

        items.push({
          month: months[i],
          cumResult: prevResult + result,
          cumBudget: prevBudget + budget,
        });
      }

      // Force last point to match actual YTD totals exactly
      if(items.length > 0) {
          items[items.length - 1].cumResult = data.resultYTD;
      }
      return items;
  }, [data]);

  // Trend Logic
  const isPositiveTrend = data.trendHistory >= 0;
  const trendColor = isPositiveTrend ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
  const trendBg = isPositiveTrend ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-rose-50 dark:bg-rose-900/20';
  const TrendIcon = isPositiveTrend ? ArrowUpRight : ArrowDownRight;

  // Status Calculation
  // Formula: (Liquidity + Receivables) - (Payables + PublicFees)
  const statusValue = (data.liquidity + data.receivables) - (data.accountsPayable + (data.publicFees || 0));

  const handleClick = (e: React.MouseEvent) => {
    if (isSortMode) {
        e.preventDefault(); 
        return;
    }
    if (cardSize === 'compact') {
        onSelect(data);
        return;
    }
    setIsFlipped(!isFlipped);
  };

  // --- DYNAMIC SCALING LOGIC ---
  const heightClass = useMemo(() => {
      if (cardSize === 'compact') return 'h-48';
      if (zoomLevel >= 110) return 'h-[500px]'; // Zoomed In
      if (zoomLevel >= 100) return 'h-[470px]'; // Standard (increased slightly for extra row)
      if (zoomLevel >= 80) return 'h-[420px]';  // Slightly zoomed out
      return 'h-[360px]';                       // Fully zoomed out
  }, [zoomLevel, cardSize]);

  // Adjust padding and text size for smaller zoom levels
  const contentPadding = zoomLevel < 80 ? 'p-3' : 'p-3 md:p-5';
  const textSizeClass = zoomLevel < 80 ? 'text-xs' : 'text-sm';
  const subTextSizeClass = zoomLevel < 80 ? 'text-[9px]' : 'text-[10px]';
  const headerSizeClass = zoomLevel < 80 ? 'text-sm' : 'text-lg';

  const RowItem = ({ icon: Icon, label, subLabel, value, highlight, extra, valueColor }: any) => (
    <div className={`flex justify-between items-center ${zoomLevel < 80 ? 'h-6' : 'h-7'}`}>
      <div className="flex items-center gap-2 overflow-hidden">
        <Icon size={zoomLevel < 80 ? 12 : 14} className="text-slate-400 dark:text-slate-500 shrink-0" />
        <div className="flex items-baseline gap-1 truncate">
            <span className={`${textSizeClass} font-medium text-slate-600 dark:text-slate-400`}>{label}</span>
            {subLabel && <span className={`${subTextSizeClass} text-slate-400 dark:text-slate-600`}>{subLabel}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {extra}
        <span className={`${textSizeClass} font-bold tabular-nums ${valueColor ? valueColor : (highlight ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300')}`}>
            {formatCurrency(value)}
        </span>
      </div>
    </div>
  );
  
  // --- COMPACT VIEW ---
  if (cardSize === 'compact') {
      return (
        <div 
            className={`h-48 relative select-none rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-300 overflow-hidden
            ${isSortMode ? 'animate-wiggle cursor-grab active:cursor-grabbing z-10 shadow-lg ring-2 ring-amber-400 ring-opacity-50' : 'cursor-pointer hover:-translate-y-1 hover:shadow-md hover:border-sky-300 dark:hover:border-sky-700'}`}
            onClick={handleClick}
            draggable={isSortMode}
            onDragStart={(e) => onDragStart && onDragStart(e, index)}
            onDragEnter={(e) => onDragEnter && onDragEnter(e, index)}
            onDragEnd={onDragEnd}
            onDragOver={(e) => e.preventDefault()} 
        >
            {/* Status Strip */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${data.calculatedDeviationPercent < 0 ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>

            <div className="p-4 flex flex-col h-full pl-5">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate" title={data.name}>
                        {data.name} {/* Short abbreviation */}
                    </h3>
                    <div className={`text-xs font-bold px-1.5 py-0.5 rounded ${data.calculatedDeviationPercent < 0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'}`}>
                        {data.calculatedDeviationPercent > 0 ? '+' : ''}{data.calculatedDeviationPercent.toFixed(0)}%
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-x-2 gap-y-3 flex-grow">
                    <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Resultat</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(data.resultYTD)}</p>
                    </div>
                    <div>
                         <p className="text-[10px] uppercase font-bold text-slate-400">Likviditet</p>
                         <p className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(data.liquidity)}</p>
                    </div>
                     <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Budsjett</p>
                        <p className="text-sm font-bold text-slate-500">{formatCurrency(data.calculatedBudgetYTD)}</p>
                    </div>
                     <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Kapital</p>
                        <p className="text-sm font-bold text-sky-600 dark:text-sky-400">{formatCurrency(statusValue)}</p>
                    </div>
                </div>
            </div>

            {/* Drag Handle Overlay */}
            {isSortMode && (
                <div className="absolute top-2 right-2 bg-white dark:bg-slate-700 rounded-full p-1 shadow-md border border-slate-200 dark:border-slate-600">
                    <GripHorizontal className="w-3 h-3 text-slate-500" />
                </div>
            )}
        </div>
      );
  }

  // --- NORMAL VIEW (Scaled) ---
  return (
    <div 
      className={`${heightClass} perspective-[1000px] metric-card select-none ${isSortMode ? 'animate-wiggle cursor-grab active:cursor-grabbing z-10' : 'cursor-pointer'}`}
      onClick={handleClick}
      draggable={isSortMode}
      onDragStart={(e) => onDragStart && onDragStart(e, index)}
      onDragEnter={(e) => onDragEnter && onDragEnter(e, index)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => e.preventDefault()} 
    >
      {/* Sort Mode Overlay */}
      {isSortMode && (
          <div className="absolute -top-2 -right-2 z-50 bg-white dark:bg-slate-700 rounded-full p-1 shadow-md border border-slate-200 dark:border-slate-600 animate-bounce">
              <GripHorizontal className="w-4 h-4 text-slate-500 dark:text-slate-300" />
          </div>
      )}

      {/* LAYER 1: HOVER LIFT */}
      <div 
        className={`relative w-full h-full transition-all duration-300 ease-out rounded-xl
            ${!isSortMode && 'hover:-translate-y-2 hover:shadow-2xl'}
            ${isSortMode ? 'shadow-lg ring-2 ring-amber-400 ring-opacity-50' : ''}
        `}
      >
        {/* LAYER 2: FLIP ROTATION */}
        <div className={`relative w-full h-full transition-transform duration-700 [transform-style:preserve-3d] ${isFlipped && !isSortMode ? '[transform:rotateY(180deg)]' : ''}`}>
          
          {/* FRONT FACE */}
          <div 
            className="absolute inset-0 w-full h-full [backface-visibility:hidden]"
            style={{ pointerEvents: isFlipped ? 'none' : 'auto' }}
          >
            <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border ${contentPadding} flex flex-col h-full overflow-hidden transition-colors duration-300 ${isSortMode ? 'border-amber-300 dark:border-amber-700 opacity-90' : 'border-slate-200 dark:border-slate-700'}`}>
              
              <div className={`flex justify-between items-start ${zoomLevel < 80 ? 'mb-2' : 'mb-3'} shrink-0`}>
                <div className="overflow-hidden w-full">
                  <h3 className={`${headerSizeClass} font-bold text-slate-900 dark:text-white leading-tight truncate pr-1`} title={data.fullName || data.name}>
                      {index + 1}. {data.fullName || data.name}
                  </h3>
                  <p className={`${subTextSizeClass} text-slate-500 dark:text-slate-400 font-medium`}>{data.manager}</p>
                </div>
              </div>

              <div className="flex flex-col gap-0.5 flex-grow">
                  <RowItem icon={TrendingUp} label="Omsetning YTD" value={data.revenue} />
                  <RowItem icon={TrendingDown} label="Kostnader YTD" value={data.expenses} />
                  <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
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
                  <RowItem icon={Target} label="Budsjett YTD" value={data.calculatedBudgetYTD} valueColor="text-slate-500 dark:text-slate-400" />
                  <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                  <RowItem icon={Wallet} label="Likviditet" subLabel={data.liquidityDate ? `(${data.liquidityDate})` : ''} value={data.liquidity} />
                  <RowItem icon={ArrowUpRight} label="Fordringer" subLabel={data.receivablesDate ? `(${data.receivablesDate})` : ''} value={data.receivables} />
                  <RowItem icon={ArrowDownRight} label="Leverandørgjeld" subLabel={data.accountsPayableDate ? `(${data.accountsPayableDate})` : ''} value={data.accountsPayable} />
                  <RowItem icon={Banknote} label="Lønnskostnad" subLabel={data.salaryExpensesDate ? `(${data.salaryExpensesDate})` : ''} value={data.salaryExpenses} />
                  <RowItem icon={Landmark} label="Off. Avgifter" subLabel={data.publicFeesDate ? `(${data.publicFeesDate})` : ''} value={data.publicFees} />
                  
                  <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                  <RowItem icon={Activity} label="Netto Arbeidskapital" value={statusValue} valueColor="text-sky-600 dark:text-sky-400" highlight />
              </div>

              <div className="mt-2 shrink-0">
                <div className="flex justify-end mb-1">
                    <span className={`${subTextSizeClass} font-bold ${data.calculatedDeviationPercent < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        Avvik {data.calculatedDeviationPercent > 0 ? '+' : ''}{data.calculatedDeviationPercent.toFixed(1)}%
                    </span>
                </div>
                <DeviationSlider value={data.calculatedDeviationPercent} />
              </div>

            </div>
          </div>

          {/* BACK FACE */}
          <div 
            className="absolute inset-0 w-full h-full [transform:rotateY(180deg)] [backface-visibility:hidden]"
            style={{ pointerEvents: isFlipped ? 'auto' : 'none' }}
          >
            <div className="bg-slate-800 rounded-xl shadow-xl border border-slate-700 p-4 flex flex-col h-full text-slate-50 relative overflow-hidden">
              <div className="flex justify-between items-center mb-2 border-b border-slate-700 pb-2">
                <div className="overflow-hidden">
                    <h3 className="text-sm font-bold text-white truncate leading-tight" title={data.fullName || data.name}>
                        {index + 1}. {data.fullName || data.name}
                    </h3>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Resultatutvikling</p>
                </div>
                <div className="p-1 bg-slate-700 rounded-full shrink-0">
                  <BarChart3 className="w-4 h-4 text-sky-400" />
                </div>
              </div>

              <div className="flex-grow w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id={`colorResult-${data.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                        <XAxis dataKey="month" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                        <YAxis stroke="#94a3b8" fontSize={10} tickFormatter={(val) => `${(val/1000).toFixed(0)}k`} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', backgroundColor: '#1e293b', color: '#fff' }} formatter={(value: number) => formatCurrency(value)} labelStyle={{ color: '#cbd5e1' }} />
                        <Area type="monotone" dataKey="cumResult" name="Resultat" stroke="#0ea5e9" fillOpacity={1} fill={`url(#colorResult-${data.id})`} strokeWidth={2} />
                        <Line type="monotone" dataKey="cumBudget" name="Budsjett" stroke="#94a3b8" strokeDasharray="4 4" strokeWidth={2} dot={false} connectNulls={true} isAnimationActive={false} />
                    </ComposedChart>
                </ResponsiveContainer>
              </div>

              <button 
                className="mt-3 w-full py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-lg cursor-pointer relative z-20"
                onClick={(e) => { 
                    e.stopPropagation(); 
                    e.preventDefault(); 
                    onSelect(data); 
                }}
              >
                Gå til Firmaside <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetricCard;