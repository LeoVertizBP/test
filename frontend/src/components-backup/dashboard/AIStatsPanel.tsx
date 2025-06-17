'use client';

import React from 'react';

interface StatsCardProps {
  value: string;
  label: string;
  sublabel?: string;
  className?: string;
  icon?: React.ReactNode;
  trend?: number; // positive values indicate improvement, negative indicate decline
}

const StatsCard: React.FC<StatsCardProps> = ({ value, label, sublabel, className, icon, trend }) => {
  // Display trend arrow if trend is provided
  const renderTrend = () => {
    if (trend === undefined) return null;
    
    const formattedTrend = Math.abs(trend).toFixed(1);
    
    if (trend > 2) {
      return (
        <div className="flex items-center text-success text-sm font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          +{formattedTrend}%
        </div>
      );
    } else if (trend > 0) {
      return (
        <div className="flex items-center text-success text-sm font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          +{formattedTrend}%
        </div>
      );
    } else if (trend < -2) {
      return (
        <div className="flex items-center text-error text-sm font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          {formattedTrend}%
        </div>
      );
    } else if (trend < 0) {
      return (
        <div className="flex items-center text-error text-sm font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          {formattedTrend}%
        </div>
      );
    } else {
      return (
        <div className="flex items-center text-text-secondary text-sm font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
          0%
        </div>
      );
    }
  };
  
  return (
    <div className={`bg-surface rounded-card p-6 shadow-card ${className}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-h1 font-bold">{value}</div>
        {icon && <div className="text-secondary">{icon}</div>}
      </div>
      <div className="flex items-center justify-between">
        <div className="text-h3 font-semibold mb-1">{label}</div>
        {renderTrend()}
      </div>
      {sublabel && <div className="text-sm text-text-secondary">{sublabel}</div>}
    </div>
  );
};

interface AIStatsPanelProps {
  accuracyRate: number; // as percentage
  accuracyTrend: number; // percentage change
  averageConfidence: number; // as percentage
  confidenceTrend: number; // percentage change
  flagsBypassed: number;
  flagsBypassedTrend: number; // percentage change
  averageReviewTime: number; // in seconds
  reviewTimeTrend: number; // percentage change
  timeSavedInHours: number;
  timeSavedTrend: number; // percentage change
}

const AIStatsPanel: React.FC<AIStatsPanelProps> = ({
  accuracyRate,
  accuracyTrend,
  averageConfidence,
  confidenceTrend,
  flagsBypassed,
  flagsBypassedTrend,
  averageReviewTime,
  reviewTimeTrend,
  timeSavedInHours,
  timeSavedTrend
}) => {
  // Helper to format time in human-readable format
  const formatTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes}m ${seconds % 60}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    }
  };

  return (
    <div className="mb-8">
      <h2 className="mb-4">AI Performance Metrics <span className="text-sm text-text-secondary font-normal ml-2">Last 30 Days</span></h2>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatsCard 
          value={`${accuracyRate}%`} 
          label="Accuracy Rate" 
          className="border-l-4 border-success"
          trend={accuracyTrend}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatsCard 
          value={`${averageConfidence}%`}
          label="Average Confidence"
          className="border-l-4 border-secondary"
          trend={confidenceTrend}
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />
        <StatsCard 
          value={flagsBypassed.toString()} 
          label="Flags Bypassed" 
          sublabel="Auto-approved by AI"
          trend={flagsBypassedTrend}
          className="border-l-4 border-primary"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          }
        />
        <StatsCard 
          value={formatTime(averageReviewTime)}
          label="Average Review Time"
          trend={reviewTimeTrend}
          className="border-l-4 border-warning"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatsCard 
          value={`${timeSavedInHours}h`}
          label="Time Saved" 
          sublabel="Last 30 Days"
          trend={timeSavedTrend}
          className="border-l-4 border-error"
          icon={
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>
    </div>
  );
};

// For demo or development, export a component with mock data
export const AIStatsPanelDemo: React.FC = () => {
  return (
    <AIStatsPanel
      accuracyRate={92}
      accuracyTrend={2.4}
      averageConfidence={76}
      confidenceTrend={-1.2}
      flagsBypassed={183}
      flagsBypassedTrend={5.7}
      averageReviewTime={45}
      reviewTimeTrend={-8.5} // negative is good for review time (faster)
      timeSavedInHours={124}
      timeSavedTrend={12.3}
    />
  );
};

export default AIStatsPanel;
