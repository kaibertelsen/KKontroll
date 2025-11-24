
import React from 'react';

interface DeviationSliderProps {
  value: number;
}

const DeviationSlider: React.FC<DeviationSliderProps> = ({ value }) => {
  const min = -50;
  const max = 50;
  
  const clampedValue = Math.max(min, Math.min(max, value));
  const percentage = ((clampedValue - min) / (max - min)) * 100;

  // Color logic based on value
  let colorClass = 'bg-slate-400';
  if (value > 5) colorClass = 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]';
  else if (value < -5) colorClass = 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)]';
  else colorClass = 'bg-amber-400';

  return (
    <div className="w-full h-6 relative flex items-center justify-center group">
      {/* Background Track - Made thicker (h-3) */}
      <div className="absolute w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-100">
        {/* Center line indicator */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-300 transform -translate-x-1/2"></div>
        
        {/* Optional: Fill to center */}
        <div 
            className={`absolute top-0 bottom-0 transition-all duration-500 ease-out opacity-40 ${value < 0 ? 'bg-rose-500' : 'bg-emerald-500'}`}
            style={{ 
                left: value < 0 ? `${percentage}%` : '50%', 
                right: value < 0 ? '50%' : `${100 - percentage}%`
            }}
        ></div>
      </div>

      {/* Thumb / Marker */}
      <div 
        className={`absolute w-4 h-4 rounded-full border-2 border-white transition-all duration-500 ease-out z-10 ${colorClass}`}
        style={{ left: `${percentage}%`, transform: 'translateX(-50%)' }}
      >
      </div>
      
      {/* Labels at edges */}
      <div className="absolute left-0 -bottom-0.5 text-[9px] text-slate-300 font-medium">-50%</div>
      <div className="absolute right-0 -bottom-0.5 text-[9px] text-slate-300 font-medium">+50%</div>
    </div>
  );
};

export default DeviationSlider;
