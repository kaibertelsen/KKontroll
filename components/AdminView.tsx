
import React, { useState, useEffect } from 'react';
import { CompanyData } from '../types';
import { formatCurrency } from '../constants';
import { Trash2, Edit, Plus, Save, X, AlertCircle, Calendar, BarChart2 } from 'lucide-react';

interface AdminViewProps {
  companies: CompanyData[];
  onAdd: (company: Omit<CompanyData, 'id'>) => void;
  onUpdate: (company: CompanyData) => void;
  onDelete: (id: number) => void;
}

const AdminView: React.FC<AdminViewProps> = ({ companies, onAdd, onUpdate, onDelete }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyData | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'budget'>('general');
  
  const [formData, setFormData] = useState<Partial<CompanyData>>({});

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
    setActiveTab('general');
  }, [editingCompany, isModalOpen]);

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

  const handleAnnualChange = (val: number) => setAnnualBudget(val);
  const handleQuarterlyChange = (index: number, val: number) => {
      const newQ = [...quarterlyBudget];
      newQ[index] = val;
      setQuarterlyBudget(newQ);
  };
  const handleMonthlyChange = (index: number, val: number) => {
      const newM = [...monthlyBudget];
      newM[index] = val;
      setMonthlyBudget(newM);
  };

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Des"];
  const budgetModes: Array<'annual' | 'quarterly' | 'monthly'> = ['annual', 'quarterly', 'monthly'];

  return (
    <div className="animate-in fade-in duration-500">
      
      <div className="flex justify-between items-center mb-8">
        <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Administrer Selskaper</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Legg til, endre eller fjern selskaper i porteføljen.</p>
        </div>
        <button 
          onClick={openAddModal}
          className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg shadow-sm flex items-center gap-2 text-sm font-bold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Legg til nytt selskap
        </button>
      </div>

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
                <button onClick={() => setActiveTab('general')} className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'general' ? 'border-sky-600 text-sky-600 dark:text-sky-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}><Edit size={14} /> Generelt</button>
                <button onClick={() => setActiveTab('budget')} className={`py-3 px-4 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'budget' ? 'border-sky-600 text-sky-600 dark:text-sky-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}><BarChart2 size={14} /> Budsjett</button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-grow">
                <div className="p-6 space-y-6 flex-grow">
                    
                    {activeTab === 'general' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Navn (Initialer)</label>
                                    <input name="name" type="text" required className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none" placeholder="F.eks. VPS" value={formData.name} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Fullt Navn</label>
                                    <input name="fullName" type="text" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none" placeholder="F.eks. Vestlands Prosjektservice" value={formData.fullName || ''} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Leder</label>
                                    <input name="manager" type="text" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none" value={formData.manager} onChange={handleInputChange} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Omsetning YTD</label>
                                    <input name="revenue" type="number" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none font-mono" value={formData.revenue} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Kostnader YTD</label>
                                    <input name="expenses" type="number" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none font-mono" value={formData.expenses} onChange={handleInputChange} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Resultat YTD</label>
                                    <input name="resultYTD" type="number" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none font-mono" value={formData.resultYTD} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Trend (YoY %)</label>
                                    <input name="trendHistory" type="number" step="0.1" className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none font-mono" value={formData.trendHistory} onChange={handleInputChange} />
                                </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-2"><AlertCircle size={12}/> Likviditet</label>
                                    <input name="liquidity" type="number" className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none font-mono" value={formData.liquidity} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Likviditet Dato</label>
                                    <input name="liquidityDate" type="text" placeholder="DD.MM.YY" className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none" value={formData.liquidityDate} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Fordringer</label>
                                    <input name="receivables" type="number" className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none font-mono" value={formData.receivables} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Dato Fordringer</label>
                                    <input name="receivablesDate" type="text" placeholder="DD.MM.YY" className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none" value={formData.receivablesDate} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Leverandørgjeld</label>
                                    <input name="accountsPayable" type="number" className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none font-mono" value={formData.accountsPayable} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Dato Gjeld</label>
                                    <input name="accountsPayableDate" type="text" placeholder="DD.MM.YY" className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none" value={formData.accountsPayableDate} onChange={handleInputChange} />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'budget' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="flex gap-4 mb-6">
                                {budgetModes.map((mode) => (
                                    <button key={mode} type="button" onClick={() => setBudgetInputMode(mode)} className={`flex-1 py-2 text-sm font-bold rounded-lg border transition-all capitalize ${budgetInputMode === mode ? 'bg-sky-100 border-sky-600 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400'}`}>{mode === 'annual' ? 'År' : mode === 'quarterly' ? 'Kvartal' : 'Måned'}</button>
                                ))}
                            </div>
                            {budgetInputMode === 'annual' && (
                                <div className="bg-slate-50 dark:bg-slate-700/30 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                                    <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2 block">Resultatbudsjett (Totalt for året)</label>
                                    <input type="number" className="w-full text-2xl font-bold bg-transparent border-b-2 border-slate-300 dark:border-slate-600 focus:border-sky-500 outline-none py-2 text-slate-900 dark:text-white font-mono" value={annualBudget} onChange={(e) => handleAnnualChange(Number(e.target.value))} />
                                    <p className="text-xs text-slate-500 mt-2">Fordeles jevnt utover 12 måneder.</p>
                                </div>
                            )}
                            {budgetInputMode === 'quarterly' && (
                                <div className="grid grid-cols-2 gap-4">
                                    {[0, 1, 2, 3].map((q) => (
                                        <div key={q} className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Q{q+1}</label>
                                            <input type="number" className="w-full font-bold bg-transparent border-b border-slate-300 dark:border-slate-600 focus:border-sky-500 outline-none py-1 text-slate-900 dark:text-white font-mono" value={quarterlyBudget[q]} onChange={(e) => handleQuarterlyChange(q, Number(e.target.value))} />
                                        </div>
                                    ))}
                                    <div className="col-span-2 text-right text-sm font-bold text-slate-500 mt-2">Total: {formatCurrency(quarterlyBudget.reduce((a,b)=>a+b,0))}</div>
                                </div>
                            )}
                            {budgetInputMode === 'monthly' && (
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                    {monthNames.map((name, i) => (
                                        <div key={i} className="bg-slate-50 dark:bg-slate-700/30 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                            <label className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">{name}</label>
                                            <input type="number" className="w-full text-sm font-bold bg-transparent border-b border-slate-300 dark:border-slate-600 focus:border-sky-500 outline-none py-0.5 text-slate-900 dark:text-white font-mono" value={monthlyBudget[i]} onChange={(e) => handleMonthlyChange(i, Number(e.target.value))} />
                                        </div>
                                    ))}
                                    <div className="col-span-full text-right text-sm font-bold text-slate-500 mt-2">Total: {formatCurrency(monthlyBudget.reduce((a,b)=>a+b,0))}</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 bg-white dark:bg-slate-800 sticky bottom-0">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors">Avbryt</button>
                    <button type="submit" className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold shadow-md transition-colors flex items-center gap-2"><Save className="w-4 h-4" /> Lagre endringer</button>
                </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;
