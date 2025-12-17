import React from 'react';
import MetricCard from '../MetricCard';
import AnimatedGrid from '../AnimatedGrid';
import { ComputedCompanyData } from '../../types';

interface DashboardGridProps {
  sortedData: ComputedCompanyData[];
  isSortMode: boolean;
  cardSize: 'normal' | 'compact';
  zoomLevel: number;
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
  onSelectCompany,
  onDragStart,
  onDragEnter,
  onDragEnd
}) => {

  // Determine grid columns based on zoom level (Applies primarily to XL screens)
  const getGridColumnClass = () => {
      if (zoomLevel >= 110) return 'xl:grid-cols-2 gap-8';
      if (zoomLevel === 100) return 'xl:grid-cols-3 gap-6'; // Standard
      if (zoomLevel >= 80) return 'xl:grid-cols-4 gap-4';
      return 'xl:grid-cols-5 gap-3'; // 60-70%
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
                zoomLevel={zoomLevel} // Pass zoom level
            />
        ))}
    </AnimatedGrid>
  );
};

export default DashboardGrid;