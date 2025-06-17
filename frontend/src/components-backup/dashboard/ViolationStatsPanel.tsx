'use client';

import React from 'react';

interface StatsCardProps {
  count: number;
  label: string;
  sublabel?: string;
  period?: string;
  className?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ count, label, sublabel, period, className }) => {
  return (
    <div className={`bg-surface rounded-card p-6 shadow-card ${className}`}>
      <div className="text-h1 font-bold mb-2">{count}</div>
      <div className="text-h3 font-semibold mb-1">{label}</div>
      {sublabel && <div className="text-sm text-text-secondary">{sublabel}</div>}
      {period && <div className="text-sm text-text-secondary">{period}</div>}
    </div>
  );
};

interface ViolationStatsPanelProps {
  openCount: number;
  inReviewCount: number;
  pendingRemediationCount: number;
  closedCount: number;
  monthlyTotal: number;
}

const ViolationStatsPanel: React.FC<ViolationStatsPanelProps> = ({
  openCount,
  inReviewCount,
  pendingRemediationCount,
  closedCount,
  monthlyTotal
}) => {
  const currentMonth = new Date().toLocaleString('default', { month: 'long' });
  const currentYear = new Date().getFullYear();

  return (
    <div className="mb-8">
      <h2 className="mb-4">Violation Statistics</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatsCard 
          count={openCount} 
          label="Open Violations" 
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
          label="Total Violations" 
          sublabel={`Last 30 Days`}
          className="border-l-4 border-secondary" 
        />
      </div>
    </div>
  );
};

// For demo or development, export a component with mock data
export const ViolationStatsPanelDemo: React.FC = () => {
  return (
    <ViolationStatsPanel
      openCount={270}
      inReviewCount={58}
      pendingRemediationCount={94}
      closedCount={312}
      monthlyTotal={734}
    />
  );
};

export default ViolationStatsPanel;
