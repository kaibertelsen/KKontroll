
import React, { useState, useEffect } from 'react';
import { ComputedCompanyData, ReportLogItem } from '../types';
import { formatCurrency } from '../constants';
import { ArrowLeft, Building2, User, History, TrendingUp, Target, Wallet, AlertCircle, Plus, Save, X, CheckCircle, Clock, Edit, Lock, Unlock, Trash2 } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, Line 
} from 'recharts';

interface CompanyDetailViewProps {
  company: ComputedCompanyData;
  reports: ReportLogItem[];
  userRole: 'controller' | 'leader';
  onBack: () => void;
  onReportSubmit: (report: any) => void;
  onApproveReport: (reportId: number) => void;
  onUnlockReport?: (reportId: number) => void; // New prop for unlocking
}

// Helper to generate simulated historical data based on current YTD values
const generateHistoryData = (company: ComputedCompanyData) => {
  const data = [];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov'];
  
  const monthlyBudget = company.budgetTotal / 12;
  const currentMonthIndex = 10; // Nov
  const avgResultPerMonth = company.resultYTD / currentMonthIndex;
  
  for (let i = 0; i <= currentMonthIndex; i++) {
    const variance = 0.8 + Math.random() * 0.4; 
    const result = Math.round(avgResultPerMonth * variance);
    const budget = Math.round(monthlyBudget);
    
    const prevResult = i > 0 ? data[i-1].cumResult : 0;
    const prevBudget = i > 0 ? data[i-1].cumBudget : 0;

    const liquidity = Math.round(company.liquidity * (0.9 + Math.random() * 0.2));

    data.push({
      month: months[i],
      result: result,
      budget: budget,
      cumResult: prevResult + result,
      cumBudget: prevBudget + budget,
      liquidity: liquidity
    });
  }
  data[data.length - 1].cumResult = company.resultYTD;
  data[data.length - 1].liquidity = company.liquidity;
  return data;
};

const CompanyDetailView: React.FC<CompanyDetailViewProps> = ({ company, reports, userRole, onBack, onReportSubmit, onApproveReport, onUnlockReport }) => {
  const historyData = generateHistoryData(company);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<ReportLogItem | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
      resultYTD: company.resultYTD,
      liquidity: company.liquidity,
      comment: '',
      source: 'Manuell',
      reportDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
      if (editingReport) {
          setFormData({
              resultYTD: editingReport.result,
              liquidity: editingReport.liquidity,
              comment: editingReport.comment,
              source: editingReport.source,
              reportDate: editingReport.date // Assuming logic to parse back to YYYY-MM-DD if needed
          });
      } else {
          setFormData({
            resultYTD: company.resultYTD,
            liquidity: company.liquidity,
            comment: '',
            source: 'Manuell',
            reportDate: new Date().toISOString().split('T')[0]
        });
      }
  }, [editingReport, company, isReportModalOpen]);

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      // If editing, pass ID, otherwise just data
      const payload = editingReport ? { ...formData, id: editingReport.id } : formData;
      
      onReportSubmit(payload);
      setIsReportModalOpen(false);
      setEditingReport(null);
  };

  const handleOpenNewReport = () => {
      setEditingReport(null);
      setIsReportModalOpen(true);
  };

  const handleEditReport = (report: ReportLogItem) => {
      setEditingReport(report);
      setIsReportModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 animate-in slide-in-from-right-4 duration-500 text-slate-900 dark:text-slate-100">
      
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-sky-600 text-white p-2 rounded-lg">
                 <Building2 size={20} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{company.name}</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">Firmaside</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end text-sm mr-2">
                <span className="text-slate-900 dark:text-white font-medium">{company.manager}</span>
                <span className="text-slate-500 dark:text-slate-400 text-xs">Daglig leder</span>
            </div>
            
            {/* Removed Top Buttons as requested */}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Top Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 text-slate-500 mb-2">
                    <TrendingUp className="w-4 h-4" />
                    <span className="text-sm font-medium uppercase tracking-wider">Resultat YTD</span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(company.resultYTD)}</p>
                <p className="text-xs text-slate-400 mt-1">Akkumulert hittil i år</p>
            </div>
            
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 text-slate-500 mb-2">
                    <Target className="w-4 h-4" />
                    <span className="text-sm font-medium uppercase tracking-wider">Budsjett YTD</span>
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(Math.round(company.calculatedBudgetYTD))}</p>
                <p className="text-xs text-slate-400 mt-1">Årsbudsjett: {formatCurrency(company.budgetTotal)}</p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                 <div className="flex items-center gap-2 text-slate-500 mb-2">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-sm font-medium uppercase tracking-wider">Avvik</span>
                </div>
                <p className={`text-2xl font-bold ${company.calculatedDeviationPercent < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {company.calculatedDeviationPercent > 0 ? '+' : ''}{company.calculatedDeviationPercent.toFixed(1)}%
                </p>
                <p className="text-xs text-slate-400 mt-1">I forhold til budsjettmål</p>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2 text-slate-500 mb-2">
                    <Wallet className="w-4 h-4" />
                    <span className="text-sm font-medium uppercase tracking-wider">Likviditet</span>
                </div>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(company.liquidity)}</p>
                <p className="text-xs text-slate-400 mt-1">Pr. {company.liquidityDate}</p>
            </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Resultatutvikling (Akkumulert)</h3>
                <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={historyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorResult" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(val) => `${(val/1000).toFixed(0)}k`} tickLine={false} axisLine={false} />
                            <Tooltip 
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                formatter={(value: number) => formatCurrency(value)}
                            />
                            <Legend />
                            <Area type="monotone" dataKey="cumResult" name="Resultat (Akk)" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorResult)" strokeWidth={2} />
                            <Line type="monotone" dataKey="cumBudget" name="Budsjett (Akk)" stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={2} dot={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

             <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Historisk Likviditet</h3>
                <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={historyData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(val) => `${(val/1000).toFixed(0)}k`} tickLine={false} axisLine={false} />
                            <Tooltip 
                                cursor={{fill: '#f8fafc'}}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                formatter={(value: number) => formatCurrency(value)}
                            />
                            <Bar dataKey="liquidity" name="Likviditet" fill="#10b981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>

        {/* Reporting History List */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-slate-500" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Rapporteringslogg</h3>
                </div>
                <button 
                    onClick={handleOpenNewReport}
                    className="bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm flex items-center gap-2 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Ny Rapport
                </button>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {reports.length === 0 && (
                    <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm italic">Ingen rapporter funnet.</div>
                )}
                {reports.map((report) => {
                    const isApproved = report.status === 'approved';
                    const isTripletex = report.source === 'Tripletex';

                    return (
                    <div key={report.id} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-2">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${isTripletex ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-slate-100 dark:bg-slate-700'}`}>
                                    {isTripletex ? (
                                        <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    ) : (
                                        <User className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                                    )}
                                </div>
                                <div>
                                    {isTripletex ? (
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-slate-900 dark:text-white">Tripletex</span>
                                            <span className="text-xs text-slate-500">{report.date}</span>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">{report.author}</p>
                                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                <span>{report.date}</span>
                                                <span>•</span>
                                                <span className="bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 font-medium">{report.source}</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right hidden sm:block">
                                    <div className="text-xs text-slate-400 uppercase tracking-wider font-medium">Resultat / Likviditet</div>
                                    <div className="text-sm font-mono font-bold text-slate-700 dark:text-slate-300">
                                        {formatCurrency(report.result)} / <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(report.liquidity)}</span>
                                    </div>
                                </div>
                                
                                {isApproved ? (
                                    <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 cursor-help" title={`Godkjent av ${report.approvedBy || 'Ukjent'} ${report.approvedAt ? 'den ' + report.approvedAt : ''}`}>
                                            <CheckCircle size={12} className="mr-1" /> Godkjent
                                        </span>
                                        {userRole === 'controller' && onUnlockReport && (
                                            <button 
                                                onClick={() => onUnlockReport(report.id)}
                                                className="p-1.5 text-slate-400 hover:text-amber-600 transition-colors"
                                                title="Lås opp rapport"
                                            >
                                                <Unlock size={14} />
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                                            <Clock size={12} className="mr-1" /> Til godkjenning
                                        </span>
                                        {userRole === 'controller' ? (
                                            <button 
                                                onClick={() => onApproveReport(report.id)}
                                                className="text-xs bg-sky-600 hover:bg-sky-500 text-white px-2 py-1 rounded transition-colors"
                                            >
                                                Godkjenn
                                            </button>
                                        ) : null}
                                        
                                        {/* Edit button active for everyone if not approved yet */}
                                        <button 
                                            onClick={() => handleEditReport(report)}
                                            className="p-1.5 text-slate-400 hover:text-sky-600 transition-colors"
                                            title="Rediger rapport"
                                        >
                                            <Edit size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="pl-0 sm:pl-12 mt-2">
                            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed italic">"{report.comment}"</p>
                        </div>
                    </div>
                )})}
            </div>
        </div>

        {/* Modal */}
        {isReportModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                    <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                            {editingReport ? 'Rediger Rapport' : 'Ny Rapport'}
                        </h3>
                        <button onClick={() => setIsReportModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Resultat YTD</label>
                                <input type="number" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white" 
                                    value={formData.resultYTD} onChange={e => setFormData({...formData, resultYTD: Number(e.target.value)})} />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Likviditet</label>
                                <input type="number" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white" 
                                    value={formData.liquidity} onChange={e => setFormData({...formData, liquidity: Number(e.target.value)})} />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Kilde</label>
                            <select 
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white"
                                value={formData.source}
                                onChange={e => setFormData({...formData, source: e.target.value})}
                            >
                                <option value="Manuell">Manuell</option>
                                <option value="Tripletex">Tripletex</option>
                                <option value="PowerOffice">PowerOffice</option>
                                <option value="Visma">Visma</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Kommentar</label>
                            <textarea rows={3} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white" 
                                value={formData.comment} onChange={e => setFormData({...formData, comment: e.target.value})} placeholder="Beskriv status..." />
                        </div>
                        <div className="flex justify-end pt-4">
                            <button type="submit" className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold shadow-md flex items-center gap-2">
                                <Save size={16} /> 
                                {editingReport ? 'Lagre endringer' : 'Send Rapport'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default CompanyDetailView;
