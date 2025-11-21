
import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine 
} from 'recharts';
import { ComputedCompanyData } from '../types';
import { formatCurrency } from '../constants';
import RiskMatrix from './RiskMatrix';

interface AnalyticsViewProps {
  data: ComputedCompanyData[];
}

const AnalyticsView: React.FC<AnalyticsViewProps> = ({ data }) => {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Risk Matrix - Strategic Overview */}
      <RiskMatrix data={data} />

      {/* Primary Chart: Result vs Budget */}
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

      {/* Secondary Charts Grid */}
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
