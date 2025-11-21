
import { CompanyData } from './types';

// Helper to simulate annual budget based on the mock YTD values provided earlier
// Assuming previous YTD was approx Oct (10 months), so Annual = YTD / 10 * 12 roughly.
export const INITIAL_DATA: CompanyData[] = [
  {
    id: 1,
    name: 'VPS',
    manager: 'Kai',
    resultYTD: 1240000,
    budgetTotal: 1560000, // 130k * 12
    liquidity: 540000,
    liquidityDate: '15.11.23',
    lastReportDate: '15.10.2023',
    lastReportBy: 'Anna Hansen',
    comment: 'Sterk vekst i Q3. Kostnadene holdes godt under kontroll.',
    trendHistory: 12.5,
  },
  {
    id: 2,
    name: 'BCC',
    manager: 'Kai',
    resultYTD: 820000,
    budgetTotal: 1560000,
    liquidity: 310000,
    liquidityDate: '14.11.23',
    lastReportDate: '14.10.2023',
    lastReportBy: 'Bjørn Kjos',
    comment: 'Noe lavere inntekter enn forventet, men likviditeten er solid.',
    trendHistory: -4.2,
  },
  {
    id: 3,
    name: 'AK',
    manager: 'Kai',
    resultYTD: 450000,
    budgetTotal: 1560000,
    liquidity: 120000,
    liquidityDate: '12.11.23',
    lastReportDate: '12.10.2023',
    lastReportBy: 'Cecilie Berg',
    comment: 'Betydelig avvik grunnet engangskostnader. Tiltak er iverksatt.',
    trendHistory: -15.8,
  },
  {
    id: 4,
    name: 'BPS',
    manager: 'Kai',
    resultYTD: 2050000,
    budgetTotal: 1560000,
    liquidity: 780000,
    liquidityDate: '16.11.23',
    lastReportDate: '16.10.2023',
    lastReportBy: 'David Eriksen',
    comment: 'Meget solid resultat. Prosjekter leveres på tid og budsjett.',
    trendHistory: 8.4,
  },
  {
    id: 5,
    name: 'HH',
    manager: 'Kai',
    resultYTD: 310000,
    budgetTotal: 1560000,
    liquidity: 95000,
    liquidityDate: '10.11.23',
    lastReportDate: '10.10.2023',
    lastReportBy: 'Erik Solbakken',
    comment: 'Mindre avvik. Likviditetssituasjonen overvåkes nøye.',
    trendHistory: -2.1,
  },
  {
    id: 6,
    name: 'BUK',
    manager: 'Kai',
    resultYTD: 760000,
    budgetTotal: 1560000,
    liquidity: 230000,
    liquidityDate: '15.11.23',
    lastReportDate: '15.10.2023',
    lastReportBy: 'Frida Karlsen',
    comment: 'Positive tall over hele linjen. Godt arbeid i avdelingen.',
    trendHistory: 5.5,
  },
  {
    id: 7,
    name: 'HW',
    manager: 'Kai',
    resultYTD: 190000,
    budgetTotal: 1560000,
    liquidity: 70000,
    liquidityDate: '09.11.23',
    lastReportDate: '09.10.2023',
    lastReportBy: 'Gunnar Lunde',
    comment: 'Utfordrende kvartal. Revisjon av budsjett for Q4 anbefales.',
    trendHistory: -8.9,
  },
  {
    id: 8,
    name: 'MIL',
    manager: 'Kai',
    resultYTD: 1480000,
    budgetTotal: 1560000,
    liquidity: 610000,
    liquidityDate: '16.11.23',
    lastReportDate: '16.10.2023',
    lastReportBy: 'Hanne Sørheim',
    comment: 'Stabilt drift. Resultatet er nesten nøyaktig på budsjett.',
    trendHistory: 1.2,
  },
  {
    id: 9,
    name: 'PHR',
    manager: 'Kai',
    resultYTD: 520000,
    budgetTotal: 600000,
    liquidity: 180000,
    liquidityDate: '17.11.23',
    lastReportDate: '17.10.2023',
    lastReportBy: 'Ingrid Moe',
    comment: 'Nytt selskap i porteføljen. Oppstarten går etter planen.',
    trendHistory: 25.0, // Nytt selskap, stor vekst
  },
];

export const formatCurrency = (value: number): string => {
  const absValue = Math.abs(value);
  
  // Format large numbers with "M"
  if (absValue >= 1000000) {
    const inMillions = value / 1000000;
    // Use 1 decimal if needed (e.g. 1.2 M), otherwise 0 (e.g. 5 M)
    return new Intl.NumberFormat('no-NO', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(inMillions) + ' M';
  }

  return new Intl.NumberFormat('no-NO', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(value);
};
