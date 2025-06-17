'use client'; // Required for components with state/effects

import React, { useState } from 'react';
import { EnhancedScanJobsTableDemo } from '@/components/dashboard/EnhancedScanJobsTable';
import RecentActivity from '@/components/dashboard/RecentActivity';
import { EnhancedComplianceOverviewDemo } from '@/components/dashboard/EnhancedComplianceOverview';
import EnhancedNewScanJobModal from '@/components/dashboard/EnhancedNewScanJobModal';
import { ViolationStatsPanelDemo } from '@/components/dashboard/ViolationStatsPanel';
import { AIStatsPanelDemo } from '@/components/dashboard/AIStatsPanel';
import { FlagStatsPanelDemo } from '@/components/dashboard/FlagStatsPanel';
import { ContentProcessingMetricsDemo } from '@/components/dashboard/ContentProcessingMetrics';
import { AIConfidenceAnalysisDemo } from '@/components/dashboard/AIConfidenceAnalysis';

// Mock activities (will be removed later)

const mockActivities = [
  '18 flags waiting for review from "Q2 YouTube" scan',
  '"TikTok Apr 25" scan in progress (56 items processed)',
  'Jane reviewed 12 flags in "Acme Review" (3 violations found)'
];

const DashboardContent: React.FC = () => {
  const [showNewScanModal, setShowNewScanModal] = useState(false);
  const handleNewScanJob = (newScanData: any) => { // Use 'any' for now, define proper type later
    console.log('New scan job created:', newScanData);
    setShowNewScanModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1>Dashboard</h1>
        <button 
          className="btn-primary"
          onClick={() => setShowNewScanModal(true)}
        >
          + New Scan Job
        </button>
      </div>

      {/* Stats Panels */}
      <FlagStatsPanelDemo />
      <ViolationStatsPanelDemo />
      <AIStatsPanelDemo />

      {/* Scan Jobs Table */}
      <div className="card card-hover">
        <div className="flex justify-between items-center mb-4">
          <h2>Active Scan Jobs</h2>
        </div>
        <EnhancedScanJobsTableDemo />
      </div>

      {/* Publisher Compliance Overview */}
      <div className="card card-hover mb-6">
        <h2 className="mb-4">Publisher Compliance Overview</h2>
        <EnhancedComplianceOverviewDemo />
      </div>

      {/* Content Processing Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ContentProcessingMetricsDemo />
        <AIConfidenceAnalysisDemo />
      </div>

      {showNewScanModal && (
        <EnhancedNewScanJobModal 
          onClose={() => setShowNewScanModal(false)} 
          onSubmit={handleNewScanJob}
        />
      )}
    </div>
  );
};

export default DashboardContent;
