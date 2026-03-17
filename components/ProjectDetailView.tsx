import React, { useState, useEffect } from 'react';
import { getNEON, patchNEON, postNEON, deleteNEON } from '../utils/neon';
import { ProjectData, ProjectLog } from '../types';
import { ArrowLeft, Save, Loader2, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

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
  tilbud: 'TILBUD', akseptert: 'AKSEPTERT', under_arbeid: 'ARBEID', ferdig: 'FERDIG', tapt: 'TAPT',
};

const fmt = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return n.toLocaleString('no-NO');
};

const parseNorDate = (s?: string): Date | null => {
  if (!s) return null;
  const parts = s.split('.');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (isNaN(d) || isNaN(m) || isNaN(y) || y < 2000) return null;
  return new Date(y, m - 1, d);
};

const todayNorStr = () => {
  const d = new Date();
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
};

// ─── Burn Chart ──────────────────────────────────────────────────────────────
const BurnChart: React.FC<{
  startDate?: string;
  endDate?: string;
  totalEstCost: number;
  logs: ProjectLog[];
}> = ({ startDate, endDate, totalEstCost, logs }) => {
  const start = parseNorDate(startDate);
  const end = parseNorDate(endDate);
  const today = new Date();
  if (!start || !end || end <= start || totalEstCost <= 0) return null;

  const W = 600, H = 130;
  const PAD = { t: 18, r: 20, b: 28, l: 52 };
  const cW = W - PAD.l - PAD.r;
  const cH = H - PAD.t - PAD.b;
  const totalMs = end.getTime() - start.getTime();

  const xPos = (d: Date) =>
    PAD.l + Math.max(0, Math.min(1, (d.getTime() - start.getTime()) / totalMs)) * cW;

  const maxCost = totalEstCost * 1.15;
  const yPos = (c: number) => PAD.t + cH - Math.min(c / maxCost, 1.2) * cH;

  const idealPath = `M ${xPos(start).toFixed(1)} ${yPos(0).toFixed(1)} L ${xPos(end).toFixed(1)} ${yPos(totalEstCost).toFixed(1)}`;

  // Cumulative actual from logs
  const sortedLogs = [...logs]
    .map(l => ({ date: parseNorDate(l.logDate), cost: l.varekost + l.arbeid + l.fremmedytelse + l.andre }))
    .filter(l => l.date !== null)
    .sort((a, b) => a.date!.getTime() - b.date!.getTime());

  const points: { x: number; y: number }[] = [{ x: xPos(start), y: yPos(0) }];
  let cum = 0;
  for (const l of sortedLogs) {
    cum += l.cost;
    points.push({ x: xPos(l.date!), y: yPos(cum) });
  }

  const actualPath = points.length > 1
    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    : null;

  const todayInRange = today >= start && today <= end;
  const todayX = xPos(today);

  const yLabels = [0, 0.25, 0.5, 0.75, 1].map(pct => ({
    y: yPos(totalEstCost * pct),
    label: pct === 0 ? '0' : `${Math.round(totalEstCost * pct / 1000)}K`,
  }));

  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
        Fremdrift — kostnadsutvikling
      </h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 140 }}>
        {/* Grid lines */}
        {yLabels.map(({ y, label }) => (
          <g key={label}>
            <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="#1e293b" strokeWidth="1" />
            <text x={PAD.l - 5} y={y + 3} textAnchor="end" fontSize="9" fill="#475569">{label}</text>
          </g>
        ))}
        {/* Axes */}
        <line x1={PAD.l} y1={PAD.t - 4} x2={PAD.l} y2={H - PAD.b} stroke="#334155" strokeWidth="1" />
        <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="#334155" strokeWidth="1" />
        {/* Today marker */}
        {todayInRange && <>
          <line x1={todayX} y1={PAD.t - 4} x2={todayX} y2={H - PAD.b}
            stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="3,2" />
          <text x={todayX} y={PAD.t - 6} textAnchor="middle" fontSize="8" fill="#fbbf24" fontWeight="bold">I DAG</text>
        </>}
        {/* Ideal dashed line */}
        <path d={idealPath} fill="none" stroke="#475569" strokeWidth="1.5" strokeDasharray="7,4" />
        {/* Actual line */}
        {actualPath && (
          <path d={actualPath} fill="none" stroke="#38bdf8" strokeWidth="2.5"
            strokeLinecap="round" strokeLinejoin="round" />
        )}
        {/* Dots at each log entry */}
        {points.slice(1).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#38bdf8" stroke="#0f172a" strokeWidth="1.5" />
        ))}
        {/* Date labels */}
        <text x={PAD.l} y={H - 8} textAnchor="start" fontSize="9" fill="#475569">{startDate}</text>
        <text x={W - PAD.r} y={H - 8} textAnchor="end" fontSize="9" fill="#475569">{endDate}</text>
      </svg>
      <div className="flex items-center gap-5 mt-2 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <svg width="22" height="4">
            <line x1="0" y1="2" x2="22" y2="2" stroke="#475569" strokeWidth="1.5" strokeDasharray="6,3" />
          </svg>
          Ideal fremdrift
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="22" height="4">
            <line x1="0" y1="2" x2="22" y2="2" stroke="#38bdf8" strokeWidth="2.5" />
          </svg>
          Faktisk hittil
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="12" height="12">
            <line x1="6" y1="0" x2="6" y2="12" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="3,2" />
          </svg>
          I dag
        </span>
      </div>
    </div>
  );
};

// ─── Progress Bar ─────────────────────────────────────────────────────────────
const ProgressBar: React.FC<{ label: string; actual: number; estimated: number; color: string }> = ({
  label, actual, estimated, color,
}) => {
  const pct = estimated > 0 ? Math.min((actual / estimated) * 100, 120) : 0;
  const over = actual > estimated;
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
        <span className="text-xs text-slate-500">{fmt(actual)} / {fmt(estimated)}</span>
      </div>
      <div className="h-6 bg-slate-700 rounded overflow-hidden relative">
        <div className={`h-full rounded transition-all duration-500 ${over ? 'bg-rose-500' : color}`}
          style={{ width: `${Math.min(pct, 100)}%` }} />
        {pct > 5 && (
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mix-blend-luminosity">
            {pct.toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({ project, companyName, onBack, onUpdated }) => {
  const [form, setForm] = useState({ ...project });
  const [logs, setLogs] = useState<ProjectLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [logForm, setLogForm] = useState({
    log_date: todayNorStr(), varekost: 0, arbeid: 0, fremmedytelse: 0, andre: 0, notes: '',
  });
  const [addingLog, setAddingLog] = useState(false);
  const isFilled = !!(form.name && form.responsible && form.startDate && form.endDate);
  const [infoExpanded, setInfoExpanded] = useState(!isFilled);

  const mapLog = (r: any): ProjectLog => ({
    id: r.id,
    projectId: r.project_id,
    logDate: r.log_date,
    varekost: Number(r.varekost || 0),
    arbeid: Number(r.arbeid || 0),
    fremmedytelse: Number(r.fremmedytelse || 0),
    andre: Number(r.andre || 0),
    notes: r.notes || '',
  });

  useEffect(() => {
    setLogsLoading(true);
    getNEON({ table: 'project_logs', where: { project_id: project.id } })
      .then(res => setLogs((res.rows || []).map(mapLog)))
      .finally(() => setLogsLoading(false));
  }, [project.id]);

  const set = (key: keyof ProjectData, value: any) =>
    setForm(prev => ({ ...prev, [key]: value }));

  // Actual totals derived from logs
  const actualVarekost      = logs.reduce((s, l) => s + l.varekost, 0);
  const actualArbeid        = logs.reduce((s, l) => s + l.arbeid, 0);
  const actualFremmedytelse = logs.reduce((s, l) => s + l.fremmedytelse, 0);
  const actualAndre         = logs.reduce((s, l) => s + l.andre, 0);
  const actualCost          = actualVarekost + actualArbeid + actualFremmedytelse + actualAndre;

  const estCost         = form.estVarekost + form.estArbeid + form.estFremmedytelse + form.estAndre;
  const estOverskudd    = form.projectRevenue - estCost;
  const actualOverskudd = form.projectRevenue - actualCost;
  const dekningsgrad    = form.projectRevenue > 0 ? (estOverskudd / form.projectRevenue) * 100 : 0;
  const actualDekningsgrad = form.projectRevenue > 0 ? (actualOverskudd / form.projectRevenue) * 100 : 0;
  const statusCfg = STATUS_CONFIG[form.status];

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
          actual_varekost: actualVarekost,
          actual_arbeid: actualArbeid,
          actual_fremmedytelse: actualFremmedytelse,
          actual_andre: actualAndre,
          notes: form.notes,
        },
      });
      onUpdated({ ...form, actualVarekost, actualArbeid, actualFremmedytelse, actualAndre });
    } finally {
      setSaving(false);
    }
  };

  const handleAddLog = async () => {
    setAddingLog(true);
    try {
      const res = await postNEON({
        table: 'project_logs',
        data: {
          project_id: project.id,
          log_date: logForm.log_date,
          varekost: logForm.varekost,
          arbeid: logForm.arbeid,
          fremmedytelse: logForm.fremmedytelse,
          andre: logForm.andre,
          notes: logForm.notes,
        },
      });
      if (res.inserted?.[0]) {
        setLogs(prev => [...prev, mapLog(res.inserted[0])]);
        setShowLogModal(false);
        setLogForm({ log_date: todayNorStr(), varekost: 0, arbeid: 0, fremmedytelse: 0, andre: 0, notes: '' });
      }
    } finally {
      setAddingLog(false);
    }
  };

  const handleDeleteLog = async (id: number) => {
    if (!window.confirm('Slett registrering?')) return;
    await deleteNEON({ table: 'project_logs', data: id });
    setLogs(prev => prev.filter(l => l.id !== id));
  };

  const inputCls = "w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-white text-sm focus:ring-1 focus:ring-sky-500 outline-none text-right font-mono";
  const modalInputCls = "w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-sky-500 outline-none font-mono text-right";

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans">
      <div className="max-w-4xl mx-auto px-4 py-6">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <ArrowLeft size={18} /> Tilbake
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white px-5 py-2 rounded-lg font-bold text-sm transition-colors">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Lagre
          </button>
        </div>

        <div className="flex gap-4">
          {/* Status side badge */}
          <div className={`${statusCfg.color} rounded-xl flex items-center justify-center w-14 shrink-0 shadow-lg`}>
            <span className="text-white font-black text-xs tracking-widest uppercase"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
              {SIDE_LABELS[form.status]}
            </span>
          </div>

          <div className="flex-1 space-y-4">

            {/* Info card */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
              {/* Always-visible summary row */}
              <button
                onClick={() => setInfoExpanded(p => !p)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-700/40 transition-colors text-left"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span className="font-bold text-white truncate">{form.name || 'Prosjektnavn'}</span>
                  {form.responsible && (
                    <span className="text-slate-400 text-sm shrink-0">{form.responsible}</span>
                  )}
                  {(form.startDate || form.endDate) && (
                    <span className="text-slate-500 text-xs shrink-0">
                      {form.startDate || '—'} → {form.endDate || '—'}
                    </span>
                  )}
                </div>
                {infoExpanded
                  ? <ChevronUp size={16} className="text-slate-500 shrink-0" />
                  : <ChevronDown size={16} className="text-slate-500 shrink-0" />}
              </button>

              {/* Expandable details */}
              {infoExpanded && (
                <div className="px-5 pb-5 border-t border-slate-700 pt-4">
                  <input
                    className="w-full bg-transparent text-white text-xl font-bold outline-none border-b border-slate-600 focus:border-sky-500 pb-1 mb-3"
                    value={form.name} onChange={e => set('name', e.target.value)} placeholder="Prosjektnavn" />
                  <input
                    className="w-full bg-transparent text-slate-400 text-sm outline-none border-b border-slate-700 focus:border-sky-500 pb-1 mb-4"
                    value={form.responsible || ''} onChange={e => set('responsible', e.target.value)} placeholder="Ansvarlig" />
                  <p className="text-xs text-slate-500 font-semibold mb-3">{companyName}</p>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {([
                      { label: 'Opprettet', key: 'createdDate' as const },
                      { label: 'Start',     key: 'startDate'   as const },
                      { label: 'Ferdig',    key: 'endDate'     as const },
                    ]).map(({ label, key }) => (
                      <div key={key}>
                        <label className="text-[10px] uppercase text-slate-500 block mb-1">{label}</label>
                        <input type="text"
                          className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-xs focus:ring-1 focus:ring-sky-500 outline-none"
                          placeholder="DD.MM.ÅÅÅÅ" value={form[key] || ''} onChange={e => set(key, e.target.value)} />
                      </div>
                    ))}
                  </div>
                  <select
                    className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-sky-500 outline-none w-full"
                    value={form.status} onChange={e => set('status', e.target.value as ProjectData['status'])}>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Burn chart */}
            <BurnChart startDate={form.startDate} endDate={form.endDate} totalEstCost={estCost} logs={logs} />

            {/* Progress bars */}
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Status hittil</h3>
              <ProgressBar label="Varekost"       actual={actualVarekost}      estimated={form.estVarekost}      color="bg-blue-500" />
              <ProgressBar label="Arbeid"         actual={actualArbeid}        estimated={form.estArbeid}        color="bg-amber-500" />
              <ProgressBar label="Fremmedytelser" actual={actualFremmedytelse} estimated={form.estFremmedytelse} color="bg-emerald-500" />
              <ProgressBar label="Andrekostnader" actual={actualAndre}         estimated={form.estAndre}         color="bg-violet-500" />
              <div className="mt-4 pt-4 border-t border-slate-700 flex justify-between text-sm">
                <div>
                  <p className="text-[10px] uppercase text-slate-500">Faktiske kostnader hittil</p>
                  <p className="font-bold text-white text-lg">{fmt(actualCost)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-slate-500">Estimert kostnader</p>
                  <p className="font-bold text-slate-300 text-lg">{fmt(estCost)}</p>
                </div>
              </div>
            </div>

            {/* Estimat */}
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Estimat</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] uppercase text-slate-500 border-b border-slate-700">
                      <th className="pb-2 text-left">Overskudd</th>
                      <th className="pb-2 text-right">Varekostnad</th>
                      <th className="pb-2 text-right">Arbeidskost</th>
                      <th className="pb-2 text-right">Fremmedytelse</th>
                      <th className="pb-2 text-right">Andrekostnader</th>
                      <th className="pb-2 text-right">Prosjektpris</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className={`py-2 font-bold text-lg ${estOverskudd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {fmt(estOverskudd)}
                      </td>
                      {([
                        { key: 'estVarekost'      as const },
                        { key: 'estArbeid'        as const },
                        { key: 'estFremmedytelse' as const },
                        { key: 'estAndre'         as const },
                      ]).map(({ key }) => (
                        <td key={key} className="py-2 pl-2">
                          <input type="number" className={inputCls}
                            value={form[key] as number || 0}
                            onChange={e => set(key, Number(e.target.value) || 0)} />
                        </td>
                      ))}
                      <td className="py-2 pl-2">
                        <input type="number" className={inputCls}
                          value={form.projectRevenue || 0}
                          onChange={e => set('projectRevenue', Number(e.target.value) || 0)} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-2 text-right text-xs text-slate-500">
                Dekningsgrad: <span className={dekningsgrad >= 20 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                  {dekningsgrad.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Faktisk — log entries */}
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Faktisk — registreringer
                </h3>
                <button onClick={() => setShowLogModal(true)}
                  className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                  <Plus size={12} /> Legg til
                </button>
              </div>

              {logsLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 size={20} className="animate-spin text-sky-500" />
                </div>
              ) : logs.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-6">
                  Ingen registreringer ennå — trykk "Legg til" for å logge kostnader
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[10px] uppercase text-slate-500 border-b border-slate-700">
                          <th className="pb-2 text-left">Dato</th>
                          <th className="pb-2 text-right">Varekost</th>
                          <th className="pb-2 text-right">Arbeid</th>
                          <th className="pb-2 text-right">Fremmedytelse</th>
                          <th className="pb-2 text-right">Andre</th>
                          <th className="pb-2 text-right">Sum</th>
                          <th className="pb-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {[...logs]
                          .sort((a, b) => {
                            const da = parseNorDate(a.logDate);
                            const db = parseNorDate(b.logDate);
                            return (db?.getTime() ?? 0) - (da?.getTime() ?? 0);
                          })
                          .map(log => {
                            const sum = log.varekost + log.arbeid + log.fremmedytelse + log.andre;
                            return (
                              <tr key={log.id} className="border-b border-slate-700/40">
                                <td className="py-2 text-slate-300 font-mono text-xs">{log.logDate}</td>
                                <td className="py-2 text-right text-slate-400 font-mono">{log.varekost > 0 ? fmt(log.varekost) : '—'}</td>
                                <td className="py-2 text-right text-slate-400 font-mono">{log.arbeid > 0 ? fmt(log.arbeid) : '—'}</td>
                                <td className="py-2 text-right text-slate-400 font-mono">{log.fremmedytelse > 0 ? fmt(log.fremmedytelse) : '—'}</td>
                                <td className="py-2 text-right text-slate-400 font-mono">{log.andre > 0 ? fmt(log.andre) : '—'}</td>
                                <td className="py-2 text-right font-bold text-white font-mono">{fmt(sum)}</td>
                                <td className="py-2 pl-2">
                                  <button onClick={() => handleDeleteLog(log.id)}
                                    className="p-1 text-slate-600 hover:text-rose-400 hover:bg-rose-900/20 rounded transition-colors">
                                    <Trash2 size={13} />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t-2 border-slate-600">
                          <td className="py-2 text-[10px] uppercase text-slate-400 font-bold">Totalt hittil</td>
                          <td className="py-2 text-right font-bold text-sky-400 font-mono">{fmt(actualVarekost)}</td>
                          <td className="py-2 text-right font-bold text-sky-400 font-mono">{fmt(actualArbeid)}</td>
                          <td className="py-2 text-right font-bold text-sky-400 font-mono">{fmt(actualFremmedytelse)}</td>
                          <td className="py-2 text-right font-bold text-sky-400 font-mono">{fmt(actualAndre)}</td>
                          <td className="py-2 text-right font-bold text-white font-mono">{fmt(actualCost)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className="mt-2 text-right text-xs text-slate-500">
                    Faktisk dekningsgrad: <span className={actualDekningsgrad >= 20 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                      {actualDekningsgrad.toFixed(1)}%
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Notes */}
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <label className="text-xs font-bold uppercase text-slate-400 mb-2 block">Notater</label>
              <textarea rows={3}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-1 focus:ring-sky-500 outline-none resize-none"
                placeholder="Kommentarer, avvik, noter..."
                value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
            </div>

            {/* Bottom save */}
            <div className="flex justify-end pb-8">
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white px-8 py-3 rounded-xl font-bold transition-colors shadow-lg shadow-sky-900/30">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Lagre endringer
              </button>
            </div>

          </div>
        </div>
      </div>

      {/* Add log modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex justify-between items-center p-6 border-b border-slate-700">
              <h3 className="text-lg font-bold text-white">Legg til registrering</h3>
              <button onClick={() => setShowLogModal(false)} className="text-slate-400 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase text-slate-400 mb-1 block">Dato</label>
                <input type="text"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                  placeholder="DD.MM.ÅÅÅÅ"
                  value={logForm.log_date}
                  onChange={e => setLogForm(p => ({ ...p, log_date: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { label: 'Varekost',         key: 'varekost'      as const },
                  { label: 'Arbeid',           key: 'arbeid'        as const },
                  { label: 'Fremmedytelse',    key: 'fremmedytelse' as const },
                  { label: 'Andre kostnader',  key: 'andre'         as const },
                ]).map(({ label, key }) => (
                  <div key={key}>
                    <label className="text-xs font-bold uppercase text-slate-400 mb-1 block">{label}</label>
                    <input type="number" className={modalInputCls}
                      value={logForm[key] || 0}
                      onChange={e => setLogForm(p => ({ ...p, [key]: Number(e.target.value) || 0 }))} />
                  </div>
                ))}
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-slate-400 mb-1 block">Notat (valgfritt)</label>
                <input type="text"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                  placeholder="Merknad til denne registreringen"
                  value={logForm.notes}
                  onChange={e => setLogForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowLogModal(false)}
                  className="px-4 py-2 text-slate-400 hover:text-white rounded-lg transition-colors">
                  Avbryt
                </button>
                <button onClick={handleAddLog} disabled={addingLog}
                  className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-bold transition-colors">
                  {addingLog ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Lagre
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetailView;
