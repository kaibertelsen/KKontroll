
import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine, LabelList, Label 
} from 'recharts';
import { ComputedCompanyData } from '../types';
import { formatCurrency } from '../constants';
import RiskMatrix from './RiskMatrix';
import { Percent, TrendingDown, TrendingUp } from 'lucide-react';

interface AnalyticsViewProps {
  data: ComputedCompanyData[];
}

const AnalyticsView: React.FC<AnalyticsViewProps> = ({ data }) => {
  const [benchmarkMode, setBenchmarkMode] = useState<'margin' | 'cost'>('margin');

  // --- KPI CALCULATIONS ---
  const benchmarkData = useMemo(() => {
      const processed = data.map(c => {
          const margin = c.revenue > 0 ? (c.resultYTD / c.revenue) * 100 : 0;
          const costRatio = c.revenue > 0 ? (c.expenses / c.revenue) * 100 : 0;
          return {
              name: c.name,
              manager: c.manager,
              margin: parseFloat(margin.toFixed(1)),
              costRatio: parseFloat(costRatio.toFixed(1)),
              revenue: c.revenue,
              result: c.resultYTD
          };
      });

      // Sort based on active mode
      if (benchmarkMode === 'margin') {
          return processed.sort((a, b) => b.margin - a.margin); // High margin first
      } else {
          return processed.sort((a, b) => b.costRatio - a.costRatio); // High costs first (usually bad, but good to see top spenders)
      }
  }, [data, benchmarkMode]);

  // Calculate Group Average
  const groupAverage = useMemo(() => {
      const totalRev = data.reduce((acc, c) => acc + c.revenue, 0);
      const totalRes = data.reduce((acc, c) => acc + c.resultYTD, 0);
      const totalExp = data.reduce((acc, c) => acc + c.expenses, 0);
      
      if (totalRev === 0) return 0;
      
      if (benchmarkMode === 'margin') return (totalRes / totalRev) * 100;
      return (totalExp / totalRev) * 100;
  }, [data, benchmarkMode]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Risk Matrix - Strategic Overview */}
      <RiskMatrix data={data} />

      {/* NEW: KPI Benchmarking Section */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
              <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Nøkkeltall Sammenligning</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                      {benchmarkMode === 'margin' 
                          ? 'Hvor stor andel av omsetningen blir igjen som resultat?' 
                          : 'Hvor stor andel av omsetningen går til kostnader?'}
                  </p>
              </div>
              
              <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                  <button 
                      onClick={() => setBenchmarkMode('margin')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-2 transition-all ${benchmarkMode === 'margin' ? 'bg-white dark:bg-slate-600 text-emerald-600 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                  >
                      <TrendingUp size={14} /> Resultatgrad
                  </button>
                  <button 
                      onClick={() => setBenchmarkMode('cost')}
                      className={`px-3 py-1.5 text-xs font-bold rounded-md flex items-center gap-2 transition-all ${benchmarkMode === 'cost' ? 'bg-white dark:bg-slate-600 text-rose-600 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                  >
                      <TrendingDown size={14} /> Kostnadsandel
                  </button>
              </div>
          </div>

          <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                      data={benchmarkData}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                  >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" stroke="#94a3b8" fontSize={12} tickFormatter={(val) => `${val}%`} />
                      <YAxis dataKey="name" type="category" width={50} stroke="#64748b" fontSize={12} fontWeight="bold" tickLine={false} axisLine={false} />
                      <Tooltip 
                          cursor={{fill: '#f8fafc'}}
                          content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                  const d = payload[0].payload;
                                  return (
                                      <div className="bg-white dark:bg-slate-700 p-3 border border-slate-200 dark:border-slate-600 shadow-lg rounded-lg text-xs">
                                          <p className="font-bold text-slate-900 dark:text-white mb-1">{d.name} ({d.manager})</p>
                                          {benchmarkMode === 'margin' ? (
                                              <>
                                                  <p className="text-emerald-600 font-bold mb-1">Resultatgrad: {d.margin}%</p>
                                                  <p className="text-slate-500 dark:text-slate-400">Resultat: {formatCurrency(d.result)}</p>
                                                  <p className="text-slate-500 dark:text-slate-400">Omsetning: {formatCurrency(d.revenue)}</p>
                                              </>
                                          ) : (
                                              <p className="text-rose-600 font-bold">Kostnadsandel: {d.costRatio}%</p>
                                          )}
                                      </div>
                                  );
                              }
                              return null;
                          }}
                      />
                      <ReferenceLine x={groupAverage} stroke="#64748b" strokeDasharray="3 3">
                          <Label position="top" value={`Snitt: ${groupAverage.toFixed(1)}%`} fill="#64748b" fontSize={10} />
                      </ReferenceLine>
                      <Bar dataKey={benchmarkMode === 'margin' ? 'margin' : 'costRatio'} barSize={20} radius={[0, 4, 4, 0]}>
                          {benchmarkData.map((entry, index) => {
                              let color = '#94a3b8';
                              if (benchmarkMode === 'margin') {
                                  // Green if above average, yellow/red if below
                                  color = entry.margin >= groupAverage ? '#10b981' : (entry.margin > 0 ? '#f59e0b' : '#f43f5e');
                              } else {
                                  // For costs: Red if above average (bad), Green if below (efficient)
                                  color = entry.costRatio > groupAverage ? '#f43f5e' : '#10b981';
                              }
                              return <Cell key={`cell-${index}`} fill={color} />;
                          })}
                          <LabelList dataKey={benchmarkMode === 'margin' ? 'margin' : 'costRatio'} position="right" formatter={(val: number) => `${val}%`} fontSize={11} fill="#64748b" fontWeight="bold" />
                      </Bar>
                  </BarChart>
              </ResponsiveContainer>
          </div>
      </div>

      {/* Primary Chart: Result vs Budget (Existing) */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Resultat vs Budsjett (YTD)</h3>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis 
                stroke="#64748b" 
                fontSize={12} 
                tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} 
                tickLine={false} 
                axisLine={false} 
              />
              <Tooltip 
                cursor={{ fill: '#f1f5f9' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number) => [formatCurrency(value), '']}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar dataKey="calculatedBudgetYTD" name="Budsjett" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={50} />
              <Bar dataKey="resultYTD" name="Resultat" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={50} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Secondary Charts Grid (Existing) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Liquidity Chart */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Likviditetsoversikt</h3>
          <div className="h-[300px] w-full">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} layout="vertical" margin={{ left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0"/>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={40} tickLine={false} axisLine={false} stroke="#64748b" fontWeight={500} />
                    <Tooltip 
                        cursor={{fill: 'transparent'}}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: number) => formatCurrency(value)}
                    />
                    <Bar dataKey="liquidity" name="Likviditet" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
             </ResponsiveContainer>
          </div>
        </div>

        {/* Deviation Chart */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Avvik %</h3>
            <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={12} tickFormatter={(val) => `${val}%`} tickLine={false} axisLine={false}/>
                    <ReferenceLine y={0} stroke="#94a3b8" />
                    <Tooltip 
                         contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="calculatedDeviationPercent" name="Avvik %" radius={[4, 4, 0, 0]}>
                    {data.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.calculatedDeviationPercent < 0 ? '#f43f5e' : '#10b981'} />
                    ))}
                    </Bar>
                </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

      </div>
    </div>
  );
};

export default AnalyticsView;
