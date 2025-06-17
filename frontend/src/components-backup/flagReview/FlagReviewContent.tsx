'use client'; // Required for components with state/effects

import React, { useState } from 'react';
import Link from 'next/link';
import { ROUTES } from '@/constants/routes';
import { EnhancedFlagTableDemo } from '@/components/flagReview/EnhancedFlagTable';
import EnhancedFlagPreview from '@/components/flagReview/EnhancedFlagPreview';
import FilterBar from '@/components/flagReview/FilterBar';
import ExportFlagsDialog from '@/components/flagReview/ExportFlagsDialog';

// Define interfaces (Consider moving to a shared types file)
interface FlagContent {
  type: string;
  url: string;
  transcript: string;
  ruleText: string;
  aiReasoning: string;
  aiVerdict: string; // Added to match EnhancedFlagTable interface
}

interface HumanVerdict {
  isViolation: boolean | null;
  severity: string;
  feedback: string;
  comments: string;
  timestamp: string;
}

interface Flag {
  id: number;
  scanJob: string;
  publisher: string;
  product: string;
  rule: string;
  date: string;
  aiConfidence: number;
  status: string;
  content: FlagContent;
  humanVerdict?: HumanVerdict; 
}

// Mock data (Replace with API calls later)
const initialMockFlags: Flag[] = [
  { id: 1, scanJob: 'Q2 YouTube', publisher: 'AcmeCo', product: 'Premium Card', rule: 'Fee Disclosure', date: '2025-04-25', aiConfidence: 82, status: 'New', content: { type: 'video', url: 'https://example.com/video1', transcript: 'This premium card has no annual fee for the first year, but there are some conditions that apply.', ruleText: 'Fee disclosures must clearly state all conditions and duration of promotional fee waivers.', aiReasoning: 'The statement mentions a first-year fee waiver but does not clearly explain the conditions that apply or what happens after the first year.', aiVerdict: 'Violation' } },
  { id: 2, scanJob: 'Q2 YouTube', publisher: 'BetaInc', product: 'Travel Card', rule: 'APR Disclosure', date: '2025-04-24', aiConfidence: 65, status: 'In Review', content: { type: 'video', url: 'https://example.com/video2', transcript: 'This card has an annual percentage rate as low as 12.99%, but will depend on your credit score.', ruleText: 'APR statements must disclose the full range of possible rates and qualifying factors prominently.', aiReasoning: 'The statement mentions a minimum APR but does not disclose the maximum possible rate in the range.', aiVerdict: 'Potential Violation' } },
  { id: 3, scanJob: 'TikTok Apr 25', publisher: 'GamesCo', product: 'Rewards Card', rule: 'Rewards Terms', date: '2025-04-25', aiConfidence: 91, status: 'New', content: { type: 'video', url: 'https://example.com/video3', transcript: 'Earn unlimited 5% cash back on all purchases with our rewards card!', ruleText: 'Rewards promotions must disclose any category limitations, caps, or expiration terms.', aiReasoning: 'The statement claims "unlimited 5% cash back on all purchases" without disclosing any category limitations or caps that may apply.', aiVerdict: 'Violation' } }
];

// Mock data for export options
const mockScanJobs = [
  { value: '1', label: 'Q2 YouTube Review' },
  { value: '2', label: 'TikTok Apr 25' },
  { value: '3', label: 'Instagram Influencers' },
  { value: '4', label: 'Acme Review' }
];

const mockPublishers = [
  { value: '1', label: 'AcmeCo' },
  { value: '2', label: 'BetaInc' },
  { value: '3', label: 'GamesCo' },
  { value: '4', label: 'TechFirm' }
];

const FlagReviewContent: React.FC = () => {
  const [flags, setFlags] = useState<Flag[]>(initialMockFlags);
  const [selectedFlag, setSelectedFlag] = useState<Flag | null>(null);
  const [filters, setFilters] = useState({
    scanJob: '', publisher: '', product: '', status: '', dateRange: { start: '', end: '' }
  });
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const handleSelectFlag = (flagId: number) => {
    // Find the flag in the flags array
    const flag = flags.find(f => f.id === flagId);
    setSelectedFlag(flag || null);
    console.log("Selected flag:", flagId, flag);
  };

  const handleFilterChange = (newFilters: any) => { // Use 'any' for now
    setFilters(newFilters);
    console.log('Filtering with:', newFilters);
    // Apply mock filtering 
    let filteredFlags = initialMockFlags; // Start with original full list
    if (newFilters.scanJob) {
      filteredFlags = filteredFlags.filter(f => f.scanJob.toLowerCase().includes(newFilters.scanJob.toLowerCase()));
    }
    if (newFilters.publisher) {
       filteredFlags = filteredFlags.filter(f => f.publisher.toLowerCase().includes(newFilters.publisher.toLowerCase()));
    }
    if (newFilters.product) {
       filteredFlags = filteredFlags.filter(f => f.product.toLowerCase().includes(newFilters.product.toLowerCase()));
    }
    if (newFilters.status) {
      filteredFlags = filteredFlags.filter(f => f.status.toLowerCase() === newFilters.status.toLowerCase());
    }
    // Add date range filtering here if implemented
    setFlags(filteredFlags);
    setSelectedFlag(null); 
  };

  const handleStatusChange = (flagId: number, newStatus: string) => {
    // Create updated flags array first
    const updatedFlags = flags.map(flag => 
      flag.id === flagId ? { ...flag, status: newStatus } : flag
    );
    
    // Update the flags state
    setFlags(updatedFlags);
     
    // Always update the selected flag to ensure UI consistency
    if (selectedFlag && selectedFlag.id === flagId) {
      // Find the updated flag object and set it as selected
      const updatedFlag = updatedFlags.find(f => f.id === flagId);
      if (updatedFlag) {
        setSelectedFlag(updatedFlag);
      }
    }
    
    console.log(`Status changed for flag ${flagId} to ${newStatus}`);
  };

  const handleVerdictSubmit = (verdict: Omit<HumanVerdict, 'timestamp'> & { timestamp: string }) => {
    if (!selectedFlag) return;
    
    // Set status to "Pending Remediation" for violations and "Closed" for compliant flags
    const newStatus = verdict.isViolation ? 'Pending Remediation' : 'Closed';
    
    // Create updated flags array first
    const updatedFlags = flags.map(flag => 
      flag.id === selectedFlag.id 
        ? { ...flag, status: newStatus, humanVerdict: verdict } 
        : flag
    );
    
    // Update flags state with the new array
    setFlags(updatedFlags);
    
    // Find the next flag to review (first unreviewed flag)
    const currentIndex = updatedFlags.findIndex(f => f.id === selectedFlag.id);
    
    // Look for flags after the current one first
    const remainingFlags = updatedFlags.slice(currentIndex + 1);
    let nextFlag = remainingFlags.find(f => f.status === 'New' || f.status === 'In Review');
    
    // If no flags after current, look from beginning
    if (!nextFlag && currentIndex > 0) {
      const previousFlags = updatedFlags.slice(0, currentIndex);
      nextFlag = previousFlags.find(f => f.status === 'New' || f.status === 'In Review');
    }
    
    // Move to the next flag if available, otherwise keep the current one updated
    if (nextFlag) {
      setSelectedFlag(nextFlag);
      // Auto-scroll to the next flag in the table would be nice here too
      console.log(`Moving to next flag: ${nextFlag.id}`);
    } else {
      // Update the current flag with the new status
      const updatedCurrentFlag = updatedFlags.find(f => f.id === selectedFlag.id);
      setSelectedFlag(updatedCurrentFlag || null);
    }
    
    console.log(`Verdict submitted for flag ${selectedFlag.id}:`, verdict);
  };
  
  // Handle export action
  const handleExport = (options: any) => {
    console.log('Exporting flags with options:', options);
    
    // Create mock CSV data based on current flags
    const csvData = [
      // CSV Header
      ['ID', 'Publisher', 'Product', 'Scan Job', 'Rule', 'Date', 'AI Confidence', 'Status', 'Transcript'],
      // CSV Rows
      ...flags.map(flag => [
        flag.id,
        flag.publisher,
        flag.product, 
        flag.scanJob,
        flag.rule,
        flag.date,
        flag.aiConfidence,
        flag.status,
        flag.content.transcript.substring(0, 100) + (flag.content.transcript.length > 100 ? '...' : '')
      ])
    ];
    
    // Convert to CSV string
    const csvString = csvData.map(row => row.map(cell => 
      typeof cell === 'string' ? `"${cell.replace(/"/g, '""')}"` : cell
    ).join(',')).join('\n');
    
    // Create blob and download link
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `flags-export-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    
    // Trigger download
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    // Show success message
    setExportSuccess(true);
    
    // Clear success message after 3 seconds
    setTimeout(() => {
      setExportSuccess(false);
    }, 3000);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <Link href={ROUTES.DASHBOARD}>
            <button 
              type="button"
              className="btn-secondary mr-4 flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
              </svg>
              Back to Dashboard
            </button>
          </Link>
          <h1>Flag Review</h1>
        </div>
        <div className="flex space-x-2">
          {/* Success toast message */}
          {exportSuccess && (
            <div className="bg-success bg-opacity-10 text-success px-3 py-2 rounded-md flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Export successful!
            </div>
          )}
          
          <button 
            className="btn-primary flex items-center"
            onClick={() => setShowExportDialog(true)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Export Flags to CSV
          </button>
        </div>
      </div>

      <FilterBar filters={filters} onFilterChange={handleFilterChange} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Flag Table Column */}
          <div className="lg:col-span-1">
            <div className="card p-0 overflow-hidden"> 
              <EnhancedFlagTableDemo 
                selectedFlagId={selectedFlag?.id || null}
                onSelectFlag={handleSelectFlag}
                externalFlags={flags}
                onStatusChange={handleStatusChange}
              />
            </div>
          </div>
        {/* Flag Preview Column */}
        <div className="lg:col-span-2">
          <div className="card h-full"> {/* Ensure card takes height */}
            {selectedFlag ? (
              <EnhancedFlagPreview 
                key={selectedFlag.id} // Force re-render on selection change
                flag={selectedFlag} 
                onVerdictSubmit={handleVerdictSubmit}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-text-secondary"> {/* Center placeholder */}
                <p>Select a flag from the list to review</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Export Dialog */}
      <ExportFlagsDialog
        isOpen={showExportDialog}
        onClose={() => setShowExportDialog(false)}
        onExport={handleExport}
        scanJobs={mockScanJobs}
        publishers={mockPublishers}
      />
    </div>
  );
};

export default FlagReviewContent;
