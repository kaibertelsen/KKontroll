
import React from 'react';
import { formatCurrency } from '../constants';

interface DeviationSliderProps {
  value: number;
  // Scenario mode
  isScenario?: boolean;
  budgetYTDLow?: number;
  budgetYTDHigh?: number;
  resultYTD?: number;
}

const DeviationSlider: React.FC<DeviationSliderProps> = ({ value, isScenario, budgetYTDLow, budgetYTDHigh, resultYTD }) => {

  // --- SCENARIO MODE ---
  if (isScenario && budgetYTDLow !== undefined && budgetYTDHigh !== undefined && resultYTD !== undefined) {
    const low = budgetYTDLow;
    const high = budgetYTDHigh;
    const range = high - low;

    // Extend the visual track 15% beyond each end so arrows have room
    const padding = range > 0 ? range * 0.2 : 1;
    const trackMin = low - padding;
    const trackMax = high + padding;
    const trackRange = trackMax - trackMin;

    const toPercent = (val: number) => ((val - trackMin) / trackRange) * 100;

    const lowPct = toPercent(low);
    const highPct = toPercent(high);
    const resultPct = Math.max(0, Math.min(100, toPercent(resultYTD)));
    const isOutsideLow = resultYTD < low;
    const isOutsideHigh = resultYTD > high;

    let markerColor = 'bg-amber-400';
    if (resultYTD >= low && resultYTD <= high) markerColor = 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]';
    else if (isOutsideLow) markerColor = 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]';
    else if (isOutsideHigh) markerColor = 'bg-emerald-600 shadow-[0_0_8px_rgba(5,150,105,0.7)]';

    return (
      <div className="w-full relative" style={{ height: '36px' }}>
        {/* Background track */}
        <div className="absolute top-2 left-0 right-0 h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full" />

        {/* Range fill (pessimist → optimist) */}
        <div
          className="absolute top-2 h-2.5 bg-sky-200 dark:bg-sky-800 rounded-full"
          style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%` }}
        />

        {/* Pessimist marker */}
        <div
          className="absolute top-1 w-0.5 h-4 bg-rose-400 dark:bg-rose-500 rounded"
          style={{ left: `${lowPct}%`, transform: 'translateX(-50%)' }}
        />

        {/* Optimist marker */}
        <div
          className="absolute top-1 w-0.5 h-4 bg-emerald-500 dark:bg-emerald-400 rounded"
          style={{ left: `${highPct}%`, transform: 'translateX(-50%)' }}
        />

        {/* Result marker / arrow */}
        {isOutsideLow ? (
          <div className="absolute top-1 flex items-center" style={{ left: '2px' }}>
            <span className="text-rose-500 text-xs font-bold">◄</span>
          </div>
        ) : isOutsideHigh ? (
          <div className="absolute top-1 flex items-center" style={{ right: '2px' }}>
            <span className="text-emerald-600 text-xs font-bold">►</span>
          </div>
        ) : (
          <div
            className={`absolute top-0.5 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 transition-all duration-500 ease-out z-10 ${markerColor}`}
            style={{ left: `${resultPct}%`, transform: 'translateX(-50%)' }}
          />
        )}

        {/* Labels */}
        <div className="absolute bottom-0 flex justify-between w-full">
          <span className="text-[9px] text-rose-400 font-medium">{formatCurrency(low)}</span>
          <span className="text-[9px] text-emerald-500 font-medium">{formatCurrency(high)}</span>
        </div>
      </div>
    );
  }

  // --- STANDARD MODE ---
  const min = -50;
  const max = 50;
  const clampedValue = Math.max(min, Math.min(max, value));
  const percentage = ((clampedValue - min) / (max - min)) * 100;

  let colorClass = 'bg-slate-400';
  if (value > 5) colorClass = 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]';
  else if (value < -5) colorClass = 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]';
  else colorClass = 'bg-amber-400';

  return (
    <div className="w-full h-8 relative flex items-center justify-center group">
      <div className="absolute top-1 w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-100">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-300 transform -translate-x-1/2"></div>
        <div
          className={`absolute top-0 bottom-0 transition-all duration-500 ease-out opacity-40 ${value < 0 ? 'bg-rose-500' : 'bg-emerald-500'}`}
          style={{
            left: value < 0 ? `${percentage}%` : '50%',
            right: value < 0 ? '50%' : `${100 - percentage}%`
          }}
        />
      </div>
      <div
        className={`absolute top-0.5 w-4 h-4 rounded-full border-2 border-white transition-all duration-500 ease-out z-10 ${colorClass}`}
        style={{ left: `${percentage}%`, transform: 'translateX(-50%)' }}
      />
      <div className="absolute left-0 bottom-0 text-[9px] text-slate-300 font-medium">-50%</div>
      <div className="absolute right-0 bottom-0 text-[9px] text-slate-300 font-medium">+50%</div>
    </div>
  );
};

export default DeviationSlider;
