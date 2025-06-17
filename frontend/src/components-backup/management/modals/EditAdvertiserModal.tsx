'use client';

import React, { useState, useEffect } from 'react';
import BaseModal from '@/components/common/BaseModal';
import FormField from '@/components/common/FormField';
import MultiSelect from '@/components/common/MultiSelect';
import { publisherStatuses, mockRuleSets } from './mockData';

interface AdvertiserFormData {
  name: string;
  status: string;
  contactEmail: string;
  contactPhone: string;
  globalRuleSets: string[];
}

interface Advertiser {
  id: string;
  name: string;
  status: string;
  contactInfo: {
    email: string;
    phone: string;
  };
  products: {
    name: string;
    status: string;
    lastScanned: string | null;
  }[];
  totalProducts: number;
  totalFlags: number;
  complianceRate: number;
}

interface EditAdvertiserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AdvertiserFormData) => void;
  advertiser: Advertiser | null;
}

const EditAdvertiserModal: React.FC<EditAdvertiserModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  advertiser
}) => {
  const initialData: AdvertiserFormData = {
    name: '',
    status: 'active',
    contactEmail: '',
    contactPhone: '',
    globalRuleSets: []
  };
  
  const [formData, setFormData] = useState<AdvertiserFormData>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Update form when advertiser data changes
  useEffect(() => {
    if (advertiser) {
      setFormData({
        name: advertiser.name,
        status: advertiser.status.toLowerCase(),
        contactEmail: advertiser.contactInfo.email,
        contactPhone: advertiser.contactInfo.phone,
        // In a real app, these would be loaded from the backend
        globalRuleSets: []
      });
    }
  }, [advertiser]);
  
  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen && !advertiser) {
      setFormData(initialData);
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen, advertiser]);
  
  // Update text field values
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };
  
  // Handle rule set selections
  const handleRuleSetChange = (values: string[]) => {
    setFormData(prev => ({ ...prev, globalRuleSets: values }));
  };
  
  // Validate the form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Check required fields
    if (!formData.name.trim()) {
      newErrors.name = 'Advertiser name is required';
    }
    
    // Validate email format if provided
    if (formData.contactEmail && !/^\S+@\S+\.\S+$/.test(formData.contactEmail)) {
      newErrors.contactEmail = 'Please enter a valid email address';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Handle form submission
  const handleSubmit = () => {
    if (validateForm()) {
      setIsSubmitting(true);
      
      // Simulate API call
      setTimeout(() => {
        onSubmit(formData);
        setIsSubmitting(false);
        onClose();
      }, 800);
    }
  };
  
  // Modal footer with action buttons
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
        onClick={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <span className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Saving...
          </span>
        ) : 'Save Changes'}
      </button>
    </div>
  );
  
  return (
    <BaseModal
      title="Edit Advertiser"
      isOpen={isOpen}
      onClose={onClose}
      footer={modalFooter}
      size="md"
    >
      <div className="space-y-6">
        {/* Basic Information Section */}
        <div>
          <h3 className="text-md font-semibold mb-3">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField 
              label="Advertiser Name" 
              htmlFor="name" 
              required
              error={errors.name}
            >
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="input w-full"
                placeholder="Enter advertiser name"
              />
            </FormField>
            
            <FormField 
              label="Status" 
              htmlFor="status"
            >
              <select
                id="status"
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="input w-full"
              >
                {publisherStatuses.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
            
            <FormField 
              label="Contact Email" 
              htmlFor="contactEmail"
              error={errors.contactEmail}
            >
              <input
                type="email"
                id="contactEmail"
                name="contactEmail"
                value={formData.contactEmail}
                onChange={handleInputChange}
                className="input w-full"
                placeholder="Enter contact email"
              />
            </FormField>
            
            <FormField 
              label="Contact Phone" 
              htmlFor="contactPhone"
            >
              <input
                type="text"
                id="contactPhone"
                name="contactPhone"
                value={formData.contactPhone}
                onChange={handleInputChange}
                className="input w-full"
                placeholder="Enter contact phone"
              />
            </FormField>
          </div>
        </div>
        
        {/* Product Summary */}
        {advertiser && advertiser.products.length > 0 && (
          <div>
            <h3 className="text-md font-semibold mb-3">Products</h3>
            <div className="bg-background p-4 rounded-md">
              <div className="text-sm">
                <p className="mb-2">This advertiser has {advertiser.totalProducts} products.</p>
                <ul className="list-disc list-inside space-y-1 text-text-secondary">
                  {advertiser.products.slice(0, 3).map((product, idx) => (
                    <li key={idx}>{product.name}</li>
                  ))}
                  {advertiser.products.length > 3 && (
                    <li>...and {advertiser.products.length - 3} more</li>
                  )}
                </ul>
                
                <div className="mt-3 text-text-secondary">
                  <p>To manage products, navigate to the Products section from the Management overview.</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Global Rule Sets Section */}
        <div>
          <h3 className="text-md font-semibold mb-3">Global Rule Sets</h3>
          <div className="bg-background p-3 rounded-md mb-3">
            <FormField 
              label="Global Rule Sets" 
              htmlFor="globalRuleSets"
              helpText="These rule sets will apply to all products from this advertiser"
            >
              <MultiSelect
                id="globalRuleSets"
                options={mockRuleSets}
                selectedValues={formData.globalRuleSets}
                onChange={handleRuleSetChange}
                placeholder="Select global rule sets..."
              />
            </FormField>
          </div>
        </div>
      </div>
    </BaseModal>
  );
};

export default EditAdvertiserModal;
