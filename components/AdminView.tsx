
import React, { useState, useEffect } from 'react';
import { CompanyData, ReportLogItem } from '../types';
import { formatCurrency } from '../constants';
import { Trash2, Edit, Plus, Save, X, AlertCircle, Calendar, BarChart2, Lock, FileText, Search, Filter, Building2, Eye, Unlock, CheckCircle, Clock, Wallet, TrendingUp, TrendingDown } from 'lucide-react';

interface AdminViewProps {
  companies: CompanyData[];
  allReports?: ReportLogItem[]; // New prop
  onAdd: (company: Omit<CompanyData, 'id'>) => void;
  onUpdate: (company: CompanyData) => void;
  onDelete: (id: number) => void;
  onLogoUpload?: (url: string) => void; 
  onViewReport: (report: ReportLogItem) => void; 
  onReportSubmit: (report: any) => void;
  onApproveReport: (reportId: number) => void;
  onUnlockReport: (reportId: number) => void;
  onDeleteReport: (reportId: number) => void;
}

// Helpers for Date Conversion (Same as CompanyDetailView)
const toInputDate = (dateStr: string) => {
    if (!dateStr) return '';
    if (dateStr.includes('-')) return dateStr;
    const parts = dateStr.split('.');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return '';
};

const fromInputDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const AdminView: React.FC<AdminViewProps> = ({ companies, allReports = [], onAdd, onUpdate, onDelete, onViewReport, onReportSubmit, onApproveReport, onUnlockReport, onDeleteReport }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyData | null>(null);
  const [activeTab, setActiveTab] = useState<'companies' | 'reports'>('companies');
  
  // Form State
  const [formData, setFormData] = useState<Partial<CompanyData>>({});

  // Reports Filter State
  const [reportFilter, setReportFilter] = useState('');
  const [reportSort, setReportSort] = useState<'date' | 'status'>('date');

  // Report Modal State (Added for Admin Editing)
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<ReportLogItem | null>(null);
  const [reportFormData, setReportFormData] = useState<any>({});
  const [reportingMode, setReportingMode] = useState<'ytd' | 'monthly'>('ytd');
  const [monthlyInputs, setMonthlyInputs] = useState({ revenue: '', expenses: '' });

  // Budget Editing State
  const [budgetInputMode, setBudgetInputMode] = useState<'annual' | 'quarterly' | 'monthly'>('annual');
  const [annualBudget, setAnnualBudget] = useState<number>(0);
  const [quarterlyBudget, setQuarterlyBudget] = useState<number[]>([0,0,0,0]);
  const [monthlyBudget, setMonthlyBudget] = useState<number[]>(Array(12).fill(0));

  useEffect(() => {
    if (editingCompany) {
      setFormData(editingCompany);
      setBudgetInputMode(editingCompany.budgetMode || 'annual');
      
      const existingMonths = editingCompany.budgetMonths || Array(12).fill(0);
      setMonthlyBudget([...existingMonths]);
      setAnnualBudget(editingCompany.budgetTotal || 0);
      
      const q = [0,0,0,0];
      for(let i=0; i<12; i++) q[Math.floor(i/3)] += existingMonths[i];
      setQuarterlyBudget(q);

    } else {
      setFormData({
        name: '',
        fullName: '',
        manager: 'Kai',
        revenue: 0,
        expenses: 0,
        resultYTD: 0,
        budgetTotal: 0,
        budgetMode: 'annual',
        budgetMonths: Array(12).fill(0),
        liquidity: 0,
        receivables: 0,
        accountsPayable: 0,
        liquidityDate: new Date().toLocaleDateString('no-NO'),
        receivablesDate: new Date().toLocaleDateString('no-NO'),
        accountsPayableDate: new Date().toLocaleDateString('no-NO'),
        lastReportDate: new Date().toLocaleDateString('no-NO'),
        lastReportBy: '',
        comment: '',
        trendHistory: 0
      });
      setBudgetInputMode('annual');
      setAnnualBudget(0);
      setQuarterlyBudget([0,0,0,0]);
      setMonthlyBudget(Array(12).fill(0));
    }
  }, [editingCompany, isModalOpen]);

  // --- REPORT MODAL LOGIC ---
  useEffect(() => {
      if (editingReport) {
          setReportingMode('ytd');
          setReportFormData({
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
              reportDate: editingReport.date,
              companyId: editingReport.companyId
          });
      }
  }, [editingReport, isReportModalOpen]);

  // Auto-calculate Result YTD in Report Modal
  useEffect(() => {
      if (reportingMode === 'ytd') {
          const rev = Number(reportFormData.revenue) || 0;
          const exp = Number(reportFormData.expenses) || 0;
          if (reportFormData.revenue === '' && reportFormData.expenses === '') {
             // keep empty/0
          } else {
              setReportFormData((prev: any) => ({ ...prev, resultYTD: rev - exp }));
          }
      } else {
           // Monthly mode logic requires company context which might be hard in Admin
           // We'll try to find the company
           const targetCompany = companies.find(c => c.id === editingReport?.companyId);
           if (targetCompany) {
                const mRev = Number(monthlyInputs.revenue) || 0;
                const mExp = Number(monthlyInputs.expenses) || 0;
                
                const newTotalRevenue = targetCompany.revenue + mRev;
                const newTotalExpenses = targetCompany.expenses + mExp;
                
                setReportFormData((prev: any) => ({
                    ...prev,
                    revenue: newTotalRevenue,
                    expenses: newTotalExpenses,
                    resultYTD: newTotalRevenue - newTotalExpenses
                }));
           }
      }
  }, [reportFormData.revenue, reportFormData.expenses, monthlyInputs, reportingMode, editingReport, companies]);


  const handleReportSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      const payload = {
          ...reportFormData,
          revenue: reportFormData.revenue === '' ? undefined : Number(reportFormData.revenue),
          expenses: reportFormData.expenses === '' ? undefined : Number(reportFormData.expenses),
          resultYTD: reportFormData.resultYTD === '' ? undefined : Number(reportFormData.resultYTD),
          liquidity: reportFormData.liquidity === '' ? undefined : Number(reportFormData.liquidity),
          receivables: reportFormData.receivables === '' ? undefined : Number(reportFormData.receivables),
          accountsPayable: reportFormData.accountsPayable === '' ? undefined : Number(reportFormData.accountsPayable),
          id: editingReport ? editingReport.id : undefined,
          companyId: editingReport ? editingReport.companyId : undefined // Ensure ID is passed
      };
      
      onReportSubmit(payload);
      setIsReportModalOpen(false);
      setEditingReport(null);
  };

  const openReportModal = (report: ReportLogItem) => {
      setEditingReport(report);
      setIsReportModalOpen(true);
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    let finalMonths = Array(12).fill(0);
    let finalTotal = 0;

    if (budgetInputMode === 'annual') {
        finalTotal = annualBudget;
        const perMonth = Math.round(annualBudget / 12);
        finalMonths = Array(12).fill(perMonth);
        const sum = perMonth * 12;
        const diff = annualBudget - sum;
        finalMonths[11] += diff;
    } else if (budgetInputMode === 'quarterly') {
        finalTotal = quarterlyBudget.reduce((a,b) => a+b, 0);
        for(let q=0; q<4; q++) {
            const qTotal = quarterlyBudget[q];
            const perMonth = Math.round(qTotal / 3);
            finalMonths[q*3] = perMonth;
            finalMonths[q*3+1] = perMonth;
            finalMonths[q*3+2] = qTotal - (perMonth * 2);
        }
    } else {
        finalMonths = [...monthlyBudget];
        finalTotal = finalMonths.reduce((a,b) => a+b, 0);
    }

    const companyPayload = {
        ...formData,
        budgetTotal: finalTotal,
        budgetMode: budgetInputMode,
        budgetMonths: finalMonths
    } as CompanyData;

    if (editingCompany) {
      onUpdate(companyPayload);
    } else {
      onAdd(companyPayload);
    }
    setIsModalOpen(false);
    setEditingCompany(null);
  };

  const openEditModal = (company: CompanyData) => {
    setEditingCompany(company);
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setEditingCompany(null);
    setIsModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Er du sikker på at du vil slette dette selskapet?')) {
      onDelete(id);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };
  
  const getCompanyName = (id: number) => companies.find(c => c.id === id)?.name || 'Ukjent';

  // Helper to render report values (Same as CompanyDetailView)
  const renderReportValues = (report: ReportLogItem) => {
      const items = [];
      if (report.result != null) items.push({ label: 'Resultat', value: report.result });
      if (report.liquidity != null) items.push({ label: 'Likviditet', value: report.liquidity });
      if (report.revenue != null) items.push({ label: 'Omsetning', value: report.revenue });
      
      if (items.length === 0) return <span className="text-xs text-slate-400 italic">Ingen tall</span>;

      return (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
              {items.map((item, idx) => (
                  <div key={idx} className="text-xs whitespace-nowrap">
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider mr-1">{item.label}:</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{formatCurrency(item.value)}</span>
                  </div>
              ))}
          </div>
      );
  };

  // Filter Reports
  const filteredReports = allReports.filter(r => {
      const cName = getCompanyName(r.companyId || 0).toLowerCase();
      const author = r.author.toLowerCase();
      const term = reportFilter.toLowerCase();
      return cName.includes(term) || author.includes(term);
  }).sort((a, b) => {
      if (reportSort === 'status') return a.status.localeCompare(b.status);
      // Date desc default
      const dA = new Date(a.date.split('.').reverse().join('-')).getTime();
      const dB = new Date(b.date.split('.').reverse().join('-')).getTime();
      return dB - dA;
  });

  const ReadOnlyInput = ({ label, value }: { label: string, value: any }) => (
    <div className="space-y-1 opacity-75">
        <label className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 flex items-center gap-1">
            <Lock size={10} /> {label}
        </label>
        <div className="w-full bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-500 dark:text-slate-400 font-mono text-sm cursor-not-allowed">
            {typeof value === 'number' ? formatCurrency(value) : value || '-'}
        </div>
    </div>
  );

  return (
    <div className="animate-in fade-in duration-500">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Dashboard</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Administrer selskaper, rapporter og konserninnstillinger.</p>
        </div>
        
        <div className="flex gap-3">
            <button 
            onClick={openAddModal}
            className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg shadow-sm flex items-center gap-2 text-sm font-bold transition-colors"
            >
            <Plus className="w-4 h-4" />
            Nytt Selskap
            </button>
        </div>
      </div>
      
      {/* TABS */}
      <div className="flex gap-6 border-b border-slate-200 dark:border-slate-700 mb-6">
          <button onClick={() => setActiveTab('companies')} className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'companies' ? 'border-sky-600 text-sky-600 dark:text-sky-400' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <Building2 size={16} /> Selskaper ({companies.length})
          </button>
          <button onClick={() => setActiveTab('reports')} className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'reports' ? 'border-sky-600 text-sky-600 dark:text-sky-400' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <FileText size={16} /> Innkommende Rapporter ({allReports.length})
          </button>
      </div>

      {activeTab === 'companies' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                    <th className="p-4">Navn</th>
                    <th className="p-4">Leder</th>
                    <th className="p-4 text-right">Budsjett</th>
                    <th className="p-4">Modell</th>
                    <th className="p-4 text-right">Resultat YTD</th>
                    <th className="p-4 text-right">Likviditet</th>
                    <th className="p-4 text-center">Handlinger</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                {companies.map((company) => (
                    <tr key={company.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="p-4">
                        <div className="font-bold text-slate-900 dark:text-white">{company.name}</div>
                        <div className="text-xs text-slate-500">{company.fullName}</div>
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-300">{company.manager}</td>
                    <td className="p-4 text-right font-mono text-slate-700 dark:text-slate-200">{formatCurrency(company.budgetTotal)}</td>
                    <td className="p-4">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                            company.budgetMode === 'monthly' ? 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800' :
                            company.budgetMode === 'quarterly' ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800' :
                            'bg-slate-50 text-slate-600 border-slate-100 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                        }`}>
                            {company.budgetMode === 'annual' ? 'År' : company.budgetMode === 'quarterly' ? 'Kvartal' : 'Måned'}
                        </span>
                    </td>
                    <td className="p-4 text-right font-mono text-slate-700 dark:text-slate-200">{formatCurrency(company.resultYTD)}</td>
                    <td className="p-4 text-right font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(company.liquidity)}</td>
                    <td className="p-4 flex justify-center gap-2">
                        <button onClick={() => openEditModal(company)} className="p-2 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-slate-700 rounded-lg transition-colors" title="Rediger"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(company.id)} className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-700 rounded-lg transition-colors" title="Slett"><Trash2 className="w-4 h-4" /></button>
                    </td>
                    </tr>
                ))}
                {companies.length === 0 && (<tr><td colSpan={7} className="p-8 text-center text-slate-400 dark:text-slate-500">Ingen selskaper registrert.</td></tr>)}
                </tbody>
            </table>
            </div>
        </div>
      )}

      {activeTab === 'reports' && (
           <div className="space-y-4">
               {/* Filter Bar */}
               <div className="flex gap-4 bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                   <div className="relative flex-grow max-w-xs">
                       <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                       <input 
                           type="text" 
                           placeholder="Søk etter selskap eller person..." 
                           className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-md text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                           value={reportFilter}
                           onChange={(e) => setReportFilter(e.target.value)}
                       />
                   </div>
                   <div className="flex items-center gap-2">
                       <Filter size={16} className="text-slate-400" />
                       <select 
                           className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-md text-sm py-2 px-3 outline-none"
                           value={reportSort}
                           onChange={(e) => setReportSort(e.target.value as any)}
                       >
                           <option value="date">Dato (Nyeste først)</option>
                           <option value="status">Status</option>
                       </select>
                   </div>
               </div>

               <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                        <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wider text-slate-50 dark:text-slate-400 font-semibold">
                            <th className="p-4">Dato</th>
                            <th className="p-4">Selskap</th>
                            <th className="p-4">Innsender</th>
                            <th className="p-4">Tall</th> {/* NEW COLUMN */}
                            <th className="p-4">Kommentar</th>
                            <th className="p-4 text-center">Status</th>
                            <th className="p-4 text-center">Handlinger</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
                        {filteredReports.map((report) => (
                            <tr key={report.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                <td className="p-4 text-slate-600 dark:text-slate-300 font-mono whitespace-nowrap">{report.date}</td>
                                <td className="p-4 font-bold text-slate-900 dark:text-white">{getCompanyName(report.companyId!)}</td>
                                <td className="p-4 text-slate-600 dark:text-slate-300">{report.author}</td>
                                <td className="p-4">
                                    {renderReportValues(report)}
                                </td>
                                <td className="p-4 text-slate-500 italic truncate max-w-xs">{report.comment}</td>
                                <td className="p-4 text-center">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                        report.status === 'approved' 
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' 
                                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                                    }`}>
                                        {report.status === 'approved' ? 'Godkjent' : 'Til godkjenning'}
                                    </span>
                                </td>
                                <td className="p-4 text-center flex justify-center gap-2">
                                     {report.status === 'approved' ? (
                                        <>
                                            <button 
                                                onClick={() => openReportModal(report)}
                                                className="p-1.5 text-slate-400 hover:text-sky-600 transition-colors"
                                                title="Se rapport"
                                            >
                                                <Eye size={16} />
                                            </button>
                                            <button 
                                                onClick={() => onUnlockReport(report.id)}
                                                className="p-1.5 text-slate-400 hover:text-amber-600 transition-colors"
                                                title="Lås opp rapport"
                                            >
                                                <Unlock size={16} />
                                            </button>
                                        </>
                                     ) : (
                                        <>
                                            <button 
                                                onClick={() => onApproveReport(report.id)}
                                                className="p-1.5 text-slate-400 hover:text-emerald-600 transition-colors"
                                                title="Godkjenn"
                                            >
                                                <CheckCircle size={16} />
                                            </button>
                                            <button 
                                                onClick={() => openReportModal(report)}
                                                className="p-1.5 text-slate-400 hover:text-sky-600 transition-colors"
                                                title="Rediger"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button 
                                                onClick={() => onDeleteReport(report.id)}
                                                className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                                                title="Slett"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </>
                                     )}
                                </td>
                            </tr>
                        ))}
                        {filteredReports.length === 0 && (<tr><td colSpan={7} className="p-8 text-center text-slate-400">Ingen rapporter funnet.</td></tr>)}
                        </tbody>
                    </table>
               </div>
           </div>
      )}

      {/* Report Edit Modal (Admin) */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Rediger Rapport</h3>
                        <p className="text-sm text-slate-500">{editingReport ? getCompanyName(editingReport.companyId || 0) : ''}</p>
                    </div>
                    <button onClick={() => setIsReportModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                {/* Only Show Monthly Toggle if editingReport is present */}
                {editingReport && (
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

                <form onSubmit={handleReportSubmit} className="p-6 space-y-6">
                    
                    {/* SECTION 1: P&L */}
                    <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl border border-slate-200 dark:border-slate-600 transition-all">
                        <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                <TrendingUp size={14}/> Drift & Resultat
                            </h4>
                            
                            {/* P&L Date Field */}
                            <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500"><Calendar size={10} className="inline mr-0.5"/> Dato tall:</span>
                                    <input 
                                    type="date" 
                                    className="bg-transparent text-right text-xs font-bold text-slate-700 dark:text-slate-300 border-b border-slate-300 dark:border-slate-600 focus:border-sky-500 outline-none w-24"
                                    value={toInputDate(reportFormData.pnlDate)} 
                                    onChange={e => setReportFormData({...reportFormData, pnlDate: fromInputDate(e.target.value)})} 
                                />
                            </div>
                        </div>
                        
                        {reportingMode === 'monthly' && (
                            <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 p-3 rounded text-xs text-blue-700 dark:text-blue-300">
                                <p className="font-bold mb-1">Månedlig Modus:</p>
                                <p>Legg til tall som summeres med nåværende tall.</p>
                            </div>
                        )}

                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">
                                    {reportingMode === 'monthly' ? 'Mnd. Omsetning' : 'Omsetning YTD'}
                                </label>
                                <input 
                                    type="number" 
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm transition-all focus:ring-2 focus:ring-sky-500 outline-none" 
                                    value={reportingMode === 'ytd' ? reportFormData.revenue : monthlyInputs.revenue} 
                                    onChange={e => reportingMode === 'ytd' ? setReportFormData({...reportFormData, revenue: e.target.value}) : setMonthlyInputs({...monthlyInputs, revenue: e.target.value})} 
                                    placeholder="0" 
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">
                                    {reportingMode === 'monthly' ? 'Mnd. Kostnader' : 'Kostnader YTD'}
                                </label>
                                <input 
                                    type="number" 
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm transition-all focus:ring-2 focus:ring-sky-500 outline-none" 
                                    value={reportingMode === 'ytd' ? reportFormData.expenses : monthlyInputs.expenses} 
                                    onChange={e => reportingMode === 'ytd' ? setReportFormData({...reportFormData, expenses: e.target.value}) : setMonthlyInputs({...monthlyInputs, expenses: e.target.value})} 
                                    placeholder="0" 
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 mb-1 block">
                                    Resultat YTD
                                </label>
                                <input 
                                    type="number" 
                                    readOnly
                                    className="w-full bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-500 dark:text-slate-400 text-sm font-bold cursor-not-allowed" 
                                    value={reportFormData.resultYTD} 
                                    title="Resultat beregnes automatisk"
                                />
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: BALANCE */}
                    <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl border border-slate-200 dark:border-slate-600 space-y-4">
                        <h4 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2">
                            <Wallet size={14}/> Likviditet & Balanse
                        </h4>
                        
                        {/* Liquidity Row */}
                        <div className="grid grid-cols-2 gap-4 items-end">
                            <div>
                                <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Likviditet (Bankinnskudd)</label>
                                <input type="number" className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm font-mono" 
                                    value={reportFormData.liquidity} onChange={e => setReportFormData({...reportFormData, liquidity: e.target.value})} placeholder="0" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1"><Calendar size={10}/> Dato</label>
                                <input 
                                    type="date" 
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm" 
                                    value={toInputDate(reportFormData.liquidityDate)} 
                                    onChange={e => setReportFormData({...reportFormData, liquidityDate: fromInputDate(e.target.value)})} 
                                />
                            </div>
                        </div>

                        {/* Receivables Row */}
                        <div className="grid grid-cols-2 gap-4 items-end">
                            <div>
                                <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Kundefordringer</label>
                                <input type="number" className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm font-mono" 
                                    value={reportFormData.receivables} onChange={e => setReportFormData({...reportFormData, receivables: e.target.value})} placeholder="0" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1"><Calendar size={10}/> Dato</label>
                                <input 
                                    type="date" 
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm" 
                                    value={toInputDate(reportFormData.receivablesDate)} 
                                    onChange={e => setReportFormData({...reportFormData, receivablesDate: fromInputDate(e.target.value)})} 
                                />
                            </div>
                        </div>

                        {/* Payables Row */}
                        <div className="grid grid-cols-2 gap-4 items-end">
                            <div>
                                <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Leverandørgjeld</label>
                                <input type="number" className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm font-mono" 
                                    value={reportFormData.accountsPayable} onChange={e => setReportFormData({...reportFormData, accountsPayable: e.target.value})} placeholder="0" />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1"><Calendar size={10}/> Dato</label>
                                <input 
                                    type="date" 
                                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm" 
                                    value={toInputDate(reportFormData.accountsPayableDate)} 
                                    onChange={e => setReportFormData({...reportFormData, accountsPayableDate: fromInputDate(e.target.value)})} 
                                />
                            </div>
                        </div>
                    </div>

                    {/* Meta Data */}
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Kilde</label>
                            <select 
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm"
                                value={reportFormData.source}
                                onChange={e => setReportFormData({...reportFormData, source: e.target.value})}
                            >
                                <option value="Manuell">Manuell registrering</option>
                                <option value="Tripletex">Tripletex Eksport</option>
                                <option value="PowerOffice">PowerOffice Eksport</option>
                                <option value="Visma">Visma eAccounting</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Kommentar / Status</label>
                            <textarea rows={3} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm" 
                                value={reportFormData.comment} onChange={e => setReportFormData({...reportFormData, comment: e.target.value})} placeholder="Kort beskrivelse..." />
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
                        <button type="submit" className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold shadow-md flex items-center gap-2 transition-transform active:scale-95">
                            <Save size={18} /> 
                            Lagre endringer
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Add/Edit Company Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 flex flex-col">
            
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 sticky top-0 z-10">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {editingCompany ? `Rediger ${editingCompany.name}` : 'Legg til nytt selskap'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-6 h-6" /></button>
            </div>
            
             <div className="flex border-b border-slate-200 dark:border-slate-700 px-6">
                <button onClick={() => setActiveTab('companies')} className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${true ? 'border-sky-600 text-sky-600 dark:text-sky-400' : ''}`}>Generelt & Status</button>
            </div>
            <form onSubmit={handleSubmit} className="flex flex-col flex-grow">
                <div className="p-6 space-y-6 flex-grow">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-500">Navn (Initialer)</label>
                            <input name="name" type="text" required className="w-full border rounded px-3 py-2" value={formData.name} onChange={handleInputChange} />
                        </div>
                         <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-500">Fullt Navn</label>
                            <input name="fullName" type="text" className="w-full border rounded px-3 py-2" value={formData.fullName || ''} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-500">Leder</label>
                            <input name="manager" type="text" className="w-full border rounded px-3 py-2" value={formData.manager} onChange={handleInputChange} />
                        </div>
                    </div>
                     {/* Financials (Read Only) */}
                     <div className="grid grid-cols-2 gap-6">
                        <ReadOnlyInput label="Omsetning YTD" value={formData.revenue} />
                        <ReadOnlyInput label="Kostnader YTD" value={formData.expenses} />
                    </div>
                </div>
                <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded">Avbryt</button>
                    <button type="submit" className="px-6 py-2 bg-sky-600 text-white rounded">Lagre</button>
                </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;
