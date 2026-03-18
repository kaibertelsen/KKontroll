import React from 'react';
import { ComputedCompanyData } from '../types';
import { formatCurrency } from '../constants';

interface PulseViewProps {
  companies: ComputedCompanyData[];
  dateLabel: string;
  onSelectCompany?: (c: ComputedCompanyData) => void;
}

interface PulseCompany {
  company: ComputedCompanyData;
  nedre: number;
  ovre: number;
  result: number;
  pct: number; // deviation % from midpoint / nedre
  onTrack: boolean;
}

const PulseView: React.FC<PulseViewProps> = ({ companies, dateLabel, onSelectCompany }) => {
  const items: PulseCompany[] = companies.map(c => {
    const isScenario = c.budgetType === 'scenario';
    const nedre = isScenario ? (c.calculatedBudgetYTDLow ?? c.calculatedBudgetYTD) : c.calculatedBudgetYTD;
    const ovre = isScenario ? (c.calculatedBudgetYTDHigh ?? c.calculatedBudgetYTD) : c.calculatedBudgetYTD;
    const result = c.resultYTD ?? 0;

    const onTrack = isScenario
      ? result >= nedre && result <= ovre
      : result >= nedre;

    // Deviation % relative to nedre (positive = over nedre)
    const pct = nedre !== 0 ? ((result - nedre) / Math.abs(nedre)) * 100 : 0;

    return { company: c, nedre, ovre, result, pct, onTrack };
  });

  const onTrackItems = items
    .filter(i => i.onTrack)
    .sort((a, b) => b.pct - a.pct);

  const offTrackItems = items
    .filter(i => !i.onTrack)
    .sort((a, b) => a.pct - b.pct); // worst first (most negative)

  const renderCard = (item: PulseCompany, idx: number) => {
    const { company, nedre, ovre, result, onTrack } = item;
    const isScenario = company.budgetType === 'scenario';

    // Progress bar: how far result is between nedre and ovre
    const range = ovre - nedre;
    let barPct = 0;
    if (range > 0) {
      barPct = Math.max(0, Math.min(100, ((result - nedre) / range) * 100));
    } else {
      barPct = result >= nedre ? 100 : 0;
    }

    const resultColor = onTrack
      ? 'text-emerald-400'
      : result > ovre
        ? 'text-sky-400'
        : 'text-rose-400';

    return (
      <div
        key={company.id}
        onClick={() => onSelectCompany?.(company)}
        className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 cursor-pointer hover:bg-slate-700/80 hover:border-slate-600 transition-all duration-200 select-none"
      >
        {/* Header row */}
        <div className="flex items-start gap-2 mb-3">
          <span className="text-slate-500 text-[10px] font-bold min-w-[16px]">{idx + 1}</span>
          <span className="text-slate-200 text-xs font-semibold leading-tight line-clamp-2">{company.name}</span>
        </div>

        {/* NEDRE | RESULTAT | ØVRE */}
        <div className="grid grid-cols-3 gap-1 mb-3">
          <div>
            <div className="text-[8px] uppercase tracking-widest text-slate-500 font-bold mb-0.5">Nedre</div>
            <div className="text-[11px] font-bold text-slate-300">{formatCurrency(nedre)}</div>
          </div>
          <div className="text-center">
            <div className="text-[8px] uppercase tracking-widest text-slate-500 font-bold mb-0.5">Resultat</div>
            <div className={`text-[13px] font-extrabold ${resultColor}`}>{formatCurrency(result)}</div>
          </div>
          <div className="text-right">
            <div className="text-[8px] uppercase tracking-widest text-slate-500 font-bold mb-0.5">Øvre</div>
            <div className="flex justify-end">
              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${isScenario ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                {formatCurrency(ovre)}
              </span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${onTrack ? 'bg-emerald-500' : result < nedre ? 'bg-rose-500' : 'bg-sky-400'}`}
            style={{ width: `${barPct}%` }}
          />
        </div>
      </div>
    );
  };

  const SectionLabel = ({ label, isOnTrack }: { label: string; isOnTrack: boolean }) => (
    <div className={`flex items-center justify-center w-8 self-stretch rounded-lg ${isOnTrack ? 'bg-blue-700' : 'bg-slate-700'}`}>
      <span
        className="text-white text-xs font-black tracking-[0.2em] uppercase"
        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: '0.25em' }}
      >
        {label}
      </span>
    </div>
  );

  const SectionAggregate = ({ items, label, isOnTrack }: { items: PulseCompany[]; label: string; isOnTrack: boolean }) => {
    const totNedre = items.reduce((s, i) => s + i.nedre, 0);
    const totOvre = items.reduce((s, i) => s + i.ovre, 0);
    const totResult = items.reduce((s, i) => s + i.result, 0);
    const dateStr = dateLabel;
    return (
      <div className={`flex items-center gap-6 px-6 py-3 rounded-xl mb-4 ${isOnTrack ? 'bg-blue-900/40 border border-blue-700/40' : 'bg-slate-800/60 border border-slate-700/40'}`}>
        <span className={`text-sm font-black uppercase tracking-widest ${isOnTrack ? 'text-blue-300' : 'text-slate-400'}`}>{label}</span>
        <span className="text-slate-500 text-xs">{dateStr}</span>
        <div className="flex gap-6 ml-auto">
          <div>
            <div className="text-[8px] uppercase text-slate-500 tracking-widest font-bold">Nedre</div>
            <div className="text-sm font-bold text-slate-300">{formatCurrency(totNedre)}</div>
          </div>
          <div>
            <div className="text-[8px] uppercase text-slate-500 tracking-widest font-bold">Resultat</div>
            <div className={`text-sm font-bold ${isOnTrack ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(totResult)}</div>
          </div>
          <div>
            <div className="text-[8px] uppercase text-slate-500 tracking-widest font-bold">Øvre</div>
            <div className="text-sm font-bold text-slate-300">{formatCurrency(totOvre)}</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[60vh] space-y-8">
      {/* ON TRACK section */}
      {onTrackItems.length > 0 && (
        <div>
          <SectionAggregate items={onTrackItems} label="On Track" isOnTrack={true} />
          <div className="flex gap-3">
            <SectionLabel label="On Track" isOnTrack={true} />
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {onTrackItems.map((item, idx) => renderCard(item, idx))}
            </div>
          </div>
        </div>
      )}

      {/* OFF TRACK section */}
      {offTrackItems.length > 0 && (
        <div>
          <SectionAggregate items={offTrackItems} label="Off Track" isOnTrack={false} />
          <div className="flex gap-3">
            <SectionLabel label="Off Track" isOnTrack={false} />
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {offTrackItems.map((item, idx) => renderCard(item, idx))}
            </div>
          </div>
        </div>
      )}

      {companies.length === 0 && (
        <div className="text-center py-20 text-slate-500 text-sm">Ingen selskaper å vise.</div>
      )}
    </div>
  );
};

export default PulseView;
