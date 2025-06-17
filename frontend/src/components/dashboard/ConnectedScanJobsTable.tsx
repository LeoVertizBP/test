'use client';

import React, { useEffect, useState } from 'react';
import EnhancedScanJobsTable from './EnhancedScanJobsTable';
import { scanJobService, ScanJob as ApiScanJob } from '../../services/scanJobService';
import { userService } from '../../services/userService';

// Adapter function to convert API scan job format to component format
const adaptScanJob = (apiJob: ApiScanJob): {
  id: string; // Changed from number to string to preserve UUID format
  name: string;
  startDate: string;
  status: string;
  assignee?: string;
  items: number;
  totalFlags: number;
  pendingFlags: number;
  closedFlags: number;
  flagProgress: number;
  isLoading?: boolean;
} => {
  console.log(`adaptScanJob: Processing job ${apiJob.id}`, apiJob);
  
  // Check if assignee_name exists
  if (apiJob.assignee_name) {
    console.log(`adaptScanJob: Job ${apiJob.id} has assignee_name: ${apiJob.assignee_name}`);
  } else if (apiJob.assignee) {
    console.log(`adaptScanJob: Job ${apiJob.id} has assignee but no assignee_name`);
  } else {
    console.log(`adaptScanJob: Job ${apiJob.id} has no assignee or assignee_name`);
  }
  
  // Determine the assignee display value
  let assigneeDisplay: string | undefined = undefined;
  
  if (apiJob.assignee_name) {
    // If assignee_name exists, use it directly
    assigneeDisplay = apiJob.assignee_name;
    console.log(`adaptScanJob: Using assignee_name: ${apiJob.assignee_name}`);
  } else if (apiJob.assignee) {
    // If only assignee ID exists but no name, mark it for proper display
    assigneeDisplay = "User " + apiJob.assignee.substring(0, 8) + "...";
    console.log(`adaptScanJob: No assignee_name, using ID: ${apiJob.assignee}`);
  }
  
  const result = {
    id: apiJob.id, // Keep original string ID (UUID format)
    name: apiJob.name || `Scan ${apiJob.id.substring(0, 8)}`,
    startDate: apiJob.created_at,
    status: apiJob.status,
    assignee: assigneeDisplay, // Use the determined display value
    items: apiJob.items_count || 0,
    totalFlags: apiJob.total_flags || 0,
    pendingFlags: apiJob.pending_flags || 0,
    closedFlags: apiJob.closed_flags || 0,
    // Calculate progress percentage - avoid division by zero
    flagProgress: apiJob.total_flags 
      ? Math.round((apiJob.closed_flags || 0) / apiJob.total_flags * 100) 
      : 0,
    isLoading: false // Default not loading
  };
  
  console.log(`adaptScanJob: Converted job ${apiJob.id} to:`, result);
  return result;
};

interface ConnectedScanJobsTableProps {
  onViewJob?: (jobId: string) => void;
  autoRefreshInterval?: number; // in milliseconds
  publisherId?: string;
  status?: string;
}

const ConnectedScanJobsTable: React.FC<ConnectedScanJobsTableProps> = ({
  onViewJob,
  autoRefreshInterval = 30000, // Default to 30 seconds
  publisherId,
  status
}) => {
  const [scanJobs, setScanJobs] = useState<ReturnType<typeof adaptScanJob>[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScanJobs = async () => {
    try {
      // Only set loading on initial fetch
      if (scanJobs.length === 0) {
        setIsLoading(true);
      }
      
      const params: { publisherId?: string; status?: string; limit?: number } = {};
      if (publisherId) params.publisherId = publisherId;
      if (status) params.status = status;
      params.limit = 100; // Significantly increase limit to get more scan jobs
      
      console.log('Fetching scan jobs with params:', params);
      const response = await scanJobService.getScanJobs(params);
      console.log('Scan jobs API response:', response);
      
      // Convert API response to component format
      const adaptedJobs = response.data.map(adaptScanJob);
      console.log('Adapted scan jobs:', adaptedJobs);
      setScanJobs(adaptedJobs);
      setError(null);
    } catch (err) {
      console.error('Error fetching scan jobs:', err);
      setError('Failed to load scan jobs. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchScanJobs();
  }, [publisherId, status]);

  // Set up auto-refresh
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    
    const intervalId = setInterval(() => {
      fetchScanJobs();
    }, autoRefreshInterval);
    
    return () => clearInterval(intervalId);
  }, [autoRefreshInterval, publisherId, status]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-error bg-opacity-10 text-error p-4 rounded-md">
        <p>{error}</p>
        <button 
          className="mt-2 btn-tertiary"
          onClick={fetchScanJobs}
        >
          Try Again
        </button>
      </div>
    );
  }

  // Handle assignee change
  const handleAssigneeChange = async (jobId: string, assigneeId: string | null) => {
    console.log(`ConnectedScanJobsTable: handleAssigneeChange called with jobId=${jobId}, assigneeId=${assigneeId}`);
    
    // Create a loading indicator for this specific job
    setScanJobs(prevJobs => {
      return prevJobs.map(job => {
        if (job.id === jobId) {
          return { ...job, isLoading: true };
        }
        return job;
      });
    });
    
    try {
      // No need to convert jobId to string as it's already a string
      const jobIdString = jobId;
      
      // Make the API call FIRST before updating the UI
      let apiResponse;
      
      if (assigneeId) {
        console.log(`ConnectedScanJobsTable: Calling assignUserToScanJob API with jobId=${jobIdString}, assigneeId=${assigneeId}`);
        apiResponse = await scanJobService.assignUserToScanJob(jobIdString, assigneeId);
        console.log(`ConnectedScanJobsTable: API response:`, apiResponse);
      } else {
        console.log(`ConnectedScanJobsTable: Calling unassignUserFromScanJob API with jobId=${jobIdString}`);
        apiResponse = await scanJobService.unassignUserFromScanJob(jobIdString);
        console.log(`ConnectedScanJobsTable: API response:`, apiResponse);
      }
      
      // Immediately fetch fresh data from the server to ensure UI is in sync with backend
      console.log(`ConnectedScanJobsTable: Assignment operation completed, fetching fresh data`);
      await fetchScanJobs();
      
    } catch (err) {
      console.error('Error updating assignee:', err);
      alert(`Failed to update assignee: ${err instanceof Error ? err.message : 'Unknown error'}`);
      // If there's an error, refresh to get the current state
      fetchScanJobs();
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">Active Scans</h2>
        <button 
          className="btn-tertiary flex items-center text-sm"
          onClick={fetchScanJobs}
        >
          <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>
      
      <EnhancedScanJobsTable 
        scanJobs={scanJobs}
        onViewJob={onViewJob}
        onAssigneeChange={handleAssigneeChange}
      />
    </div>
  );
};

export default ConnectedScanJobsTable;
