
import React, { useState, useEffect } from 'react';
import { CompanyData } from '../types';
import { formatCurrency } from '../constants';
import { Trash2, Edit, Plus, Save, X, AlertCircle } from 'lucide-react';

interface AdminViewProps {
  companies: CompanyData[];
  onAdd: (company: Omit<CompanyData, 'id'>) => void;
  onUpdate: (company: CompanyData) => void;
  onDelete: (id: number) => void;
}

const AdminView: React.FC<AdminViewProps> = ({ companies, onAdd, onUpdate, onDelete }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyData | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<Partial<CompanyData>>({});

  useEffect(() => {
    if (editingCompany) {
      setFormData(editingCompany);
    } else {
      // Defaults for new company
      setFormData({
        name: '',
        manager: 'Kai',
        resultYTD: 0,
        budgetTotal: 0,
        liquidity: 0,
        liquidityDate: new Date().toLocaleDateString('no-NO'),
        lastReportDate: new Date().toLocaleDateString('no-NO'),
        lastReportBy: '',
        comment: '',
        trendHistory: 0
      });
    }
  }, [editingCompany, isModalOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.name) return;

    const companyPayload = formData as CompanyData;

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

  return (
    <div className="animate-in fade-in duration-500">
      
      {/* Header */}
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

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                <th className="p-4">Navn</th>
                <th className="p-4">Leder</th>
                <th className="p-4 text-right">Resultat YTD</th>
                <th className="p-4 text-right">Årsbudsjett</th>
                <th className="p-4 text-right">Likviditet</th>
                <th className="p-4 text-center">Handlinger</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
              {companies.map((company) => (
                <tr key={company.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="p-4 font-bold text-slate-900 dark:text-white">{company.name}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-300">{company.manager}</td>
                  <td className="p-4 text-right font-mono text-slate-700 dark:text-slate-200">{formatCurrency(company.resultYTD)}</td>
                  <td className="p-4 text-right font-mono text-slate-500 dark:text-slate-400">{formatCurrency(company.budgetTotal)}</td>
                  <td className="p-4 text-right font-mono text-emerald-600 dark:text-emerald-400">{formatCurrency(company.liquidity)}</td>
                  <td className="p-4 flex justify-center gap-2">
                    <button 
                      onClick={() => openEditModal(company)}
                      className="p-2 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      title="Rediger"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(company.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      title="Slett"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {companies.length === 0 && (
                  <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400 dark:text-slate-500">Ingen selskaper registrert.</td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {editingCompany ? `Rediger ${editingCompany.name}` : 'Legg til nytt selskap'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                    <X className="w-6 h-6" />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Navn (Akronym)</label>
                        <input 
                            name="name"
                            type="text"
                            required
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                            placeholder="F.eks. VPS"
                            value={formData.name}
                            onChange={handleInputChange}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Leder</label>
                        <input 
                            name="manager"
                            type="text"
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                            value={formData.manager}
                            onChange={handleInputChange}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Resultat YTD</label>
                        <input 
                            name="resultYTD"
                            type="number"
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none font-mono"
                            value={formData.resultYTD}
                            onChange={handleInputChange}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Årsbudsjett</label>
                        <input 
                            name="budgetTotal"
                            type="number"
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none font-mono"
                            value={formData.budgetTotal}
                            onChange={handleInputChange}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Trend (YoY %)</label>
                         <input 
                            name="trendHistory"
                            type="number"
                            step="0.1"
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none font-mono"
                            value={formData.trendHistory}
                            onChange={handleInputChange}
                        />
                    </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-700/30 p-4 rounded-lg border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center gap-2"><AlertCircle size={12}/> Likviditet</label>
                        <input 
                            name="liquidity"
                            type="number"
                            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none font-mono"
                            value={formData.liquidity}
                            onChange={handleInputChange}
                        />
                    </div>
                     <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Likviditet Dato</label>
                        <input 
                            name="liquidityDate"
                            type="text"
                            placeholder="DD.MM.YY"
                            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                            value={formData.liquidityDate}
                            onChange={handleInputChange}
                        />
                    </div>
                </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Sist Rapportert Dato</label>
                        <input 
                            name="lastReportDate"
                            type="text"
                            placeholder="DD.MM.YYYY"
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                            value={formData.lastReportDate}
                            onChange={handleInputChange}
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Rapportert Av</label>
                        <input 
                            name="lastReportBy"
                            type="text"
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                            value={formData.lastReportBy}
                            onChange={handleInputChange}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Kommentar</label>
                    <textarea 
                        name="comment"
                        rows={4}
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none resize-none"
                        value={formData.comment}
                        onChange={handleInputChange}
                    />
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                    <button 
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors"
                    >
                        Avbryt
                    </button>
                    <button 
                        type="submit"
                        className="px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold shadow-md transition-colors flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        Lagre endringer
                    </button>
                </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminView;
