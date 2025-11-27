import React, { useState, useEffect, useMemo } from 'react';
import { ComputedCompanyData, ReportLogItem, ForecastItem } from '../types';
import { formatCurrency } from '../constants';
import { ArrowLeft, Building2, User, History, TrendingUp, TrendingDown, Target, Wallet, AlertCircle, Plus, Save, X, CheckCircle, Clock, Edit, Unlock, BarChart3, ArrowUpRight, ArrowDownRight, Activity, LineChart, Calendar, Trash2, Eye } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area, Line, ComposedChart 
} from 'recharts';

interface CompanyDetailViewProps {
  company: ComputedCompanyData;
  reports: ReportLogItem[];
  forecasts: ForecastItem[];
  userRole: 'controller' | 'leader';
  onBack: () => void;
  onReportSubmit: (report: any) => void;
  onApproveReport: (reportId: number) => void;
  onUnlockReport?: (reportId: number) => void; 
  onDeleteReport: (reportId: number) => void; 
  onForecastSubmit: (forecasts: ForecastItem[]) => void;
}

// Helper to convert DD.MM.YYYY to YYYY-MM-DD for input[type="date"]
const toInputDate = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('-')) return dateStr; 
    const parts = dateStr.split('.');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return '';
};

// Helper to convert YYYY-MM-DD back to DD.MM.YYYY for display/storage
const fromInputDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const CompanyDetailView: React.FC<CompanyDetailViewProps> = ({ company, reports, forecasts, userRole, onBack, onReportSubmit, onApproveReport, onUnlockReport, onDeleteReport, onForecastSubmit }) => {
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<ReportLogItem | null>(null);
  
  const [isForecastModalOpen, setIsForecastModalOpen] = useState(false);
  const [forecastForm, setForecastForm] = useState<ForecastItem[]>([]);

  // --- HISTORY CHART DATA GENERATION ---
  const historyData = useMemo(() => {
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
          liquidity: liquidity,
          type: 'history'
        });
      }
      // Force last point to match actuals
      data[data.length - 1].cumResult = company.resultYTD;
      data[data.length - 1].liquidity = company.liquidity;
      return data;
  }, [company]);

  // --- FORECAST CHART DATA PREPARATION ---
  const forecastChartData = useMemo(() => {
      const combinedData = historyData.map(d => ({
          name: d.month,
          liquidity: d.liquidity,
          forecast: null as number | null,
          type: 'history'
      }));

      const now = new Date();
      let runningLiquidity = company.liquidity; 

      const futureData = [];
      for (let i = 1; i <= 6; i++) {
          const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
          const monthStr = futureDate.toISOString().slice(0, 7); 
          const monthName = futureDate.toLocaleString('no-NO', { month: 'short' });
          
          const forecastItem = forecasts.find(f => f.month === monthStr);
          const estIn = forecastItem ? forecastItem.estimatedReceivables : 0;
          const estOut = forecastItem ? forecastItem.estimatedPayables : 0;
          
          runningLiquidity = runningLiquidity + estIn - estOut;

          futureData.push({
              name: monthName,
              liquidity: null as number | null,
              forecast: runningLiquidity,
              type: 'forecast'
          });
      }

      if(futureData.length > 0) {
          const lastHistory = combinedData[combinedData.length - 1];
          lastHistory.forecast = lastHistory.liquidity;
      }

      return [...combinedData, ...futureData];
  }, [historyData, company.liquidity, forecasts]);


  const statusValue = (company.receivables - company.accountsPayable) + company.liquidity;

  // --- REPORTING FORM LOGIC ---
  const [reportingMode, setReportingMode] = useState<'ytd' | 'monthly'>('ytd');
  
  const [formData, setFormData] = useState<{
      revenue: string | number;
      expenses: string | number;
      resultYTD: string | number;
      pnlDate: string; 
      liquidity: string | number;
      receivables: string | number;
      accountsPayable: string | number;
      liquidityDate: string;
      receivablesDate: string;
      accountsPayableDate: string;
      comment: string;
      source: string;
      reportDate: string;
  }>({
      revenue: '',
      expenses: '',
      resultYTD: '',
      pnlDate: new Date().toLocaleDateString('no-NO'), 
      liquidity: '',
      receivables: '',
      accountsPayable: '',
      liquidityDate: new Date().toLocaleDateString('no-NO'),
      receivablesDate: new Date().toLocaleDateString('no-NO'),
      accountsPayableDate: new Date().toLocaleDateString('no-NO'),
      comment: '',
      source: 'Manuell',
      reportDate: new Date().toISOString().split('T')[0]
  });

  const [monthlyInputs, setMonthlyInputs] = useState({
      revenue: '',
      expenses: ''
  });

  // READ-ONLY MODE CHECK
  const isReadOnly = editingReport?.status === 'approved';

  useEffect(() => {
      if (reportingMode === 'ytd') {
          const rev = Number(formData.revenue) || 0;
          const exp = Number(formData.expenses) || 0;
          if (formData.revenue === '' && formData.expenses === '') {
              setFormData(prev => ({ ...prev, resultYTD: 0 }));
          } else {
              setFormData(prev => ({ ...prev, resultYTD: rev - exp }));
          }
      } else {
          const mRev = Number(monthlyInputs.revenue) || 0;
          const mExp = Number(monthlyInputs.expenses) || 0;
          
          const newTotalRevenue = company.revenue + mRev;
          const newTotalExpenses = company.expenses + mExp;
          
          setFormData(prev => ({
              ...prev,
              revenue: newTotalRevenue,
              expenses: newTotalExpenses,
              resultYTD: newTotalRevenue - newTotalExpenses
          }));
      }
  }, [formData.revenue, formData.expenses, monthlyInputs, reportingMode, company.revenue, company.expenses]);

  useEffect(() => {
      if (editingReport) {
          setReportingMode('ytd'); 
          setFormData({
              revenue: editingReport.revenue ?? '',
              expenses: editingReport.expenses ?? '',
              resultYTD: editingReport.result ?? '',
              pnlDate: editingReport.pnlDate || new Date().toLocaleDateString('no-NO'),

              liquidity: editingReport.liquidity ?? '',
              receivables: editingReport.receivables ?? '',
              accountsPayable: editingReport.accountsPayable ?? '',
              
              liquidityDate: editingReport.liquidityDate || new Date().toLocaleDateString('no-NO'),
              receivablesDate: editingReport.receivablesDate || new Date().toLocaleDateString('no-NO'),
              accountsPayableDate: editingReport.accountsPayableDate || new Date().toLocaleDateString('no-NO'),
              
              comment: editingReport.comment,
              source: editingReport.source,
              reportDate: editingReport.date 
          });
      } else {
          setReportingMode('ytd');
          setMonthlyInputs({ revenue: '', expenses: '' });
          setFormData({
            revenue: '',
            expenses: '',
            resultYTD: '',
            pnlDate: new Date().toLocaleDateString('no-NO'),
            liquidity: '',
            receivables: '',
            accountsPayable: '',
            liquidityDate: new Date().toLocaleDateString('no-NO'),
            receivablesDate: new Date().toLocaleDateString('no-NO'),
            accountsPayableDate: new Date().toLocaleDateString('no-NO'),
            comment: '',
            source: 'Manuell',
            reportDate: new Date().toISOString().split('T')[0]
        });
      }
  }, [editingReport, isReportModalOpen]);

  // --- FORECAST MODAL LOGIC ---
  useEffect(() => {
      if(isForecastModalOpen) {
          const next6Months = [];
          const now = new Date();
          for (let i = 1; i <= 6; i++) {
              const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
              const monthStr = futureDate.toISOString().slice(0, 7); 
              
              const existing = forecasts.find(f => f.month === monthStr);
              
              next6Months.push({
                  id: existing?.id, 
                  companyId: company.id,
                  month: monthStr,
                  monthName: futureDate.toLocaleString('no-NO', { month: 'long', year: 'numeric' }),
                  estimatedReceivables: existing ? existing.estimatedReceivables : 0,
                  estimatedPayables: existing ? existing.estimatedPayables : 0,
              });
          }
          setForecastForm(next6Months);
      }
  }, [isForecastModalOpen, company.id, forecasts]);

  const handleForecastChange = (index: number, field: 'estimatedReceivables' | 'estimatedPayables', value: number) => {
      const updated = [...forecastForm];
      updated[index] = { ...updated[index], [field]: value };
      setForecastForm(updated);
  };

  const submitForecast = (e: React.FormEvent) => {
      e.preventDefault();
      onForecastSubmit(forecastForm);
      setIsForecastModalOpen(false);
  };


  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (isReadOnly) return; // Prevent submit in read-only mode
      
      const payload = {
          ...formData,
          revenue: formData.revenue === '' ? undefined : Number(formData.revenue),
          expenses: formData.expenses === '' ? undefined : Number(formData.expenses),
          resultYTD: formData.resultYTD === '' ? undefined : Number(formData.resultYTD),
          liquidity: formData.liquidity === '' ? undefined : Number(formData.liquidity),
          receivables: formData.receivables === '' ? undefined : Number(formData.receivables),
          accountsPayable: formData.accountsPayable === '' ? undefined : Number(formData.accountsPayable),
          id: editingReport ? editingReport.id : undefined
      };
      
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

  const StatCard = ({ icon: Icon, label, value, subText, highlight, valueColor }: any) => (
    <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between h-full">
        <div>
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
                <Icon size={16} />
                <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
            </div>
            <p className={`text-2xl font-bold tabular-nums ${valueColor ? valueColor : 'text-slate-900 dark:text-white'}`}>
                {formatCurrency(value)}
            </p>
        </div>
        {subText && (
            <p className={`text-xs mt-2 ${highlight ? (highlight > 0 ? 'text-emerald-600' : 'text-rose-600') : 'text-slate-400'}`}>
                {subText}
            </p>
        )}
    </div>
  );

  const renderReportValues = (report: ReportLogItem) => {
      const items = [];
      if (report.result != null) items.push({ label: 'Resultat', value: report.result });
      if (report.liquidity != null) items.push({ label: 'Likviditet', value: report.liquidity });
      if (report.revenue != null) items.push({ label: 'Omsetning', value: report.revenue });
      if (report.receivables != null) items.push({ label: 'Fordringer', value: report.receivables });
      if (report.accountsPayable != null) items.push({ label: 'Gjeld', value: report.accountsPayable });

      if (items.length === 0) return <span className="text-sm text-slate-400 italic">Ingen tall rapportert</span>;

      return (
          <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 max-w-md">
              {items.map((item, idx) => (
                  <div key={idx} className="text-sm">
                      <span className="text-xs text-slate-400 uppercase tracking-wider mr-1">{item.label}:</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{formatCurrency(item.value)}</span>
                  </div>
              ))}
          </div>
      );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 animate-in slide-in-from-right-4 duration-500 text-slate-900 dark:text-slate-100">
      
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
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Top Stats Grid */}
        <div className="space-y-4 mb-8">
            {/* Row 1: P&L */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={TrendingUp} label="Omsetning YTD" value={company.revenue} />
                <StatCard icon={TrendingDown} label="Kostnader YTD" value={company.expenses} />
                <StatCard icon={BarChart3} label="Resultat YTD" value={company.resultYTD} subText={`Avvik ${company.calculatedDeviationPercent > 0 ? '+' : ''}${company.calculatedDeviationPercent.toFixed(1)}%`} highlight={company.calculatedDeviationPercent}/>
                <StatCard icon={Target} label="Budsjett YTD" value={Math.round(company.calculatedBudgetYTD)} subText={`Årsbudsjett: ${formatCurrency(company.budgetTotal)}`} />
            </div>

            {/* Row 2: Liquidity & Balance */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={Wallet} label="Likviditet" value={company.liquidity} subText={company.liquidityDate} />
                <StatCard icon={ArrowUpRight} label="Fordringer" value={company.receivables} subText={company.receivablesDate} />
                <StatCard icon={ArrowDownRight} label="Leverandørgjeld" value={company.accountsPayable} subText={company.accountsPayableDate} />
                <StatCard icon={Activity} label="Netto Arbeidskapital" value={statusValue} valueColor="text-sky-600 dark:text-sky-400" subText="Likviditet + (Fordringer - Gjeld)" />
            </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            
            {/* Resultat Graf */}
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
                            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value: number) => formatCurrency(value)} />
                            <Legend />
                            <Area type="monotone" dataKey="cumResult" name="Resultat (Akk)" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorResult)" strokeWidth={2} />
                            <Line type="monotone" dataKey="cumBudget" name="Budsjett (Akk)" stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={2} dot={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

             {/* Likviditet Prognose Graf */}
             <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 relative">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Likviditetsprognose</h3>
                    <button 
                        onClick={() => setIsForecastModalOpen(true)}
                        className="text-xs bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 px-2 py-1 rounded flex items-center gap-1 transition-colors"
                    >
                        <Edit size={12} /> Rediger Prognose
                    </button>
                </div>
                <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={forecastChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(val) => `${(val/1000).toFixed(0)}k`} tickLine={false} axisLine={false} />
                            <Tooltip 
                                cursor={{fill: '#f8fafc'}}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                formatter={(value: number) => formatCurrency(value)}
                            />
                            <Legend />
                            {/* History Area */}
                            <Area type="monotone" dataKey="liquidity" name="Historisk" fill="#10b981" stroke="#10b981" fillOpacity={0.3} />
                            {/* Forecast Line */}
                            <Line type="monotone" dataKey="forecast" name="Prognose" stroke="#f59e0b" strokeDasharray="5 5" strokeWidth={2} dot={{r: 4}} />
                        </ComposedChart>
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
                    <div key={report.id} className="p-6 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group">
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
                                            <span className="text-xs text-slate-500">Sendt: {report.date}</span>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">{report.author}</p>
                                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                <span>Sendt: {report.date}</span>
                                                {report.pnlDate && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="font-semibold text-slate-600 dark:text-slate-300">Tall pr: {report.pnlDate}</span>
                                                    </>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                
                                <div className="hidden sm:block text-right">
                                    {renderReportValues(report)}
                                </div>
                                
                                {isApproved ? (
                                    <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 cursor-help" title={`Godkjent av ${report.approvedBy || 'Ukjent'} ${report.approvedAt ? 'den ' + report.approvedAt : ''}`}>
                                            <CheckCircle size={12} className="mr-1" /> Godkjent
                                        </span>
                                        
                                        {/* VIEW BUTTON for Approved Reports */}
                                        <button 
                                            onClick={() => handleEditReport(report)}
                                            className="p-1.5 text-slate-400 hover:text-sky-600 transition-colors"
                                            title="Se rapport"
                                        >
                                            <Eye size={14} />
                                        </button>

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
                                        
                                        <button 
                                            onClick={() => handleEditReport(report)}
                                            className="p-1.5 text-slate-400 hover:text-sky-600 transition-colors"
                                            title="Rediger rapport"
                                        >
                                            <Edit size={14} />
                                        </button>
                                        
                                        {/* DELETE BUTTON FOR UNAPPROVED REPORTS */}
                                        <button 
                                            onClick={() => onDeleteReport(report.id)}
                                            className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                                            title="Slett rapport"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="pl-0 sm:pl-12 mt-2">
                            <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed italic">"{report.comment}"</p>
                        </div>
                    </div>
                    );
                })}
            </div>
        </div>

        {/* Report Modal */}
        {isReportModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                            {isReadOnly ? 'Vis Rapport' : (editingReport ? 'Rediger Rapport' : 'Ny Rapport')}
                        </h3>
                        <button onClick={() => setIsReportModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    
                    {/* Reporting Mode Toggle (Only for New Reports and NOT ReadOnly) */}
                    {!editingReport && !isReadOnly && (
                        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-700/30 border-b border-slate-200 dark:border-slate-700 flex justify-center">
                            <div className="bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-600 flex shadow-sm">
                                <button 
                                    type="button" 
                                    onClick={() => setReportingMode('ytd')}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${reportingMode === 'ytd' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                                >
                                    Akkumulert (YTD)
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => setReportingMode('monthly')}
                                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${reportingMode === 'monthly' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                                >
                                    Legg til Månedstall
                                </button>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        
                        {/* SECTION 1: P&L */}
                        <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl border border-slate-200 dark:border-slate-600 transition-all">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                    <TrendingUp size={14}/> Drift & Resultat {reportingMode === 'monthly' ? '(Denne Måned)' : '(Hittil i år)'}
                                </h4>
                                
                                {/* P&L Date Field INTEGRATED IN HEADER */}
                                <div className="flex items-center gap-2">
                                     <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500"><Calendar size={10} className="inline mr-0.5"/> Dato tall:</span>
                                     <input 
                                        type="date" 
                                        disabled={isReadOnly}
                                        className="bg-transparent text-right text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-slate-300 dark:border-slate-600 focus:border-sky-500 outline-none w-24 disabled:opacity-70"
                                        value={toInputDate(formData.pnlDate)} 
                                        onChange={e => setFormData({...formData, pnlDate: fromInputDate(e.target.value)})} 
                                    />
                                </div>
                            </div>
                            
                            {reportingMode === 'monthly' && !isReadOnly && (
                                <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-xs text-blue-700 dark:text-blue-300">
                                    <p className="font-bold mb-1">Månedlig Modus:</p>
                                    <p>Legg inn tallene for <strong>denne måneden</strong>. Vi legger dem automatisk til de eksisterende tallene.</p>
                                    <div className="mt-2 grid grid-cols-2 gap-4 font-mono">
                                        <div>Forrige Omsetning: <strong>{formatCurrency(company.revenue)}</strong></div>
                                        <div>Forrige Kostnader: <strong>{formatCurrency(company.expenses)}</strong></div>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">
                                        {reportingMode === 'monthly' && !isReadOnly ? 'Mnd. Omsetning' : 'Omsetning YTD'}
                                    </label>
                                    <input 
                                        type="number" 
                                        disabled={isReadOnly}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm transition-all focus:ring-2 focus:ring-sky-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-700" 
                                        value={reportingMode === 'ytd' || isReadOnly ? formData.revenue : monthlyInputs.revenue} 
                                        onChange={e => reportingMode === 'ytd' ? setFormData({...formData, revenue: e.target.value}) : setMonthlyInputs({...monthlyInputs, revenue: e.target.value})} 
                                        placeholder="0" 
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">
                                        {reportingMode === 'monthly' && !isReadOnly ? 'Mnd. Kostnader' : 'Kostnader YTD'}
                                    </label>
                                    <input 
                                        type="number" 
                                        disabled={isReadOnly}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm transition-all focus:ring-2 focus:ring-sky-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-700" 
                                        value={reportingMode === 'ytd' || isReadOnly ? formData.expenses : monthlyInputs.expenses} 
                                        onChange={e => reportingMode === 'ytd' ? setFormData({...formData, expenses: e.target.value}) : setMonthlyInputs({...monthlyInputs, expenses: e.target.value})} 
                                        placeholder="0" 
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 mb-1 block">
                                        {reportingMode === 'monthly' && !isReadOnly ? 'Ny Resultat YTD' : 'Resultat YTD'}
                                    </label>
                                    {/* READ-ONLY FIELD, AUTO-CALCULATED */}
                                    <input 
                                        type="number" 
                                        readOnly
                                        className="w-full bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-500 dark:text-slate-400 text-sm font-bold cursor-not-allowed" 
                                        value={formData.resultYTD} 
                                        title="Resultat beregnes automatisk"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* SECTION 2: BALANCE */}
                        <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl border border-slate-200 dark:border-slate-600 space-y-4">
                            <h4 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2">
                                <Wallet size={14}/> Likviditet & Balanse (Nå-situasjon)
                            </h4>
                            
                            {/* Liquidity Row */}
                            <div className="grid grid-cols-2 gap-4 items-end">
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Likviditet (Bankinnskudd)</label>
                                    <input type="number" disabled={isReadOnly} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm font-mono disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-700" 
                                        value={formData.liquidity} onChange={e => setFormData({...formData, liquidity: e.target.value})} placeholder="0" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1"><Calendar size={10}/> Dato</label>
                                    <input 
                                        type="date" 
                                        disabled={isReadOnly}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-700" 
                                        value={toInputDate(formData.liquidityDate)} 
                                        onChange={e => setFormData({...formData, liquidityDate: fromInputDate(e.target.value)})} 
                                    />
                                </div>
                            </div>

                            {/* Receivables Row */}
                            <div className="grid grid-cols-2 gap-4 items-end">
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Kundefordringer</label>
                                    <input type="number" disabled={isReadOnly} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm font-mono disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-700" 
                                        value={formData.receivables} onChange={e => setFormData({...formData, receivables: e.target.value})} placeholder="0" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1"><Calendar size={10}/> Dato</label>
                                    <input 
                                        type="date" 
                                        disabled={isReadOnly}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-700" 
                                        value={toInputDate(formData.receivablesDate)} 
                                        onChange={e => setFormData({...formData, receivablesDate: fromInputDate(e.target.value)})} 
                                    />
                                </div>
                            </div>

                            {/* Payables Row */}
                            <div className="grid grid-cols-2 gap-4 items-end">
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Leverandørgjeld</label>
                                    <input type="number" disabled={isReadOnly} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm font-mono disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-700" 
                                        value={formData.accountsPayable} onChange={e => setFormData({...formData, accountsPayable: e.target.value})} placeholder="0" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1"><Calendar size={10}/> Dato</label>
                                    <input 
                                        type="date" 
                                        disabled={isReadOnly}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-700" 
                                        value={toInputDate(formData.accountsPayableDate)} 
                                        onChange={e => setFormData({...formData, accountsPayableDate: fromInputDate(e.target.value)})} 
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Meta Data */}
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Kilde</label>
                                <select 
                                    disabled={isReadOnly}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-700"
                                    value={formData.source}
                                    onChange={e => setFormData({...formData, source: e.target.value})}
                                >
                                    <option value="Manuell">Manuell registrering</option>
                                    <option value="Tripletex">Tripletex Eksport</option>
                                    <option value="PowerOffice">PowerOffice Eksport</option>
                                    <option value="Visma">Visma eAccounting</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Kommentar / Status</label>
                                <textarea rows={3} disabled={isReadOnly} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-700" 
                                    value={formData.comment} onChange={e => setFormData({...formData, comment: e.target.value})} placeholder="Kort beskrivelse av månedens status..." />
                            </div>
                        </div>

                        {!isReadOnly && (
                            <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
                                <button type="submit" className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold shadow-md flex items-center gap-2 transition-transform active:scale-95">
                                    <Save size={18} /> 
                                    {editingReport ? 'Lagre endringer' : 'Send inn rapport'}
                                </button>
                            </div>
                        )}
                    </form>
                </div>
            </div>
        )}

        {/* Forecast Modal */}
        {isForecastModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Likviditetsprognose</h3>
                        <button onClick={() => setIsForecastModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    <form onSubmit={submitForecast} className="p-6">
                        <div className="space-y-4">
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                Legg inn forventede innbetalinger (fordringer/salg) og utbetalinger (gjeld/kostnader) for de neste månedene.
                                Prognosen beregnes automatisk ut fra dagens likviditet.
                            </p>
                            
                            <div className="grid grid-cols-3 gap-4 mb-2">
                                <div className="text-xs font-bold uppercase text-slate-400">Måned</div>
                                <div className="text-xs font-bold uppercase text-emerald-600">Forventet Inn (+)</div>
                                <div className="text-xs font-bold uppercase text-rose-600">Forventet Ut (-)</div>
                            </div>

                            {forecastForm.map((item, index) => (
                                <div key={index} className="grid grid-cols-3 gap-4 items-center">
                                    <div className="font-medium text-slate-900 dark:text-white text-sm">
                                        {item.monthName}
                                    </div>
                                    <input 
                                        type="number" 
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm"
                                        value={item.estimatedReceivables}
                                        onChange={(e) => handleForecastChange(index, 'estimatedReceivables', Number(e.target.value))}
                                    />
                                    <input 
                                        type="number" 
                                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm"
                                        value={item.estimatedPayables}
                                        onChange={(e) => handleForecastChange(index, 'estimatedPayables', Number(e.target.value))}
                                    />
                                </div>
                            ))}
                        </div>
                        
                        <div className="flex justify-end pt-6 border-t border-slate-200 dark:border-slate-700 mt-6 gap-3">
                            <button type="button" onClick={() => setIsForecastModalOpen(false)} className="px-4 py-2 text-slate-600 dark:text-slate-300">Avbryt</button>
                            <button type="submit" className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold shadow-md flex items-center gap-2">
                                <Save size={16} /> Lagre Prognose
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