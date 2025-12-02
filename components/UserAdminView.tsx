
import React, { useState, useEffect } from 'react';
import { UserData, CompanyData } from '../types';
import { Trash2, Edit, Plus, Save, X, User, Shield, Lock } from 'lucide-react';
import { hashPassword } from '../utils/crypto';

interface UserAdminViewProps {
  users: UserData[];
  companies: CompanyData[];
  onAdd: (user: Omit<UserData, 'id'>) => void;
  onUpdate: (user: UserData) => void;
  onDelete: (id: number) => void;
}

const UserAdminView: React.FC<UserAdminViewProps> = ({ users, companies, onAdd, onUpdate, onDelete }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<Partial<UserData>>({});

  useEffect(() => {
    if (editingUser) {
      setFormData({
          ...editingUser,
          password: '' // Don't show existing hash/password
      });
    } else {
      // Defaults for new user
      setFormData({
        email: '',
        password: '',
        fullName: '',
        role: 'leader',
        companyId: null
      });
    }
  }, [editingUser, isModalOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email) {
        alert("E-post er påkrevd");
        return;
    }
    
    // Require password for new users
    if (!editingUser && !formData.password) {
        alert("Passord er påkrevd for nye brukere");
        return;
    }

    const userPayload = { ...formData } as UserData;

    // Hashing Logic
    if (formData.password) {
        userPayload.password = await hashPassword(formData.password);
    } else if (editingUser) {
        // If editing and no password entered, delete the field so we don't overwrite with empty string
        delete userPayload.password;
    }

    // If role is controller, force companyId to null
    if (userPayload.role === 'controller') {
        userPayload.companyId = null;
    }

    if (editingUser) {
      onUpdate(userPayload);
    } else {
      onAdd(userPayload);
    }
    setIsModalOpen(false);
    setEditingUser(null);
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Er du sikker på at du vil slette denne brukeren?')) {
      onDelete(id);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'companyId' ? (value ? Number(value) : null) : value
    }));
  };

  const getCompanyName = (id?: number | null) => {
      if (!id) return '-';
      const comp = companies.find(c => c.id === id);
      return comp ? comp.name : 'Ukjent';
  };

  return (
    <div className="animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Administrer Brukere</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Legg til brukere og tildel roller og selskaper.</p>
        </div>
        <button 
          onClick={() => { setEditingUser(null); setIsModalOpen(true); }}
          className="bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg shadow-sm flex items-center gap-2 text-sm font-bold transition-colors"
        >
          <Plus className="w-4 h-4" />
          Legg til ny bruker
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                <th className="p-4">Navn</th>
                <th className="p-4">E-post</th>
                <th className="p-4">Rolle</th>
                <th className="p-4">Tilknyttet Selskap</th>
                <th className="p-4 text-center">Handlinger</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="p-4 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <div className="bg-slate-100 dark:bg-slate-700 p-1.5 rounded-full">
                        <User size={14} className="text-slate-500 dark:text-slate-300"/>
                      </div>
                      {user.fullName}
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-300">{user.email}</td>
                  <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          user.role === 'controller' 
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' 
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                      }`}>
                          {user.role === 'controller' ? <Shield size={10} className="mr-1"/> : null}
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </span>
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-400">
                      {user.role === 'controller' ? <span className="text-slate-400 italic">Alle (Admin)</span> : getCompanyName(user.companyId)}
                  </td>
                  <td className="p-4 flex justify-center gap-2">
                    <button 
                      onClick={() => { setEditingUser(user); setIsModalOpen(true); }}
                      className="p-2 text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      title="Rediger"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(user.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      title="Slett"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                  <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 dark:text-slate-500">Ingen brukere funnet.</td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
            
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {editingUser ? `Rediger Bruker` : 'Ny Bruker'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                    <X className="w-6 h-6" />
                </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                
                <div>
                    <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Fullt Navn</label>
                    <input 
                        name="fullName"
                        type="text"
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                        placeholder="Ola Nordmann"
                        value={formData.fullName || ''}
                        onChange={handleInputChange}
                    />
                </div>

                <div>
                    <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">E-post</label>
                    <input 
                        name="email"
                        type="email"
                        required
                        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                        placeholder="ola@firma.no"
                        value={formData.email || ''}
                        onChange={handleInputChange}
                    />
                </div>

                <div>
                    <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">
                        {editingUser ? 'Nytt Passord (La stå tomt for å beholde)' : 'Passord'}
                    </label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input 
                            name="password"
                            type="text"
                            required={!editingUser}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg pl-9 pr-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none font-mono text-sm"
                            placeholder={editingUser ? "••••••••" : "Velg passord"}
                            value={formData.password || ''}
                            onChange={handleInputChange}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Rolle</label>
                        <select 
                            name="role" 
                            value={formData.role} 
                            onChange={handleInputChange}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                        >
                            <option value="leader">Leader</option>
                            <option value="controller">Controller</option>
                        </select>
                    </div>
                    
                    {formData.role === 'leader' && (
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1 block">Koble til Selskap</label>
                            <select 
                                name="companyId" 
                                value={formData.companyId || ''} 
                                onChange={handleInputChange}
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 outline-none"
                            >
                                <option value="">-- Velg Selskap --</option>
                                {companies.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
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
                        Lagre Bruker
                    </button>
                </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserAdminView;
