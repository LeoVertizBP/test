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
  // Replace globalRuleSets array with specific default IDs
  defaultGlobalRuleSetId: string | null;
  defaultProductRuleSetId: string | null;
  defaultChannelRuleSetId: string | null;
}

// Add potential default rule set IDs to the Advertiser prop type
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
  // Assuming these might be passed from the backend eventually
  global_rule_set_id?: string | null;
  default_product_rule_set_id?: string | null;
  default_channel_rule_set_id?: string | null;
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
    // Initialize new state fields
    defaultGlobalRuleSetId: null,
    defaultProductRuleSetId: null,
    defaultChannelRuleSetId: null
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
        // Populate default rule set IDs from advertiser prop, fallback to null/empty
        defaultGlobalRuleSetId: advertiser.global_rule_set_id || null,
        defaultProductRuleSetId: advertiser.default_product_rule_set_id || null,
        defaultChannelRuleSetId: advertiser.default_channel_rule_set_id || null
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

  // Remove unused handler for MultiSelect
  // const handleRuleSetChange = (values: string[]) => {
  //   setFormData(prev => ({ ...prev, globalRuleSets: values }));
  // };

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
      
      // Pass the relevant form data to the onSubmit prop
      // Ensure the data structure matches what the parent component expects
      // (We might need to adjust the parent component's handleEditAdvertiserSubmit later)
      const submissionData = {
        name: formData.name,
        status: formData.status,
        contactEmail: formData.contactEmail,
        contactPhone: formData.contactPhone,
        // Include the single default rule set IDs
        defaultGlobalRuleSetId: formData.defaultGlobalRuleSetId || null, // Send null if empty string
        defaultProductRuleSetId: formData.defaultProductRuleSetId || null,
        defaultChannelRuleSetId: formData.defaultChannelRuleSetId || null,
      };

      // Simulate API call
      setTimeout(() => {
        onSubmit(submissionData); // Pass the structured data
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
                <p className="mb-2">This advertiser has {advertiser.totalProducts} products:</p>
                <ul className="list-disc list-inside space-y-1 text-text-secondary">
                  {/* Iterate over all products without slicing */}
                  {advertiser.products.map((product, idx) => (
                    <li key={idx}>{product.name}</li>
                  ))}
                  {/* Removed the "...and X more" logic */}
                </ul>
                
                <div className="mt-3 text-text-secondary">
                  <p>To manage products, navigate to the Products section from the Management overview.</p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Default Rule Sets Section */}
        <div>
          <h3 className="text-md font-semibold mb-1">Default Rule Sets</h3>
          <p className="text-sm text-text-secondary mb-3">
            These rule sets will apply to all products from this advertiser
          </p>
          <div className="space-y-4">
             {/* Default Global Rule Set Dropdown */}
             <FormField
              label="Default Global Rule Set"
              htmlFor="defaultGlobalRuleSetId"
              helpText="Global rule sets apply to all content regardless of if the selected products are present"
            >
              <select
                id="defaultGlobalRuleSetId"
                name="defaultGlobalRuleSetId"
                value={formData.defaultGlobalRuleSetId || ''}
                onChange={handleInputChange}
                className="input w-full"
              >
                <option value="">Select...</option>
                {mockRuleSets.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>

            {/* Default Product Rule Set Dropdown */}
            <FormField
              label="Default Product Rule Set"
              htmlFor="defaultProductRuleSetId"
              helpText="Default product rules are rules that apply to all products of this issuer by default"
            >
              <select
                id="defaultProductRuleSetId"
                name="defaultProductRuleSetId"
                value={formData.defaultProductRuleSetId || ''}
                onChange={handleInputChange}
                className="input w-full"
              >
                <option value="">Select...</option>
                {mockRuleSets.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>

            {/* Default Channel Rule Set Dropdown */}
            <FormField
              label="Default Channel Rule Set"
              htmlFor="defaultChannelRuleSetId"
              helpText="Default channel rules are rules that apply to all channels when a product is found in an item"
            >
              <select
                id="defaultChannelRuleSetId"
                name="defaultChannelRuleSetId"
                value={formData.defaultChannelRuleSetId || ''}
                onChange={handleInputChange}
                className="input w-full"
              >
                <option value="">Select...</option>
                {mockRuleSets.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </div>
      </div>
    </BaseModal>
  );
};

export default EditAdvertiserModal;
