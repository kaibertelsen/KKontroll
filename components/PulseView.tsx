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
  pct: number;
  onTrack: boolean;
}

const PulseView: React.FC<PulseViewProps> = ({ companies, dateLabel, onSelectCompany }) => {
  const items: PulseCompany[] = companies.map(c => {
    const isScenario = c.budgetType === 'scenario';
    const nedre = isScenario ? (c.calculatedBudgetYTDLow ?? c.calculatedBudgetYTD) : c.calculatedBudgetYTD;
    const ovre = isScenario ? (c.calculatedBudgetYTDHigh ?? c.calculatedBudgetYTD) : c.calculatedBudgetYTD;
    const result = c.resultYTD ?? 0;

    // No reporting / zero result → always OFF TRACK
    const hasReport = result !== 0;
    const withinRange = isScenario
      ? result >= nedre && result <= ovre
      : result >= nedre;
    const onTrack = hasReport && withinRange;

    const pct = nedre !== 0 ? ((result - nedre) / Math.abs(nedre)) * 100 : 0;

    return { company: c, nedre, ovre, result, pct, onTrack };
  });

  const onTrackItems = items
    .filter(i => i.onTrack)
    .sort((a, b) => b.pct - a.pct);

  const offTrackItems = items
    .filter(i => !i.onTrack)
    .sort((a, b) => a.pct - b.pct);

  const renderCard = (item: PulseCompany, idx: number) => {
    const { company, nedre, ovre, result, onTrack } = item;
    const isScenario = company.budgetType === 'scenario';
    const hasReport = result !== 0;

    const range = ovre - nedre;
    let barPct = 0;
    if (range > 0) {
      barPct = Math.max(0, Math.min(100, ((result - nedre) / range) * 100));
    } else {
      barPct = result >= nedre ? 100 : 0;
    }

    const resultColor = !hasReport
      ? 'text-slate-400 dark:text-slate-500'
      : onTrack
        ? 'text-emerald-600 dark:text-emerald-400'
        : result > ovre
          ? 'text-sky-600 dark:text-sky-400'
          : 'text-rose-600 dark:text-rose-400';

    const barColor = !hasReport
      ? 'bg-slate-200 dark:bg-slate-600'
      : onTrack
        ? 'bg-emerald-500'
        : result < nedre
          ? 'bg-rose-500'
          : 'bg-sky-400';

    return (
      <div
        key={company.id}
        onClick={() => onSelectCompany?.(company)}
        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 cursor-pointer hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200 select-none"
      >
        {/* Header */}
        <div className="flex items-start gap-2 mb-3">
          <span className="text-slate-300 dark:text-slate-600 text-[10px] font-bold min-w-[16px] mt-0.5">{idx + 1}</span>
          <span className="text-slate-800 dark:text-slate-100 text-xs font-semibold leading-tight line-clamp-2">{company.name}</span>
        </div>

        {/* NEDRE | RESULTAT | ØVRE */}
        <div className="grid grid-cols-3 gap-1 mb-3">
          <div>
            <div className="text-[8px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold mb-0.5">Nedre</div>
            <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{formatCurrency(nedre)}</div>
          </div>
          <div className="text-center">
            <div className="text-[8px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold mb-0.5">Resultat</div>
            <div className={`text-[13px] font-extrabold ${resultColor}`}>
              {hasReport ? formatCurrency(result) : '–'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[8px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold mb-0.5">Øvre</div>
            <div className="flex justify-end">
              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${isScenario ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                {formatCurrency(ovre)}
              </span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: hasReport ? `${barPct}%` : '0%' }}
          />
        </div>
      </div>
    );
  };

  const SectionLabel = ({ label, isOnTrack }: { label: string; isOnTrack: boolean }) => (
    <div className={`flex items-center justify-center w-8 self-stretch rounded-lg ${isOnTrack ? 'bg-emerald-600' : 'bg-slate-400 dark:bg-slate-600'}`}>
      <span
        className="text-white text-[10px] font-black uppercase"
        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: '0.2em' }}
      >
        {label}
      </span>
    </div>
  );

  const SectionAggregate = ({ items, label, isOnTrack }: { items: PulseCompany[]; label: string; isOnTrack: boolean }) => {
    const totNedre = items.reduce((s, i) => s + i.nedre, 0);
    const totOvre = items.reduce((s, i) => s + i.ovre, 0);
    const totResult = items.reduce((s, i) => s + i.result, 0);
    return (
      <div className={`flex items-center gap-4 px-5 py-3 rounded-xl mb-3 border ${
        isOnTrack
          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/40'
          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
      }`}>
        <span className={`text-sm font-black uppercase tracking-widest ${isOnTrack ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
          {label}
        </span>
        <span className="text-slate-400 dark:text-slate-500 text-xs">{dateLabel}</span>
        <div className="flex gap-6 ml-auto">
          <div>
            <div className="text-[8px] uppercase text-slate-400 tracking-widest font-bold">Nedre</div>
            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatCurrency(totNedre)}</div>
          </div>
          <div>
            <div className="text-[8px] uppercase text-slate-400 tracking-widest font-bold">Resultat</div>
            <div className={`text-sm font-bold ${isOnTrack ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {formatCurrency(totResult)}
            </div>
          </div>
          <div>
            <div className="text-[8px] uppercase text-slate-400 tracking-widest font-bold">Øvre</div>
            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatCurrency(totOvre)}</div>
          </div>
        </div>
      </div>
    );
  };

  // --- SUMMARY BAR ---
  const totNedre = items.reduce((s, i) => s + i.nedre, 0);
  const totOvre = items.reduce((s, i) => s + i.ovre, 0);
  const totResult = items.reduce((s, i) => s + i.result, 0);
  const totBudget = companies.reduce((s, c) => s + (c.calculatedBudgetYTD || 0), 0);
  const totReceivables = companies.reduce((s, c) => s + (c.receivables || 0), 0);
  const totPayables = companies.reduce((s, c) => s + (c.accountsPayable || 0), 0);
  const totDiff = totReceivables - totPayables;

  const curYear = new Date().getFullYear();

  const resultOk = totResult >= totNedre;
  const barRange = totOvre - totNedre;
  const barPctSum = barRange > 0 ? Math.max(0, Math.min(100, ((totResult - totNedre) / barRange) * 100)) : (totResult >= totNedre ? 100 : 0);

  const SumBar = () => (
    <div className="flex gap-3 mt-8">
      {/* SUM label */}
      <div className="flex items-center justify-center w-8 self-stretch rounded-lg bg-indigo-600">
        <span
          className="text-white text-[10px] font-black uppercase"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', letterSpacing: '0.2em' }}
        >
          Sum
        </span>
      </div>

      {/* Summary card */}
      <div className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-5 py-4 flex flex-wrap items-center gap-4">

        {/* NEDRE / RESULTAT / ØVRE + bar */}
        <div className="flex-1 min-w-[220px]">
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div>
              <div className="text-[8px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold mb-0.5">Nedre</div>
              <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatCurrency(totNedre)}</div>
            </div>
            <div className="text-center">
              <div className="text-[8px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold mb-0.5">Resultat</div>
              <div className={`text-base font-extrabold ${resultOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {formatCurrency(totResult)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[8px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold mb-0.5">Øvre</div>
              <div className="text-sm font-bold px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 inline-block">
                {formatCurrency(totOvre)}
              </div>
            </div>
          </div>
          <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${resultOk ? 'bg-emerald-500' : 'bg-rose-500'}`}
              style={{ width: `${barPctSum}%` }}
            />
          </div>
        </div>

        <div className="w-px h-10 bg-slate-100 dark:bg-slate-700 hidden sm:block" />

        {/* Budsjett */}
        <div className="min-w-[100px]">
          <div className="text-[8px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold mb-0.5">{curYear} Budsjett</div>
          <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatCurrency(totBudget)}</div>
        </div>

        <div className="w-px h-10 bg-slate-100 dark:bg-slate-700 hidden sm:block" />

        {/* Kunder */}
        <div className="min-w-[90px]">
          <div className="text-[8px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold mb-0.5">Kunder</div>
          <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatCurrency(totReceivables)}</div>
        </div>

        {/* Leverandører */}
        <div className="min-w-[90px]">
          <div className="text-[8px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold mb-0.5">Leverandører</div>
          <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatCurrency(totPayables)}</div>
        </div>

        {/* Differanse */}
        <div className="min-w-[90px]">
          <div className="text-[8px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold mb-0.5">Differanse</div>
          <div className={`text-sm font-bold ${totDiff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {formatCurrency(totDiff)}
          </div>
        </div>

      </div>
    </div>
  );

  return (
    <div className="min-h-[60vh] space-y-8">
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
        <div className="text-center py-20 text-slate-400 dark:text-slate-500 text-sm">Ingen selskaper å vise.</div>
      )}

      {companies.length > 0 && <SumBar />}
    </div>
  );
};

export default PulseView;
