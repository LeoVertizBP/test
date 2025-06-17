'use client';

import React, { useState, useEffect } from 'react';
import { dashboardService, AIStats } from '@/services/dashboardService';
import TimeRangeSelector, { TimeRange } from './TimeRangeSelector';

interface StatBoxProps {
  title: string;
  value: string | number;
  subtitle?: string;
  className?: string;
}

const StatBox: React.FC<StatBoxProps> = ({ title, value, subtitle, className }) => {
  return (
    <div className={`p-4 rounded-md flex flex-col justify-center ${className}`}>
      <div className="text-sm font-medium mb-1">{title}</div>
      <div className="text-2xl font-bold">{value}</div>
      {subtitle && <div className="text-xs text-text-secondary mt-1">{subtitle}</div>}
    </div>
  );
};

interface ConfidenceBarProps {
  range: string;
  count: number;
  percentage: number;
}

const ConfidenceBar: React.FC<ConfidenceBarProps> = ({ range, count, percentage }) => {
  return (
    <div className="mb-3">
      <div className="flex justify-between mb-1">
        <span className="text-sm">{range}</span>
        <span className="text-sm font-medium">{count} ({Math.round(percentage)}%)</span>
      </div>
      <div className="h-2 bg-background rounded-full overflow-hidden">
        <div 
          className="bg-secondary h-full"
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

const ConnectedAIStatsPanel: React.FC = () => {
  const [aiStats, setAIStats] = useState<AIStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d'); // Default to 30 days

  // Define fetchStats function
  const fetchStats = async () => {
    try {
      setIsLoading(true);
      
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
        
        console.log('Fetching AI stats with 30-day filter:', params);
        console.log('Date objects:', { 
          startDateObj: startDate, 
          endDateObj: endDate, 
          startDateStr, 
          endDateStr 
        });
      } else {
        console.log('Fetching AI stats with NO date range filter');
      }
      
      const response = await dashboardService.getAIStats(params);
      
      console.log('AI Stats response:', response);
      console.log('AI Stats data:', response.data);
      console.log('Average confidence from API:', response.data.averageConfidence);
      
      setAIStats(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching AI stats:', err);
      setError(err.response?.data?.message || 'Failed to load AI performance metrics');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle time range change
  const handleTimeRangeChange = (newRange: TimeRange) => {
    setTimeRange(newRange);
  };

  // Call fetchStats on component mount and set up polling
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
          <h2>AI Analysis Performance</h2>
          <TimeRangeSelector 
            selectedRange={timeRange}
            onChange={handleTimeRangeChange}
          />
        </div>
        <div className="card p-6">
          <div className="animate-pulse">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
              <div className="h-24 bg-background rounded"></div>
              <div className="h-24 bg-background rounded"></div>
              <div className="h-24 bg-background rounded"></div>
            </div>
            <div className="h-6 bg-background rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i}>
                  <div className="flex justify-between mb-1">
                    <div className="h-4 bg-background rounded w-1/4"></div>
                    <div className="h-4 bg-background rounded w-1/6"></div>
                  </div>
                  <div className="h-2 bg-background rounded-full w-full"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Display error state
  if (error) {
    return (
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2>AI Analysis Performance</h2>
          <TimeRangeSelector 
            selectedRange={timeRange}
            onChange={handleTimeRangeChange}
          />
        </div>
        <div className="card">
          <div className="bg-error bg-opacity-10 p-4 rounded-md text-error">
            <p>{error}</p>
            <button 
              className="mt-2 underline"
              onClick={() => fetchStats()} // Retry fetching
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default empty state if no data
  if (!aiStats) {
    return (
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2>AI Analysis Performance</h2>
          <TimeRangeSelector 
            selectedRange={timeRange}
            onChange={handleTimeRangeChange}
          />
        </div>
        <div className="card p-6 text-center">
          <p className="text-text-secondary">No AI performance data available.</p>
        </div>
      </div>
    );
  }
  
  // Format the average confidence and agreement rate as percentages with 2 decimal places
  // The backend already returns these values as percentages (0-100)
  const confidencePercentage = aiStats.averageConfidence.toFixed(2);
  const agreementPercentage = aiStats.agreementRate.toFixed(2);
  
  console.log('Formatted confidence:', confidencePercentage, 'from', aiStats.averageConfidence);
  console.log('Formatted agreement:', agreementPercentage, 'from', aiStats.agreementRate);
  
  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2>AI Analysis Performance</h2>
        <TimeRangeSelector 
          selectedRange={timeRange}
          onChange={handleTimeRangeChange}
        />
      </div>
      <div className="card p-6">
        {/* Stats boxes */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <StatBox 
            title="Items Analyzed" 
            value={aiStats.totalAnalyzed.toLocaleString()}
            subtitle={timeRange === '30d' ? 'Last 30 Days' : 'All Time'}
            className="bg-background"
          />
          <StatBox 
            title="Average Confidence" 
            value={`${confidencePercentage}%`}
            className="bg-background"
          />
          <StatBox 
            title="Human Agreement" 
            value={`${agreementPercentage}%`}
            subtitle={`${aiStats.feedbackCount} Human Reviews`}
            className="bg-background"
          />
        </div>
        
        {/* Confidence distribution */}
        <h3 className="text-h3 font-medium mb-4">Confidence Distribution</h3>
        <div className="space-y-1">
          {aiStats.confidenceDistribution.map((item, index) => (
            <ConfidenceBar 
              key={index}
              range={item.range}
              count={item.count}
              percentage={item.percentage}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ConnectedAIStatsPanel;
