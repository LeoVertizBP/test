'use client';

import React from 'react';

interface StatsCardProps {
  count: number;
  label: string;
  period?: string;
  className?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ count, label, period, className }) => {
  return (
    <div className={`bg-surface rounded-card p-6 shadow-card ${className}`}>
      <div className="text-h1 font-bold mb-2">{count}</div>
      <div className="text-h3 font-semibold mb-1">{label}</div>
      {period && <div className="text-sm text-text-secondary">{period}</div>}
    </div>
  );
};

interface FlagStatsPanelProps {
  openCount: number;
  inReviewCount: number;
  pendingRemediationCount: number;
  closedCount: number;
  monthlyTotal: number;
}

const FlagStatsPanel: React.FC<FlagStatsPanelProps> = ({
  openCount,
  inReviewCount,
  pendingRemediationCount,
  closedCount,
  monthlyTotal
}) => {
  return (
    <div className="mb-8">
      <h2 className="mb-4">Flag Statistics</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatsCard 
          count={openCount} 
          label="Open Flags" 
          className="border-l-4 border-error" 
        />
        <StatsCard 
          count={inReviewCount} 
          label="In Review" 
          className="border-l-4 border-warning" 
        />
        <StatsCard 
          count={pendingRemediationCount} 
          label="Pending Remediation" 
          className="border-l-4 border-primary" 
        />
        <StatsCard 
          count={closedCount} 
          label="Closed" 
          period="Last 30 Days"
          className="border-l-4 border-success" 
        />
        <StatsCard 
          count={monthlyTotal} 
          label="Total Flags" 
          period="Last 30 Days"
          className="border-l-4 border-secondary" 
        />
      </div>
    </div>
  );
};

// For demo or development, export a component with mock data
export const FlagStatsPanelDemo: React.FC = () => {
  return (
    <FlagStatsPanel
      openCount={214}
      inReviewCount={42}
      pendingRemediationCount={68}
      closedCount={156}
      monthlyTotal={480}
    />
  );
};

export default FlagStatsPanel;
