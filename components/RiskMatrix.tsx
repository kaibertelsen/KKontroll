
import React, { useState } from 'react';
import { 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Label, Customized 
} from 'recharts';
import { ComputedCompanyData } from '../types';
import { formatCurrency } from '../constants';
import { History } from 'lucide-react';

interface RiskMatrixProps {
  data: ComputedCompanyData[];
}

const RiskMatrix: React.FC<RiskMatrixProps> = ({ data }) => {
  const [showHistory, setShowHistory] = useState(false);
  
  // Transform data for the scatter plot
  const chartData = data.map(c => ({
    ...c,
    x: c.liquidity, 
    y: c.calculatedDeviationPercent, 
    // Fallback to current values if prev is missing, so dots just stay in place if no data
    prevX: c.prevLiquidity ?? c.liquidity,
    prevY: c.prevDeviation ?? c.calculatedDeviationPercent,
    z: 1 
  }));

  const xMax = Math.max(...chartData.map(d => d.x)) * 1.1;

  // Custom Shape for the Current Position (Colored Circle)
  const renderCustomNode = (props: any) => {
    const { cx, cy, payload } = props;
    const isLowLiquidity = payload.x < 300000;
    const isNegativeDeviation = payload.y < 0;
    
    let fill = '#f59e0b'; // Warning (Yellow)
    if (isNegativeDeviation && isLowLiquidity) fill = '#f43f5e'; // Danger (Red)
    else if (!isNegativeDeviation && !isLowLiquidity) fill = '#10b981'; // Good (Green)

    // Get initials (max 3 chars)
    const initials = payload.name.substring(0, 3).toUpperCase();

    return (
      <g className="isolate">
        <circle cx={cx} cy={cy} r={18} fill={fill} stroke="white" strokeWidth={2} className="shadow-md drop-shadow-md transition-all duration-500" />
        <text x={cx} y={cy} dy={4} textAnchor="middle" fill="white" fontSize={10} fontWeight="bold" style={{ pointerEvents: 'none' }}>
            {initials}
        </text>
      </g>
    );
  };

  // Custom Layer to draw History Trails (Lines + Gray Dots)
  const HistoryTrails = (props: any) => {
      if (!showHistory) return null;

      const { xAxisMap, yAxisMap } = props;
      
      // GUARD CLAUSE: Prevent accessing [0] of undefined
      if (!xAxisMap || !yAxisMap) return null;

      const xAxis = xAxisMap[0];
      const yAxis = yAxisMap[0];

      // Double check axes exist
      if (!xAxis || !yAxis) return null;

      return (
          <g className="history-layer" style={{ pointerEvents: 'none' }}>
              {chartData.map((entry, index) => {
                  // Convert Data Values to Pixel Coordinates using Recharts Scales
                  const xCurrent = xAxis.scale(entry.x);
                  const yCurrent = yAxis.scale(entry.y);
                  
                  const xPrev = xAxis.scale(entry.prevX);
                  const yPrev = yAxis.scale(entry.prevY);

                  // If coordinates are invalid, skip
                  if (xCurrent == null || yCurrent == null || xPrev == null || yPrev == null) return null;

                  return (
                      <g key={`history-${index}`}>
                          {/* The Line connecting Past -> Present */}
                          <line 
                            x1={xPrev} y1={yPrev} 
                            x2={xCurrent} y2={yCurrent} 
                            stroke="#cbd5e1" 
                            strokeWidth={2} 
                            strokeDasharray="4 4" 
                          />
                          
                          {/* The Gray Circle (Past Position) */}
                          <circle 
                            cx={xPrev} cy={yPrev} 
                            r={12} 
                            fill="#e2e8f0" 
                            stroke="#94a3b8" 
                            strokeWidth={1} 
                          />
                      </g>
                  );
              })}
          </g>
      );
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Risiko-Matrise (Konsern)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Plassering basert på Likviditet (X) vs Avvik fra budsjett (Y)</p>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="hidden md:flex gap-4 text-xs font-medium mr-4">
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-rose-500"></div><span>Høy Risiko</span></div>
                <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-emerald-500"></div><span>Lav Risiko</span></div>
             </div>
             
             {/* History Toggle */}
             <button 
                onClick={() => setShowHistory(!showHistory)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                    showHistory 
                    ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900' 
                    : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600'
                }`}
             >
                <History size={14} />
                <span>{showHistory ? 'Skjul historikk' : 'Vis historikk'}</span>
             </button>
          </div>
      </div>
      
      <div className="h-[350px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            
            <XAxis 
                type="number" 
                dataKey="x" 
                name="Likviditet" 
                tickFormatter={(val) => `${(val/1000).toFixed(0)}k`} 
                stroke="#94a3b8" 
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1' }}
            >
                <Label value="Likviditet" offset={0} position="insideBottom" fill="#94a3b8" fontSize={10} />
            </XAxis>

            <YAxis 
                type="number" 
                dataKey="y" 
                name="Avvik %" 
                tickFormatter={(val) => `${val}%`} 
                stroke="#94a3b8" 
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1' }}
            >
                 <Label value="Avvik %" angle={-90} position="insideLeft" fill="#94a3b8" fontSize={10} />
            </YAxis>

            <Tooltip 
                cursor={{ strokeDasharray: '3 3' }} 
                content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                            <div className="bg-white dark:bg-slate-700 p-3 border border-slate-200 dark:border-slate-600 shadow-lg rounded-lg z-50 relative">
                                <p className="font-bold text-slate-900 dark:text-white mb-1">{d.name}</p>
                                <div className="text-xs space-y-1">
                                    <p className="text-slate-500 dark:text-slate-300">Avvik: <span className={d.y < 0 ? 'text-rose-500' : 'text-emerald-500'}>{d.y.toFixed(1)}%</span></p>
                                    <p className="text-slate-500 dark:text-slate-300">Likviditet: {formatCurrency(d.x)}</p>
                                </div>
                                {showHistory && (
                                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-600 text-[10px] text-slate-400">
                                        <p>Forrige mnd:</p>
                                        <p>Avvik: {d.prevY?.toFixed(1)}%</p>
                                        <p>Likviditet: {formatCurrency(d.prevX || 0)}</p>
                                    </div>
                                )}
                            </div>
                        );
                    }
                    return null;
                }}
            />

            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
            <ReferenceLine x={xMax/2} stroke="#94a3b8" strokeDasharray="3 3" />

            <Customized component={HistoryTrails} />

            <Scatter 
                name="Selskaper" 
                data={chartData} 
                shape={renderCustomNode}
                isAnimationActive={false} 
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RiskMatrix;
