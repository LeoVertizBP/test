'use client';

import React from 'react';
import NewScanJobForm from '@/components/scan/NewScanJobForm';

interface NewScanJobModalProps {
  onClose: () => void;
  onSubmit: (newScanData: any) => void;
}

const EnhancedNewScanJobModal: React.FC<NewScanJobModalProps> = ({ onClose, onSubmit }) => {
  const handleFormSubmit = (formData: any) => {
    // Here we can transform the form data if needed before passing to parent
    onSubmit({
      name: formData.basicInfo.name,
      description: formData.basicInfo.description,
      publishers: formData.publishers,
      channels: formData.channels,
      products: formData.products,
      schedule: formData.schedule,
      startDate: new Date().toISOString().slice(0, 10) // Today's date in YYYY-MM-DD format
    });
  };
  
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
      <div className="bg-surface rounded-lg shadow-lg z-10 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <NewScanJobForm onSubmit={handleFormSubmit} onCancel={onClose} />
      </div>
    </div>
  );
};

export default EnhancedNewScanJobModal;
