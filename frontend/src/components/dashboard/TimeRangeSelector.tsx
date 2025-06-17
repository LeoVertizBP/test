'use client';

import React from 'react';

export type TimeRange = '30d' | 'all';

interface TimeRangeSelectorProps {
  selectedRange: TimeRange;
  onChange: (range: TimeRange) => void;
  className?: string;
}

const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({ 
  selectedRange, 
  onChange,
  className = ''
}) => {
  return (
    <div className={`inline-flex rounded-md shadow-sm ${className}`}>
      <button
        type="button"
        className={`px-4 py-2 text-sm font-medium rounded-l-md border ${
          selectedRange === '30d'
            ? 'bg-primary text-white border-primary'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        }`}
        onClick={() => onChange('30d')}
        aria-current={selectedRange === '30d' ? 'page' : undefined}
      >
        Last 30 Days
      </button>
      <button
        type="button"
        className={`px-4 py-2 text-sm font-medium rounded-r-md border-t border-r border-b ${
          selectedRange === 'all'
            ? 'bg-primary text-white border-primary'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        }`}
        onClick={() => onChange('all')}
        aria-current={selectedRange === 'all' ? 'page' : undefined}
      >
        All Time
      </button>
    </div>
  );
};

export default TimeRangeSelector;
