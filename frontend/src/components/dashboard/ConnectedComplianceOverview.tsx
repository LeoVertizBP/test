'use client';

import React, { useState, useEffect } from 'react';
import { dashboardService, ComplianceOverview } from '@/services/dashboardService';
import EnhancedComplianceOverview from './EnhancedComplianceOverview';
import TimeRangeSelector, { TimeRange } from './TimeRangeSelector';

const ConnectedComplianceOverview: React.FC = () => {
  const [complianceData, setComplianceData] = useState<ComplianceOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d'); // Default to 30 days

  // Define fetchData function outside useEffect so it can be reused
  const fetchData = async () => {
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
        
        console.log('Fetching compliance overview with 30-day filter:', params);
      } else {
        console.log('Fetching compliance overview with NO date range filter');
      }
      
      const response = await dashboardService.getComplianceOverview(params);
      
      console.log('Received compliance overview data:', response.data);
      
      setComplianceData(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching compliance overview:', err);
      setError(err.response?.data?.message || 'Failed to load compliance overview');
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
    fetchData();
    
    // Set up polling interval (refresh every 60 seconds)
    const intervalId = setInterval(() => {
      fetchData();
    }, 60000); // 60000 ms = 60 seconds
    
    // Clean up interval when component unmounts
    return () => clearInterval(intervalId);
  }, [timeRange]); // Re-run when timeRange changes

  // Transform the data to match the format expected by EnhancedComplianceOverview
  const transformedData = complianceData?.publishers.map(publisher => ({
    id: publisher.name.toLowerCase().replace(/\s+/g, '-'), // Generate an ID from the name
    name: publisher.name,
    itemsScanned: publisher.totalItems,
    violationsFound: publisher.flaggedItems,
    violationRate: publisher.violationRate,
    avgRemediationTimeHours: publisher.avgRemediationTimeHours || 0, // Use actual value from API
    trend: publisher.trend,
    remediationTrend: publisher.remediationTrend || 0 // Add remediationTrend from API
  })) || [];

  // Display loading state
  if (isLoading) {
    return (
      <div className="card card-hover mb-6">
        <div className="flex justify-between items-center mb-4 p-6 pb-0">
          <h2 className="mb-0">Publisher Compliance Overview</h2>
          <TimeRangeSelector 
            selectedRange={timeRange}
            onChange={handleTimeRangeChange}
          />
        </div>
        <div className="p-6 animate-pulse">
          <div className="h-8 bg-neutral-light rounded w-full mb-4"></div>
          <div className="h-64 bg-neutral-light rounded w-full"></div>
        </div>
      </div>
    );
  }

  // Display error state
  if (error) {
    return (
      <div className="card card-hover mb-6">
        <div className="flex justify-between items-center mb-4 p-6 pb-0">
          <h2 className="mb-0">Publisher Compliance Overview</h2>
          <TimeRangeSelector 
            selectedRange={timeRange}
            onChange={handleTimeRangeChange}
          />
        </div>
        <div className="p-6">
          <div className="bg-error bg-opacity-10 p-4 rounded-md text-error">
            <p>{error}</p>
            <button 
              className="mt-2 underline"
              onClick={fetchData} // Directly call fetchData to retry
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Display empty state if no data
  if (transformedData.length === 0) {
    return (
      <div className="card card-hover mb-6">
        <div className="flex justify-between items-center mb-4 p-6 pb-0">
          <h2 className="mb-0">Publisher Compliance Overview</h2>
          <TimeRangeSelector 
            selectedRange={timeRange}
            onChange={handleTimeRangeChange}
          />
        </div>
        <div className="p-6 text-center text-text-secondary">
          <p>No publisher compliance data available for the selected time period.</p>
        </div>
      </div>
    );
  }

  // Display data
  return (
    <div className="card card-hover mb-6">
      <div className="flex justify-between items-center mb-4 p-6 pb-0">
        <h2 className="mb-0">Publisher Compliance Overview</h2>
        <TimeRangeSelector 
          selectedRange={timeRange}
          onChange={handleTimeRangeChange}
        />
      </div>
      <div className="p-6">
        <EnhancedComplianceOverview publishers={transformedData} />
      </div>
    </div>
  );
};

export default ConnectedComplianceOverview;
