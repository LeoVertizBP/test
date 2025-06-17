'use client'; // Required for components with state/effects

import React, { useState } from 'react';
import ConnectedScanJobsTable from '@/components/dashboard/ConnectedScanJobsTable';
import ConnectedNewScanJobModal from '@/components/dashboard/ConnectedNewScanJobModal';
import ConnectedFlagStatsPanel from '@/components/dashboard/ConnectedFlagStatsPanel';
import ConnectedViolationStatsPanel from '@/components/dashboard/ConnectedViolationStatsPanel';
import ConnectedAIStatsPanel from '@/components/dashboard/ConnectedAIStatsPanel';
import ConnectedComplianceOverview from '@/components/dashboard/ConnectedComplianceOverview';
import AIConfidenceBypassControl from '@/components/dashboard/AIConfidenceBypassControl'; // Added import

const ConnectedDashboardContent: React.FC = () => {
  const [showNewScanModal, setShowNewScanModal] = useState(false);
  const [refreshScanJobs, setRefreshScanJobs] = useState(0); // Counter to trigger refresh
  
  // Handle newly created scan job
  const handleNewScanSuccess = (scanJobId: string) => {
    console.log('New scan job created with ID:', scanJobId);
    setShowNewScanModal(false);
    // Trigger a refresh of the scan jobs table
    setRefreshScanJobs(prev => prev + 1);
  };
  
  // Handle scan job view
  const handleViewScanJob = (jobId: string) => {
    console.log('View scan job details:', jobId);
    // Could navigate to a scan job details page or show a modal
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1>Dashboard</h1>
        <button 
          className="btn-primary"
          onClick={() => setShowNewScanModal(true)}
        >
          + New Scan
        </button>
      </div>

      {/* Stats Panels */}
      <ConnectedFlagStatsPanel />
      <ConnectedViolationStatsPanel />
      <ConnectedAIStatsPanel />

      {/* Scan Jobs Table */}
      <div className="card card-hover">
        <ConnectedScanJobsTable 
          onViewJob={handleViewScanJob}
          key={`scan-jobs-${refreshScanJobs}`} // Force refresh when counter changes
        />
      </div>

      {/* Publisher Compliance Overview */}
      <ConnectedComplianceOverview />

      {/* Content Processing Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card p-6">
          <h3 className="text-h3 font-medium mb-4">Content Processing Metrics</h3>
          <div className="text-center text-text-secondary">
            <p>Processing metrics will appear here when available.</p>
          </div>
        </div>
        {/* Replaced placeholder with the new AIConfidenceBypassControl component */}
        <AIConfidenceBypassControl />
      </div>

      {showNewScanModal && (
        <ConnectedNewScanJobModal 
          onClose={() => setShowNewScanModal(false)} 
          onSuccess={handleNewScanSuccess}
        />
      )}
    </div>
  );
};

export default ConnectedDashboardContent;
