import React, { useState } from 'react';
import { patchNEON } from '../utils/neon';
import { ProjectData } from '../types';
import { ArrowLeft, Save, Loader2, Calendar } from 'lucide-react';

interface ProjectDetailViewProps {
  project: ProjectData;
  companyName: string;
  onBack: () => void;
  onUpdated: (updated: ProjectData) => void;
}

const STATUS_CONFIG = {
  tilbud:       { label: 'Tilbud',       color: 'bg-sky-600' },
  akseptert:    { label: 'Akseptert',    color: 'bg-amber-600' },
  under_arbeid: { label: 'Under arbeid', color: 'bg-violet-600' },
  ferdig:       { label: 'Ferdig',       color: 'bg-emerald-600' },
  tapt:         { label: 'Tapt',         color: 'bg-rose-600' },
};

const SIDE_LABELS: Record<ProjectData['status'], string> = {
  tilbud: 'TILBUD', akseptert: 'AKSEPTERT', under_arbeid: 'ARBEID', ferdig: 'FERDIG', tapt: 'TAPT'
};

const fmt = (n: number) => {
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toLocaleString('no-NO');
};

const ProgressBar: React.FC<{ label: string; actual: number; estimated: number; color: string }> = ({
  label, actual, estimated, color
}) => {
  const pct = estimated > 0 ? Math.min((actual / estimated) * 100, 120) : 0;
  const overBudget = actual > estimated;
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
        <span className="text-xs text-slate-500">{fmt(actual)}K / {fmt(estimated)}K</span>
      </div>
      <div className="h-6 bg-slate-700 rounded overflow-hidden relative">
        <div
          className={`h-full rounded transition-all duration-500 ${overBudget ? 'bg-rose-500' : color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
        {pct > 5 && (
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mix-blend-luminosity">
            {pct.toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
};

const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({ project, companyName, onBack, onUpdated }) => {
  const [form, setForm] = useState({ ...project });
  const [saving, setSaving] = useState(false);

  const set = (key: keyof ProjectData, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const numSet = (key: keyof ProjectData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(key, Number(e.target.value) || 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      await patchNEON({
        table: 'projects',
        data: {
          id: form.id,
          name: form.name,
          responsible: form.responsible,
          status: form.status,
          created_date: form.createdDate,
          start_date: form.startDate,
          end_date: form.endDate,
          project_revenue: form.projectRevenue,
          est_varekost: form.estVarekost,
          est_arbeid: form.estArbeid,
          est_fremmedytelse: form.estFremmedytelse,
          est_andre: form.estAndre,
          actual_varekost: form.actualVarekost,
          actual_arbeid: form.actualArbeid,
          actual_fremmedytelse: form.actualFremmedytelse,
          actual_andre: form.actualAndre,
          notes: form.notes,
        }
      });
      onUpdated(form);
    } finally {
      setSaving(false);
    }
  };

  const estCost = form.estVarekost + form.estArbeid + form.estFremmedytelse + form.estAndre;
  const actualCost = form.actualVarekost + form.actualArbeid + form.actualFremmedytelse + form.actualAndre;
  const estOverskudd = form.projectRevenue - estCost;
  const actualOverskudd = form.projectRevenue - actualCost;
  const dekningsgrad = form.projectRevenue > 0 ? (estOverskudd / form.projectRevenue) * 100 : 0;
  const actualDekningsgrad = form.projectRevenue > 0 ? (actualOverskudd / form.projectRevenue) * 100 : 0;
  const statusCfg = STATUS_CONFIG[form.status];

  const inputCls = "w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-sm focus:ring-1 focus:ring-sky-500 outline-none text-right font-mono";

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans">
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Back + Save */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={18} /> Tilbake
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white px-5 py-2 rounded-lg font-bold text-sm transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Lagre
          </button>
        </div>

        <div className="flex gap-4">
          {/* Status side badge */}
          <div className={`${statusCfg.color} rounded-xl flex items-center justify-center w-14 shrink-0 shadow-lg`}>
            <span className="text-white font-black text-xs tracking-widest uppercase" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
              {SIDE_LABELS[form.status]}
            </span>
          </div>

          <div className="flex-1 space-y-4">
            {/* Info card */}
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <input
                className="w-full bg-transparent text-white text-xl font-bold outline-none border-b border-slate-600 focus:border-sky-500 pb-1 mb-3"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Prosjektnavn"
              />
              <input
                className="w-full bg-transparent text-slate-400 text-sm outline-none border-b border-slate-700 focus:border-sky-500 pb-1 mb-4"
                value={form.responsible || ''}
                onChange={e => set('responsible', e.target.value)}
                placeholder="Ansvarlig"
              />
              <p className="text-xs text-slate-500 font-semibold mb-3">{companyName}</p>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { label: 'Opprettet', key: 'createdDate' as const },
                  { label: 'Start',     key: 'startDate' as const },
                  { label: 'Ferdig',    key: 'endDate' as const },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <label className="text-[10px] uppercase text-slate-500 block mb-1">{label}</label>
                    <input
                      type="text"
                      className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-xs focus:ring-1 focus:ring-sky-500 outline-none"
                      placeholder="DD.MM.ÅÅÅÅ"
                      value={form[key] || ''}
                      onChange={e => set(key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
              <select
                className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-sky-500 outline-none w-full"
                value={form.status}
                onChange={e => set('status', e.target.value as ProjectData['status'])}
              >
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>

            {/* Progress bars */}
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Status</h3>
              <ProgressBar label="Varekost"       actual={form.actualVarekost}      estimated={form.estVarekost}      color="bg-blue-500" />
              <ProgressBar label="Arbeid"         actual={form.actualArbeid}        estimated={form.estArbeid}        color="bg-amber-500" />
              <ProgressBar label="Fremmedytelser" actual={form.actualFremmedytelse} estimated={form.estFremmedytelse} color="bg-emerald-500" />
              <ProgressBar label="Andrekostnader" actual={form.actualAndre}         estimated={form.estAndre}         color="bg-violet-500" />
              <div className="mt-4 pt-4 border-t border-slate-700 flex justify-between text-sm">
                <div>
                  <p className="text-[10px] uppercase text-slate-500">Faktiske kostnader</p>
                  <p className="font-bold text-white text-lg">{fmt(actualCost)}K</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-slate-500">Estimert kostnader</p>
                  <p className="font-bold text-slate-300 text-lg">{fmt(estCost)}K</p>
                </div>
              </div>
            </div>

            {/* Estimat + Faktisk tables */}
            {[
              { title: 'Estimat', fields: [
                { label: 'Prosjektpris', key: 'projectRevenue' as const },
                { label: 'Varekostnad',  key: 'estVarekost' as const },
                { label: 'Arbeidskost', key: 'estArbeid' as const },
                { label: 'Fremmedytelse', key: 'estFremmedytelse' as const },
                { label: 'Andrekostnader', key: 'estAndre' as const },
              ], overskudd: estOverskudd, dekningsgrad },
              { title: 'Faktisk', fields: [
                { label: 'Prosjektpris', key: 'projectRevenue' as const },
                { label: 'Varekostnad',  key: 'actualVarekost' as const },
                { label: 'Arbeidskost', key: 'actualArbeid' as const },
                { label: 'Fremmedytelse', key: 'actualFremmedytelse' as const },
                { label: 'Andrekostnader', key: 'actualAndre' as const },
              ], overskudd: actualOverskudd, dekningsgrad: actualDekningsgrad },
            ].map(section => (
              <div key={section.title} className="bg-slate-800 rounded-xl p-5 border border-slate-700">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">{section.title}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] uppercase text-slate-500 border-b border-slate-700">
                        <th className="pb-2 text-left">Overskudd</th>
                        {section.fields.slice(1).map(f => <th key={f.key} className="pb-2 text-right">{f.label}</th>)}
                        <th className="pb-2 text-right">Prosjektpris</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className={`py-2 font-bold text-lg ${section.overskudd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {fmt(section.overskudd)}
                        </td>
                        {section.fields.slice(1).map(f => (
                          <td key={f.key} className="py-2 pl-2">
                            <input
                              type="number"
                              className={inputCls}
                              value={form[f.key] as number || 0}
                              onChange={numSet(f.key)}
                            />
                          </td>
                        ))}
                        <td className="py-2 pl-2">
                          <input
                            type="number"
                            className={inputCls}
                            value={form.projectRevenue || 0}
                            onChange={numSet('projectRevenue')}
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 text-right text-xs text-slate-500">
                  Dekningsgrad: <span className={section.dekningsgrad >= 20 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                    {section.dekningsgrad.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}

            {/* Notes */}
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <label className="text-xs font-bold uppercase text-slate-400 mb-2 block">Notater</label>
              <textarea
                rows={3}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-1 focus:ring-sky-500 outline-none resize-none"
                placeholder="Kommentarer, avvik, noter..."
                value={form.notes || ''}
                onChange={e => set('notes', e.target.value)}
              />
            </div>

            {/* Bottom save */}
            <div className="flex justify-end pb-8">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white px-8 py-3 rounded-xl font-bold transition-colors shadow-lg shadow-sky-900/30"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Lagre endringer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailView;
