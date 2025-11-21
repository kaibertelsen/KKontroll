import React from 'react';
import { StatusType } from '../types';

interface StatusBadgeProps {
  deviation: number;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ deviation }) => {
  let status: StatusType = 'success';
  let label = 'På budsjett';

  if (deviation < -15) {
    status = 'danger';
    label = 'Betydelig avvik';
  } else if (deviation < 0) {
    status = 'warning';
    label = 'Under forventning';
  }

  const styles = {
    success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    danger: 'bg-rose-100 text-rose-700 border-rose-200',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}
    >
      {label}
    </span>
  );
};

export default StatusBadge;
