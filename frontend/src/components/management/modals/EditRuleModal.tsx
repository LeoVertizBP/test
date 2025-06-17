'use client';

import React, { useState, useEffect } from 'react';
import BaseModal from '@/components/common/BaseModal';
import FormField from '@/components/common/FormField';
import { Advertiser } from '@/services/advertiserService'; // Import Advertiser type
// Removed ruleCategories and ruleSeverities imports

// Updated form data structure (removed category and severity)
interface RuleFormData {
  name: string;
  description: string;
  // Add other editable fields like version, parameters if needed
}

// Updated data structure passed as prop (removed category and severity)
// Note: This might need further alignment with the actual Rule type from the service
interface RuleData {
  id: string;
  name: string;
  // category: string; // Removed
  // severity: string; // Removed
  description: string;
  products: number;
  violationCount: number;
  // Include other fields passed from RuleManagement like version, rule_type etc. if needed
  version?: string;
  rule_type?: 'PRODUCT_RULE' | 'CHANNEL_RULE';
  advertiser_id?: string; // Add advertiser_id if it comes with the rule prop
}

interface EditRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: RuleFormData) => void;
  rule: RuleData | null; // Use the updated RuleData type
  advertisers: Advertiser[]; // Add advertisers prop
}

const EditRuleModal: React.FC<EditRuleModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  rule,
  advertisers // Destructure advertisers prop
}) => {
  const initialData: RuleFormData = {
    name: '',
    description: ''
    // category removed
    // severity removed
  };

  const [formData, setFormData] = useState<RuleFormData>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update form when rule data changes
  useEffect(() => {
    if (rule) {
      // Removed category mapping
      // Removed severity mapping
      setFormData({
        name: rule.name || '', // Default if name is missing
        description: rule.description || '' // Default if description is missing
        // category removed
        // severity removed
      });
    } else {
      // If rule prop is null (e.g., modal opened without selection), reset to initial
      setFormData(initialData);
    }
  }, [rule, isOpen]); // Rerun if rule changes or modal opens

  // Reset errors and submitting state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Update field values
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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

  // Validate the form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Rule name is required';
    // Removed category validation
    if (!formData.description.trim()) newErrors.description = 'Description is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = () => {
    if (validateForm()) {
      setIsSubmitting(true);
      // Pass data back to parent (RuleManagement)
      onSubmit(formData);
      // Parent should handle closing and resetting submitting state after API call
      // Using setTimeout for now as parent doesn't handle API yet
       setTimeout(() => {
         setIsSubmitting(false);
         onClose();
       }, 500);
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
      title="Edit Rule"
      isOpen={isOpen}
      onClose={onClose}
      footer={modalFooter}
      size="md"
    >
      <div className="space-y-6">
        {/* Basic Information Section */}
        <div>
          <h3 className="text-md font-semibold mb-3">Rule Information</h3>
          <div className="space-y-4">
            <FormField
              label="Rule Name"
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
                placeholder="Enter rule name"
              />
            </FormField>

            {/* Add disabled Advertiser field */}
            <FormField
              label="Advertiser"
              htmlFor="advertiserId"
            >
              <select
                id="advertiserId"
                name="advertiserId"
                value={rule?.advertiser_id || ''} // Display current advertiser
                className="input w-full bg-neutral-light cursor-not-allowed"
                disabled // Make it non-editable
              >
                <option value="">{rule?.advertiser_id ? (advertisers.find(a => a.id === rule.advertiser_id)?.name || 'Unknown') : 'N/A'}</option>
                {/* Optionally list others, but keep it disabled */}
                {/* {advertisers.map(adv => (
                  <option key={adv.id} value={adv.id}>{adv.name}</option>
                ))} */}
              </select>
            </FormField>

            {/* Removed Category and Severity Fields */}

            <FormField
              label="Description"
              htmlFor="description"
              required
              error={errors.description}
            >
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="input w-full h-32"
                placeholder="Enter rule description and criteria"
              />
            </FormField>
          </div>
        </div>
      </div>
    </BaseModal>
  );
};

export default EditRuleModal;
