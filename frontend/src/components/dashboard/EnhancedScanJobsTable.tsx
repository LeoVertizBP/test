'use client';

import React, { useState, useEffect } from 'react';
import { userService, User } from '../../services/userService';
import { scanJobService } from '../../services/scanJobService';

interface ScanJob {
  id: string; // Changed from number to string to preserve UUID format
  name: string;
  startDate: string;
  status: string;
  assignee?: string; // This contains the user's name for display
  items: number;
  totalFlags: number;
  pendingFlags: number;
  closedFlags: number;
  flagProgress: number; // percentage of flags closed
  isLoading?: boolean; // Added for loading state during assignee changes
}

// Interface for sorting state
interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

interface EnhancedScanJobsTableProps {
  scanJobs: ScanJob[];
  onViewJob?: (jobId: string) => void; // Changed from number to string
  onAssigneeChange?: (jobId: string, assigneeId: string | null) => void; // Changed from number to string
}

const EnhancedScanJobsTable: React.FC<EnhancedScanJobsTableProps> = ({ 
  scanJobs,
  onViewJob = () => {},
  onAssigneeChange
}) => {
  // State for eligible assignees (reviewers and managers)
  const [assignees, setAssignees] = useState<User[]>([]);
  const [loadingAssignees, setLoadingAssignees] = useState<boolean>(false);
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState<string | null>(null); // Changed from number to string
  const [assigningInProgress, setAssigningInProgress] = useState<{[key: string]: boolean}>({}); // Changed from number to string

  // Fetch eligible assignees on component mount
  useEffect(() => {
    const fetchAssignees = async () => {
      setLoadingAssignees(true);
      try {
        const response = await userService.getUsersByRoles(['reviewer', 'manager', 'admin']);
        // Filter out users with publisher_id (publishers should not be assigned)
        const eligibleAssignees = response.data.filter(user => !user.publisher_id);
        setAssignees(eligibleAssignees);
      } catch (error) {
        console.error('Error fetching assignees:', error);
      } finally {
        setLoadingAssignees(false);
      }
    };

    fetchAssignees();
  }, []);

  // Handle assignee change
  const handleAssigneeChange = async (jobId: string, assigneeId: string | null) => { // Changed from number to string
    console.log(`EnhancedScanJobsTable: handleAssigneeChange called with jobId=${jobId}, assigneeId=${assigneeId}`);
    setAssigningInProgress(prev => ({ ...prev, [jobId]: true }));
    
    try {
      // No need to convert jobId to string as it's already a string
      const jobIdString = jobId;
      console.log(`EnhancedScanJobsTable: Using jobId string: ${jobIdString}`);
      
      let apiResponse;
      let selectedUser = null;
      
      if (assigneeId) {
        // Find the selected user to get their name
        selectedUser = assignees.find(user => user.id === assigneeId);
        console.log(`EnhancedScanJobsTable: Selected user:`, selectedUser);
        
        // Make the API call FIRST before updating the UI
        console.log(`EnhancedScanJobsTable: Calling assignUserToScanJob API with jobId=${jobIdString}, assigneeId=${assigneeId}`);
        apiResponse = await scanJobService.assignUserToScanJob(jobIdString, assigneeId);
        console.log(`EnhancedScanJobsTable: API response:`, apiResponse);
        
        // Check if the API call was successful
        if (!apiResponse || apiResponse.status >= 400) {
          throw new Error(`API call failed with status: ${apiResponse?.status}`);
        }
        
        // Only update the UI if the API call was successful
        if (selectedUser && onAssigneeChange) {
          console.log(`EnhancedScanJobsTable: API call successful, updating UI with user name: ${selectedUser.name}`);
          onAssigneeChange(jobId, assigneeId);
        }
      } else {
        // Make the API call FIRST before updating the UI
        console.log(`EnhancedScanJobsTable: Calling unassignUserFromScanJob API with jobId=${jobIdString}`);
        apiResponse = await scanJobService.unassignUserFromScanJob(jobIdString);
        console.log(`EnhancedScanJobsTable: API response:`, apiResponse);
        
        // Check if the API call was successful
        if (!apiResponse || apiResponse.status >= 400) {
          throw new Error(`API call failed with status: ${apiResponse?.status}`);
        }
        
        // Only update the UI if the API call was successful
        if (onAssigneeChange) {
          console.log(`EnhancedScanJobsTable: API call successful, updating UI to show unassigned`);
          onAssigneeChange(jobId, null);
        }
      }
      
      // Force a refresh of the data after a successful API call
      console.log(`EnhancedScanJobsTable: Assignment operation successful, will trigger refresh`);
    } catch (error) {
      console.error('Error updating assignee:', error);
      alert(`Failed to update assignee: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setAssigningInProgress(prev => ({ ...prev, [jobId]: false }));
      setAssigneeDropdownOpen(null); // Close dropdown after selection
    }
  };

  // Toggle assignee dropdown
  const toggleAssigneeDropdown = (jobId: string | null) => { // Changed from number to string
    setAssigneeDropdownOpen(prevId => prevId === jobId ? null : jobId);
  };
  // State for sorting
  const [sortConfig, setSortConfig] = React.useState<SortConfig>({ 
    key: 'startDate', 
    direction: 'desc' 
  });
  
  // Sorted jobs based on current sort configuration
  const sortedJobs = React.useMemo(() => {
    const sortableJobs = [...scanJobs];
    sortableJobs.sort((a, b) => {
      if (sortConfig.key === 'startDate') {
        const dateA = new Date(a.startDate).getTime();
        const dateB = new Date(b.startDate).getTime();
        return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
      }
      if (sortConfig.key === 'name') {
        return sortConfig.direction === 'asc' 
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
      if (sortConfig.key === 'assignee') {
        const assigneeA = a.assignee || '';
        const assigneeB = b.assignee || '';
        return sortConfig.direction === 'asc' 
          ? assigneeA.localeCompare(assigneeB)
          : assigneeB.localeCompare(assigneeA);
      }
      if (sortConfig.key === 'status') {
        return sortConfig.direction === 'asc' 
          ? a.status.localeCompare(b.status)
          : b.status.localeCompare(a.status);
      }
      if (sortConfig.key === 'items') {
        return sortConfig.direction === 'asc' 
          ? a.items - b.items
          : b.items - a.items;
      }
      if (sortConfig.key === 'flags') {
        return sortConfig.direction === 'asc' 
          ? a.totalFlags - b.totalFlags
          : b.totalFlags - a.totalFlags;
      }
      if (sortConfig.key === 'progress') {
        return sortConfig.direction === 'asc' 
          ? a.flagProgress - b.flagProgress
          : b.flagProgress - a.flagProgress;
      }
      return 0;
    });
    return sortableJobs;
  }, [scanJobs, sortConfig]);
  
  // Handle column header click for sorting
  const handleSort = (key: string) => {
    setSortConfig(prevConfig => {
      if (prevConfig.key === key) {
        return {
          key,
          direction: prevConfig.direction === 'asc' ? 'desc' : 'asc'
        };
      }
      return { key, direction: 'desc' };
    });
  };
  
  // Helper to render sort indicator
  const getSortIndicator = (key: string) => {
    if (sortConfig.key !== key) return null;
    return (
      <span className="ml-1 text-text-secondary">
        {sortConfig.direction === 'asc' ? '↑' : '↓'}
      </span>
    );
  };
  // Progress circle renderer
  const renderProgressCircle = (progress: number) => {
    const strokeWidth = 3;
    const radius = 14;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (progress / 100) * circumference;
    
    const colorClass = progress >= 100 
      ? 'stroke-success' 
      : progress > 50 
        ? 'stroke-secondary' 
        : 'stroke-warning';
    
    return (
      <div className="flex items-center">
        <div className="relative h-10 w-10 mr-2">
          <svg className="h-10 w-10 transform -rotate-90">
            <circle
              className="stroke-background"
              strokeWidth={strokeWidth}
              fill="transparent"
              r={radius}
              cx="20"
              cy="20"
            />
            <circle
              className={colorClass}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              r={radius}
              cx="20"
              cy="20"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-xs font-medium">
            {progress}%
          </div>
        </div>
      </div>
    );
  };
  
  const getStatusBadgeClass = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'in_progress':
      case 'running':
        return 'bg-secondary bg-opacity-20 text-secondary';
      case 'pending_review':
        return 'bg-warning bg-opacity-20 text-warning';
      case 'pending_remediation':
        return 'bg-primary bg-opacity-20 text-primary';
      case 'completed':
        return 'bg-success bg-opacity-20 text-success';
      case 'failed':
        return 'bg-error bg-opacity-20 text-error';
      default:
        return 'bg-neutral-gray bg-opacity-20 text-neutral-gray';
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            <th 
              className="table-header text-left px-4 py-3 cursor-pointer" 
              onClick={() => handleSort('name')}
            >
              Scan {getSortIndicator('name')}
            </th>
            <th 
              className="table-header text-left px-4 py-3 cursor-pointer"
              onClick={() => handleSort('assignee')}
            >
              Assignee {getSortIndicator('assignee')}
            </th>
            <th 
              className="table-header text-left px-4 py-3 cursor-pointer"
              onClick={() => handleSort('startDate')}
            >
              Scan Date {getSortIndicator('startDate')}
            </th>
            <th 
              className="table-header text-center px-4 py-3 cursor-pointer"
              onClick={() => handleSort('status')}
            >
              Status {getSortIndicator('status')}
            </th>
            <th 
              className="table-header text-center px-4 py-3 cursor-pointer"
              onClick={() => handleSort('items')}
            >
              Items {getSortIndicator('items')}
            </th>
            <th 
              className="table-header text-center px-4 py-3 cursor-pointer"
              onClick={() => handleSort('flags')}
            >
              Flags {getSortIndicator('flags')}
            </th>
            <th 
              className="table-header text-right px-4 py-3 cursor-pointer"
              onClick={() => handleSort('progress')}
            >
              Progress {getSortIndicator('progress')}
            </th>
            <th className="table-header text-right px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-light">
          {sortedJobs.map((job, index) => (
            <tr key={job.id} className={index % 2 === 0 ? 'table-row' : 'table-row-alt'}>
              <td className="px-4 py-4 text-left">
                <div className="font-medium text-text-primary">{job.name}</div>
              </td>
              <td className="px-4 py-4 text-left">
                <div className="relative">
                  {job.isLoading || assigningInProgress[job.id] ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mr-2"></div>
                      <span>Updating...</span>
                    </div>
                  ) : (
                    <div 
                      className="flex items-center cursor-pointer"
                      onClick={() => toggleAssigneeDropdown(job.id)}
                    >
                      {job.assignee ? (
                        <>
                          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-medium mr-2">
                            {job.assignee.split(' ')
                              .filter(part => part.length > 0)
                              .map(n => n[0])
                              .join('')}
                          </div>
                          <span>{job.assignee}</span>
                        </>
                      ) : (
                        <div className="flex items-center text-text-secondary hover:text-primary">
                          <span>Unassigned</span>
                          <svg className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Assignee dropdown */}
                  {assigneeDropdownOpen === job.id && (
                    <div className="absolute z-10 mt-2 w-64 bg-white rounded-md shadow-lg">
                      <div className="py-1">
                        <div 
                          className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                          onClick={() => handleAssigneeChange(job.id, null)}
                        >
                          Unassign
                        </div>
                        <div className="border-t border-gray-100"></div>
                        {loadingAssignees ? (
                          <div className="px-4 py-2 text-sm text-gray-500">Loading assignees...</div>
                        ) : assignees.length === 0 ? (
                          <div className="px-4 py-2 text-sm text-gray-500">No eligible assignees found</div>
                        ) : (
                          assignees.map(user => (
                            <div 
                              key={user.id}
                              className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer flex items-center"
                              onClick={() => handleAssigneeChange(job.id, user.id)}
                            >
                              <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-white text-xs font-medium mr-2">
                                {user.name.split(' ').map(n => n[0]).join('')}
                              </div>
                              <div>
                                <div>{user.name}</div>
                                <div className="text-xs text-gray-500">{user.role}</div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </td>
              <td className="px-4 py-4 text-left">
                {formatDate(job.startDate)}
              </td>
              <td className="px-4 py-4 text-center">
                <span className={`px-2 py-1 rounded-full text-xs inline-block font-medium ${getStatusBadgeClass(job.status)}`}>
                  {job.status.replace(/_/g, ' ')}
                </span>
              </td>
              <td className="px-4 py-4 text-center">
                {job.items}
              </td>
              <td className="px-4 py-4 text-center">
                <div className="flex flex-col items-center">
                  <div className="font-medium">{job.totalFlags}</div>
                  <div className="text-xs text-text-secondary">
                    <span className="text-warning">{job.pendingFlags} pending</span>
                    {job.closedFlags > 0 && (
                      <span className="text-success ml-1">· {job.closedFlags} closed</span>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-4 py-4 text-right">
                <div className="flex items-center justify-end">
                  {renderProgressCircle(job.flagProgress)}
                </div>
              </td>
              <td className="px-4 py-4 text-right">
                <button 
                  className="btn-tertiary py-1.5 px-3 text-sm"
                  onClick={() => onViewJob(job.id)}
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {scanJobs.length === 0 && (
        <div className="text-center py-8 text-text-secondary">
          No active scans
        </div>
      )}
    </div>
  );
};

// For demo or development, export a component with mock data
export const EnhancedScanJobsTableDemo: React.FC = () => {
  const mockScanJobs: ScanJob[] = [
    { 
      id: "1", // Changed from number to string
      name: 'Q2 YouTube Review', 
      startDate: '2025-04-23', 
      status: 'Pending_Review', 
      assignee: 'Alex Johnson',
      items: 124, 
      totalFlags: 42, 
      pendingFlags: 18, 
      closedFlags: 24,
      flagProgress: 57 
    },
    { 
      id: "2", // Changed from number to string
      name: 'TikTok Apr 25', 
      startDate: '2025-04-25', 
      status: 'Running',
      items: 56, 
      totalFlags: 12, 
      pendingFlags: 12, 
      closedFlags: 0,
      flagProgress: 0 
    },
    { 
      id: "3", // Changed from number to string
      name: 'Instagram Influencers', 
      startDate: '2025-04-26', 
      status: 'Pending_Remediation',
      assignee: 'Sarah Chen', 
      items: 78, 
      totalFlags: 23, 
      pendingFlags: 8, 
      closedFlags: 15,
      flagProgress: 65 
    },
    { 
      id: "4", // Changed from number to string
      name: 'Acme Review', 
      startDate: '2025-04-20', 
      status: 'Completed',
      assignee: 'Michael Brown', 
      items: 87, 
      totalFlags: 31, 
      pendingFlags: 0, 
      closedFlags: 31,
      flagProgress: 100 
    }
  ];
  
  return (
    <EnhancedScanJobsTable 
      scanJobs={mockScanJobs} 
      onViewJob={(id) => console.log(`View job ${id}`)}
    />
  );
};

export default EnhancedScanJobsTable;
