'use client';

import React, { useState, useEffect } from 'react';
import { dashboardService, FlagStats } from '@/services/dashboardService';
import TimeRangeSelector, { TimeRange } from './TimeRangeSelector';

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

const ConnectedFlagStatsPanel: React.FC = () => {
  const [flagStats, setFlagStats] = useState<FlagStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d'); // Default to 30 days

  // Define fetchStats function outside useEffect so it can be reused
  const fetchStats = async () => {
    try {
      if (!isLoading) setIsLoading(true);
      
      // Create date range based on selected timeframe
      let params = {};
      
      if (timeRange === '30d') {
        // Create date range for last 30 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
        
        // Format dates as YYYY-MM-DD strings
        const endDateStr = endDate.toISOString().split('T')[0];
        const startDateStr = startDate.toISOString().split('T')[0];
        
        params = { startDate: startDateStr, endDate: endDateStr };
        
        console.log('Fetching flag stats with 30-day filter:', params);
        console.log('Date objects:', { 
          startDateObj: startDate, 
          endDateObj: endDate, 
          startDateStr, 
          endDateStr 
        });
      } else {
        console.log('Fetching flag stats with NO date range filter');
      }
      
      const response = await dashboardService.getFlagStats(params);
      
      console.log('Received flag stats:', response.data);
      
      setFlagStats(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching flag stats:', err);
      setError(err.response?.data?.message || 'Failed to load flag statistics');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle time range change
  const handleTimeRangeChange = (newRange: TimeRange) => {
    setTimeRange(newRange);
  };

  useEffect(() => {
    // Fetch data immediately when component mounts or time range changes
    fetchStats();
    
    // Set up polling interval (refresh every 60 seconds)
    const intervalId = setInterval(() => {
      fetchStats();
    }, 60000); // 60000 ms = 60 seconds
    
    // Clean up interval when component unmounts
    return () => clearInterval(intervalId);
  }, [timeRange]); // Re-run when timeRange changes

  // Display loading state
  if (isLoading) {
    return (
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2>Flag Statistics</h2>
          <TimeRangeSelector 
            selectedRange={timeRange}
            onChange={handleTimeRangeChange}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-surface rounded-card p-6 shadow-card animate-pulse h-36"></div>
          <div className="bg-surface rounded-card p-6 shadow-card animate-pulse h-36"></div>
          <div className="bg-surface rounded-card p-6 shadow-card animate-pulse h-36"></div>
          <div className="bg-surface rounded-card p-6 shadow-card animate-pulse h-36"></div>
          <div className="bg-surface rounded-card p-6 shadow-card animate-pulse h-36"></div>
        </div>
      </div>
    );
  }

  // Display error state
  if (error) {
    return (
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2>Flag Statistics</h2>
          <TimeRangeSelector 
            selectedRange={timeRange}
            onChange={handleTimeRangeChange}
          />
        </div>
        <div className="bg-error bg-opacity-10 p-4 rounded-md text-error">
          <p>{error}</p>
          <button 
            className="mt-2 underline"
            onClick={fetchStats} // Directly call fetchStats to retry
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Determine counts based on flagStats data
  const openCount = flagStats?.pending || 0;
  const inReviewCount = flagStats?.inReview || 0;
  const pendingRemediationCount = flagStats?.remediating || 0;
  const closedCount = flagStats?.closed || 0;
  const monthlyTotal = flagStats?.total || 0;
  
  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2>Flag Statistics</h2>
        <TimeRangeSelector 
          selectedRange={timeRange}
          onChange={handleTimeRangeChange}
        />
      </div>
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
          period={timeRange === '30d' ? 'Last 30 Days' : 'All Time'}
          className="border-l-4 border-success" 
        />
        <StatsCard 
          count={monthlyTotal} 
          label="Total Flags" 
          period={timeRange === '30d' ? 'Last 30 Days' : 'All Time'}
          className="border-l-4 border-secondary" 
        />
      </div>
    </div>
  );
};

export default ConnectedFlagStatsPanel;
