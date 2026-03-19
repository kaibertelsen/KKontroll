import React from 'react';
import MetricCard from '../MetricCard';
import AnimatedGrid from '../AnimatedGrid';
import { ComputedCompanyData } from '../../types';

export interface VisibleFields {
  omsetning: boolean;
  kostnader: boolean;
  resultat: boolean;
  budsjett: boolean;
  likviditet: boolean;
  fordringer: boolean;
  leverandorgjeld: boolean;
  kortsiktigGjeld: boolean;
  offAvgifter: boolean;
  lonnskostnad: boolean;
  nettoArbeidskapital: boolean;
}

interface DashboardGridProps {
  sortedData: ComputedCompanyData[];
  isSortMode: boolean;
  cardSize: 'normal' | 'compact';
  zoomLevel: number;
  showShortTermDebt: boolean;
  showLoyaltyBonus: boolean;
  visibleFields: VisibleFields;
  onSelectCompany: (company: ComputedCompanyData) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragEnter: (e: React.DragEvent, index: number) => void;
  onDragEnd: () => void;
}

const DashboardGrid: React.FC<DashboardGridProps> = ({
  sortedData,
  isSortMode,
  cardSize,
  zoomLevel,
  showShortTermDebt,
  showLoyaltyBonus,
  visibleFields,
  onSelectCompany,
  onDragStart,
  onDragEnter,
  onDragEnd
}) => {

  const getGridColumnClass = () => {
      if (zoomLevel >= 110) return 'xl:grid-cols-2 gap-8';
      if (zoomLevel === 100) return 'xl:grid-cols-3 gap-6';
      if (zoomLevel >= 80) return 'xl:grid-cols-4 gap-4';
      return 'xl:grid-cols-5 gap-3';
  };

  return (
    <AnimatedGrid className={`grid grid-cols-1 sm:grid-cols-2 ${getGridColumnClass()} pb-24 transition-all duration-500 ease-in-out`}>
        {sortedData.map((company, index) => (
            <MetricCard
                key={company.id}
                data={company}
                onSelect={onSelectCompany}
                isSortMode={isSortMode}
                onDragStart={onDragStart}
                onDragEnter={onDragEnter}
                onDragEnd={onDragEnd}
                index={index}
                cardSize={cardSize}
                zoomLevel={zoomLevel}
                showShortTermDebt={showShortTermDebt}
                showLoyaltyBonus={showLoyaltyBonus}
                visibleFields={visibleFields}
            />
        ))}
    </AnimatedGrid>
  );
};

export default DashboardGrid;
