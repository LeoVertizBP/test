'use client';

import React, { useState, useEffect } from 'react';
import { dashboardService, ViolationStats } from '@/services/dashboardService';
import TimeRangeSelector, { TimeRange } from './TimeRangeSelector';

interface ViolationBreakdownProps {
  title: string;
  items: {
    name: string;
    count: number;
    percentage: number;
  }[];
}

const ViolationBreakdown: React.FC<ViolationBreakdownProps> = ({ title, items }) => {
  // Sort by count (highest first)
  const sortedItems = [...items].sort((a, b) => b.count - a.count);
  
  return (
    <div>
      <h3 className="text-h3 font-medium mb-3">{title}</h3>
      {sortedItems.length > 0 ? (
        <div className="space-y-3">
          {sortedItems.map((item, index) => (
            <div key={index}>
              <div className="flex justify-between text-sm mb-1">
                <span>{item.name}</span>
                <span className="font-medium">{item.count} ({Math.round(item.percentage)}%)</span>
              </div>
              <div className="w-full bg-background h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-primary h-full" 
                  style={{ width: `${item.percentage}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-text-secondary py-4">
          <p>No data available</p>
        </div>
      )}
    </div>
  );
};

const ConnectedViolationStatsPanel: React.FC = () => {
  const [violationStats, setViolationStats] = useState<ViolationStats | null>(null);
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
        
        console.log('Fetching violation stats with 30-day filter:', params);
        console.log('Date objects:', { 
          startDateObj: startDate, 
          endDateObj: endDate, 
          startDateStr, 
          endDateStr 
        });
      } else {
        console.log('Fetching violation stats with NO date range filter');
      }
      
      const response = await dashboardService.getViolationStats(params);
      
      setViolationStats(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching violation stats:', err);
      setError(err.response?.data?.message || 'Failed to load violation statistics');
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
          <div>
            <h2 className="mb-1">Violations Analysis</h2>
            <div className="text-sm text-text-secondary">
              {timeRange === '30d' ? 'Last 30 Days' : 'All Time'}
            </div>
          </div>
          <TimeRangeSelector 
            selectedRange={timeRange}
            onChange={handleTimeRangeChange}
          />
        </div>
        <div className="card">
          <div className="animate-pulse p-6">
            <div className="h-8 bg-background rounded w-1/3 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <div className="h-6 bg-background rounded w-1/2 mb-4"></div>
                <div className="space-y-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i}>
                      <div className="flex justify-between mb-2">
                        <div className="h-4 bg-background rounded w-1/3"></div>
                        <div className="h-4 bg-background rounded w-1/6"></div>
                      </div>
                      <div className="h-2 bg-background rounded-full w-full"></div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="h-6 bg-background rounded w-1/2 mb-4"></div>
                <div className="space-y-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i}>
                      <div className="flex justify-between mb-2">
                        <div className="h-4 bg-background rounded w-1/3"></div>
                        <div className="h-4 bg-background rounded w-1/6"></div>
                      </div>
                      <div className="h-2 bg-background rounded-full w-full"></div>
                    </div>
                  ))}
                </div>
              </div>
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
          <div>
            <h2 className="mb-1">Violations Analysis</h2>
            <div className="text-sm text-text-secondary">
              {timeRange === '30d' ? 'Last 30 Days' : 'All Time'}
            </div>
          </div>
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
              onClick={fetchStats} // Directly call fetchStats to retry
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default empty state if no data
  if (!violationStats) {
    return (
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="mb-1">Violations Analysis</h2>
            <div className="text-sm text-text-secondary">
              {timeRange === '30d' ? 'Last 30 Days' : 'All Time'}
            </div>
          </div>
          <TimeRangeSelector 
            selectedRange={timeRange}
            onChange={handleTimeRangeChange}
          />
        </div>
        <div className="card p-6 text-center">
          <p className="text-text-secondary">No violation data available.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="mb-1">Violations Analysis</h2>
          <div className="text-sm text-text-secondary">
            {timeRange === '30d' ? 'Last 30 Days' : 'All Time'}
          </div>
        </div>
        <TimeRangeSelector 
          selectedRange={timeRange}
          onChange={handleTimeRangeChange}
        />
      </div>
      <div className="card p-6">
        <div className="flex flex-col mb-6">
          <div className="flex items-center mb-2">
            <div className="text-h1 font-bold mr-3">{violationStats.total}</div>
            <div className="text-text-secondary">Total Violations</div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* By Publisher breakdown - map API response to component format */}
          <ViolationBreakdown 
            title="Violations by Publisher" 
            items={(violationStats.byPublisher || []).map(item => ({
              name: item.publisher,
              count: item.count,
              percentage: item.percentage
            }))}
          />
          
          {/* By Product breakdown - map API response to component format */}
          <ViolationBreakdown 
            title="Violations by Product" 
            items={(violationStats.byProduct || []).map(item => ({
              name: item.product,
              count: item.count,
              percentage: item.percentage
            }))}
          />
          
          {/* Removed Violations by Severity section as requested */}
        </div>
      </div>
    </div>
  );
};

export default ConnectedViolationStatsPanel;
