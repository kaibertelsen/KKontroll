import React, { useState, useEffect } from 'react';
import { getNEON, postNEON, deleteNEON } from '../utils/neon';
import { ProjectData } from '../types';
import { ArrowLeft, Plus, Trash2, ChevronRight, TrendingUp, Loader2, FolderOpen } from 'lucide-react';

interface ProjectDashboardProps {
  companyId: number;
  groupId: number;
  companyName: string;
  onBack: () => void;
  onSelectProject: (project: ProjectData) => void;
}

const STATUS_CONFIG = {
  tilbud:       { label: 'Tilbud',       color: 'bg-sky-500',    text: 'text-sky-400',    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
  akseptert:    { label: 'Akseptert',    color: 'bg-amber-500',  text: 'text-amber-400',  badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  under_arbeid: { label: 'Under arbeid', color: 'bg-violet-500', text: 'text-violet-400', badge: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
  ferdig:       { label: 'Ferdig',       color: 'bg-emerald-500',text: 'text-emerald-400',badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  tapt:         { label: 'Tapt',         color: 'bg-rose-500',   text: 'text-rose-400',   badge: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
};

const fmt = (n: number) => {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toLocaleString('no-NO');
};

const mapProject = (r: any): ProjectData => ({
  id: r.id,
  companyId: r.company_id || r.companyId,
  groupId: r.group_id || r.groupId,
  name: r.name,
  responsible: r.responsible || '',
  status: r.status || 'tilbud',
  createdDate: r.created_date || r.createdDate || '',
  startDate: r.start_date || r.startDate || '',
  endDate: r.end_date || r.endDate || '',
  projectRevenue: Number(r.project_revenue || 0),
  estVarekost: Number(r.est_varekost || 0),
  estArbeid: Number(r.est_arbeid || 0),
  estFremmedytelse: Number(r.est_fremmedytelse || 0),
  estAndre: Number(r.est_andre || 0),
  actualVarekost: Number(r.actual_varekost || 0),
  actualArbeid: Number(r.actual_arbeid || 0),
  actualFremmedytelse: Number(r.actual_fremmedytelse || 0),
  actualAndre: Number(r.actual_andre || 0),
  notes: r.notes || '',
});

const ProjectDashboard: React.FC<ProjectDashboardProps> = ({
  companyId, groupId, companyName, onBack, onSelectProject
}) => {
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newResponsible, setNewResponsible] = useState('');
  const [newStatus, setNewStatus] = useState<ProjectData['status']>('tilbud');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getNEON({ table: 'projects', where: { company_id: companyId } });
      setProjects((res.rows || []).map(mapProject));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [companyId]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const today = new Date().toLocaleDateString('no-NO');
      const res = await postNEON({
        table: 'projects',
        data: {
          company_id: companyId,
          group_id: groupId,
          name: newName.trim(),
          responsible: newResponsible.trim(),
          status: newStatus,
          created_date: today,
          start_date: today,
          end_date: today,
          project_revenue: 0,
          est_varekost: 0, est_arbeid: 0, est_fremmedytelse: 0, est_andre: 0,
          actual_varekost: 0, actual_arbeid: 0, actual_fremmedytelse: 0, actual_andre: 0,
        }
      });
      if (res.inserted?.[0]) {
        const newProject = mapProject(res.inserted[0]);
        setShowNewModal(false);
        setNewName(''); setNewResponsible(''); setNewStatus('tilbud');
        onSelectProject(newProject);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!window.confirm('Slett prosjektet?')) return;
    await deleteNEON({ table: 'projects', data: id });
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  const statusOrder: ProjectData['status'][] = ['tilbud', 'akseptert', 'under_arbeid', 'ferdig', 'tapt'];

  const totals = projects.reduce((acc, p) => ({
    revenue: acc.revenue + p.projectRevenue,
    estCost: acc.estCost + p.estVarekost + p.estArbeid + p.estFremmedytelse + p.estAndre,
    actualCost: acc.actualCost + p.actualVarekost + p.actualArbeid + p.actualFremmedytelse + p.actualAndre,
  }), { revenue: 0, estCost: 0, actualCost: 0 });

  const totalEstOverskudd = totals.revenue - totals.estCost;

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
              <ArrowLeft size={18} />
              <span className="text-sm">Tilbake</span>
            </button>
            <div className="w-px h-6 bg-slate-700" />
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">{companyName}</p>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <FolderOpen size={20} className="text-sky-400" /> Prosjekter
              </h1>
            </div>
          </div>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-lg shadow-sky-900/30"
          >
            <Plus size={16} /> Nytt Prosjekt
          </button>
        </div>

        {/* Status summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          {statusOrder.map(status => {
            const cfg = STATUS_CONFIG[status];
            const group = projects.filter(p => p.status === status);
            const sum = group.reduce((s, p) => s + p.projectRevenue, 0);
            return (
              <div key={status} className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4">
                <div className={`w-2 h-2 rounded-full ${cfg.color} mb-2`} />
                <p className="text-xs text-slate-400 font-medium">{cfg.label}</p>
                <p className="text-2xl font-bold text-white">{group.length}</p>
                <p className={`text-xs ${cfg.text} mt-1`}>{fmt(sum)} kr</p>
              </div>
            );
          })}
        </div>

        {/* Total strip */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-4 text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Total omsetning</p>
            <p className="text-xl font-bold text-white">{fmt(totals.revenue)}</p>
          </div>
          <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-4 text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Est. kostnader</p>
            <p className="text-xl font-bold text-slate-300">{fmt(totals.estCost)}</p>
          </div>
          <div className={`rounded-xl p-4 text-center ${totalEstOverskudd >= 0 ? 'bg-emerald-900/20 border border-emerald-700/30' : 'bg-rose-900/20 border border-rose-700/30'}`}>
            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Est. overskudd</p>
            <p className={`text-xl font-bold ${totalEstOverskudd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt(totalEstOverskudd)}</p>
          </div>
        </div>

        {/* Projects list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-sky-500" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 text-slate-500">
            <FolderOpen size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Ingen prosjekter ennå</p>
            <p className="text-sm mt-1">Klikk "Nytt Prosjekt" for å komme i gang</p>
          </div>
        ) : (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 text-left">Prosjekt</th>
                  <th className="px-4 py-3 text-left">Ansvarlig</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Omsetning</th>
                  <th className="px-4 py-3 text-right">Est. overskudd</th>
                  <th className="px-4 py-3 text-right">Dekningsgrad</th>
                  <th className="px-4 py-3 text-center">Fremdrift</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {projects.map((p, idx) => {
                  const cfg = STATUS_CONFIG[p.status];
                  const estCost = p.estVarekost + p.estArbeid + p.estFremmedytelse + p.estAndre;
                  const actualCost = p.actualVarekost + p.actualArbeid + p.actualFremmedytelse + p.actualAndre;
                  const estOverskudd = p.projectRevenue - estCost;
                  const dekningsgrad = p.projectRevenue > 0 ? (estOverskudd / p.projectRevenue) * 100 : 0;
                  const fremdrift = estCost > 0 ? Math.min((actualCost / estCost) * 100, 100) : 0;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => onSelectProject(p)}
                      className={`border-b border-slate-700/30 hover:bg-slate-700/30 cursor-pointer transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-800/20'}`}
                    >
                      <td className="px-5 py-3">
                        <p className="font-semibold text-white">{p.name}</p>
                        {p.endDate && <p className="text-xs text-slate-500 mt-0.5">Ferdig: {p.endDate}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{p.responsible || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-white">{fmt(p.projectRevenue)}</td>
                      <td className={`px-4 py-3 text-right font-mono ${estOverskudd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmt(estOverskudd)}</td>
                      <td className={`px-4 py-3 text-right font-mono text-sm ${dekningsgrad >= 20 ? 'text-emerald-400' : 'text-amber-400'}`}>{dekningsgrad.toFixed(1)}%</td>
                      <td className="px-4 py-3">
                        <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden mx-auto">
                          <div className={`h-full rounded-full transition-all ${fremdrift > 90 ? 'bg-rose-500' : fremdrift > 60 ? 'bg-amber-500' : 'bg-sky-500'}`}
                            style={{ width: `${fremdrift}%` }} />
                        </div>
                        <p className="text-xs text-slate-500 text-center mt-1">{fremdrift.toFixed(0)}%</p>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => handleDelete(e, p.id)}
                            className="p-1.5 text-slate-600 hover:text-rose-400 hover:bg-rose-900/20 rounded transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                          <ChevronRight size={14} className="text-slate-600" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New project modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-slate-700">
              <h3 className="text-lg font-bold text-white">Nytt Prosjekt</h3>
              <button onClick={() => setShowNewModal(false)} className="text-slate-400 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase text-slate-400 mb-1 block">Prosjektnavn *</label>
                <input
                  type="text" autoFocus
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 outline-none"
                  placeholder="Navn på prosjektet"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-slate-400 mb-1 block">Ansvarlig</label>
                <input
                  type="text"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:ring-2 focus:ring-sky-500 outline-none"
                  placeholder="Navn på prosjektleder"
                  value={newResponsible}
                  onChange={e => setNewResponsible(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-slate-400 mb-1 block">Status</label>
                <select
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-sky-500 outline-none"
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value as ProjectData['status'])}
                >
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowNewModal(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white rounded-lg transition-colors">
                  Avbryt
                </button>
                <button
                  onClick={handleCreate}
                  disabled={saving || !newName.trim()}
                  className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-bold transition-colors"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Opprett
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDashboard;
