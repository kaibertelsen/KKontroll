
import React from 'react';
import { 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell, Label, LabelList 
} from 'recharts';
import { ComputedCompanyData } from '../types';
import { formatCurrency } from '../constants';

interface RiskMatrixProps {
  data: ComputedCompanyData[];
}

const RiskMatrix: React.FC<RiskMatrixProps> = ({ data }) => {
  
  // Transform data for the scatter plot
  const chartData = data.map(c => ({
    ...c,
    x: c.liquidity, // X-axis: Liquidity (Cash buffer)
    y: c.calculatedDeviationPercent, // Y-axis: Deviation (Performance)
    z: 1 // Uniform size
  }));

  const xMax = Math.max(...chartData.map(d => d.x)) * 1.1;

  // Custom Shape Renderer for the Scatter Plot
  const renderCustomNode = (props: any) => {
    const { cx, cy, payload } = props;
    const isLowLiquidity = payload.x < 300000;
    const isNegativeDeviation = payload.y < 0;
    
    let fill = '#f59e0b'; // Warning/Neutral (Yellow/Orange)
    if (isNegativeDeviation && isLowLiquidity) fill = '#f43f5e'; // Danger (Red)
    else if (!isNegativeDeviation && !isLowLiquidity) fill = '#10b981'; // Good (Green)

    // Get initials (max 3 chars)
    const initials = payload.name.substring(0, 3).toUpperCase();

    return (
      <g>
        <circle cx={cx} cy={cy} r={18} fill={fill} stroke="white" strokeWidth={2} className="shadow-md drop-shadow-md" />
        <text x={cx} y={cy} dy={4} textAnchor="middle" fill="white" fontSize={10} fontWeight="bold" style={{ pointerEvents: 'none' }}>
            {initials}
        </text>
      </g>
    );
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Risiko-Matrise (Konsern)</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Plassering basert på Likviditet (X) vs Avvik fra budsjett (Y)</p>
          </div>
          <div className="hidden md:flex gap-4 text-xs font-medium">
             <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-rose-500"></div><span>Høy Risiko</span></div>
             <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-emerald-500"></div><span>Lav Risiko</span></div>
          </div>
      </div>
      
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            
            {/* X Axis: Liquidity */}
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

            {/* Y Axis: Deviation */}
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
                            </div>
                        );
                    }
                    return null;
                }}
            />

            {/* Reference Lines to create Quadrants */}
            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
            <ReferenceLine x={xMax/2} stroke="#94a3b8" strokeDasharray="3 3" />

            {/* Companies with Custom Shape */}
            <Scatter 
                name="Selskaper" 
                data={chartData} 
                shape={renderCustomNode}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default RiskMatrix;
