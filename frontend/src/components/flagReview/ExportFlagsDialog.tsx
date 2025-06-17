'use client';

import React, { useState, useEffect } from 'react';
import BaseModal from '@/components/common/BaseModal';
import FormField from '@/components/common/FormField';
import MultiSelect from '@/components/common/MultiSelect';

interface ExportOption {
  value: string;
  label: string;
}

interface ExportFlagsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
  scanJobs: ExportOption[];
  publishers: ExportOption[];
}

interface ExportOptions {
  scanJobIds: string[];
  publisherIds: string[];
  flagStatuses: string[];
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

const statusOptions: ExportOption[] = [
  { value: 'new', label: 'New' },
  { value: 'in_review', label: 'In Review' },
  { value: 'pending_remediation', label: 'Pending Remediation' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'compliant', label: 'Compliant' },
  { value: 'closed', label: 'Closed' }
];

const ExportFlagsDialog: React.FC<ExportFlagsDialogProps> = ({
  isOpen,
  onClose,
  onExport,
  scanJobs,
  publishers
}) => {
  const initialOptions: ExportOptions = {
    scanJobIds: [],
    publisherIds: [],
    flagStatuses: [],
    dateRange: { startDate: '', endDate: '' }
  };
  
  const [exportOptions, setExportOptions] = useState<ExportOptions>(initialOptions);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Reset options when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setExportOptions(initialOptions);
      setIsSubmitting(false);
    }
  }, [isOpen]);
  
  // Handler for multi-select changes
  const handleMultiSelectChange = (field: 'scanJobIds' | 'publisherIds' | 'flagStatuses', values: string[]) => {
    setExportOptions(prev => ({
      ...prev,
      [field]: values
    }));
  };
  
  // Handler for date changes
  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    setExportOptions(prev => ({
      ...prev,
      dateRange: {
        ...prev.dateRange,
        [field]: value
      }
    }));
  };
  
  // Handle export button click
  const handleExport = () => {
    setIsSubmitting(true);
    
    // Simulate export process
    setTimeout(() => {
      onExport(exportOptions);
      setIsSubmitting(false);
      onClose();
    }, 1500);
  };
  
  // Modal footer with export button
  const modalFooter = (
    <div className="flex justify-end space-x-3">
      <button 
        type="button" 
        className="btn-secondary" 
        onClick={onClose}
        disabled={isSubmitting}
      >
        Cancel
      </button>
      <button 
        type="button" 
        className="btn-primary"
        onClick={handleExport}
        disabled={isSubmitting || (exportOptions.scanJobIds.length === 0 && exportOptions.publisherIds.length === 0)}
      >
        {isSubmitting ? (
          <span className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Exporting...
          </span>
        ) : 'Export to CSV'}
      </button>
    </div>
  );
  
  return (
    <BaseModal
      title="Export Flags to CSV"
      isOpen={isOpen}
      onClose={onClose}
      footer={modalFooter}
      size="md"
    >
      <div className="space-y-5">
        <div className="p-3 bg-background rounded text-sm text-text-secondary mb-4">
          <p className="mb-2">Select at least one scan or publisher to export flags.</p>
          <p>You can further refine the export by selecting specific flag statuses or setting a date range.</p>
        </div>
        
        <FormField 
          label="Scans"
          htmlFor="scanJobs"
          helpText="Select specific scans to export flags from"
        >
          <MultiSelect
            id="scanJobs"
            options={scanJobs}
            selectedValues={exportOptions.scanJobIds}
            onChange={(values) => handleMultiSelectChange('scanJobIds', values)}
            placeholder="Select scans..."
          />
        </FormField>
        
        <FormField 
          label="Publishers" 
          htmlFor="publishers"
          helpText="Select publishers to export flags from"
        >
          <MultiSelect
            id="publishers"
            options={publishers}
            selectedValues={exportOptions.publisherIds}
            onChange={(values) => handleMultiSelectChange('publisherIds', values)}
            placeholder="Select publishers..."
          />
        </FormField>
        
        <FormField 
          label="Flag Statuses" 
          htmlFor="flagStatuses"
          helpText="Optional: Filter by flag statuses"
        >
          <MultiSelect
            id="flagStatuses"
            options={statusOptions}
            selectedValues={exportOptions.flagStatuses}
            onChange={(values) => handleMultiSelectChange('flagStatuses', values)}
            placeholder="All statuses"
          />
        </FormField>
        
        <div className="grid grid-cols-2 gap-4">
          <FormField 
            label="From Date" 
            htmlFor="startDate"
          >
            <input
              type="date"
              id="startDate"
              value={exportOptions.dateRange.startDate}
              onChange={(e) => handleDateChange('startDate', e.target.value)}
              className="input w-full"
            />
          </FormField>
          
          <FormField 
            label="To Date" 
            htmlFor="endDate"
          >
            <input
              type="date"
              id="endDate"
              value={exportOptions.dateRange.endDate}
              onChange={(e) => handleDateChange('endDate', e.target.value)}
              className="input w-full"
            />
          </FormField>
        </div>
      </div>
    </BaseModal>
  );
};

export default ExportFlagsDialog;
