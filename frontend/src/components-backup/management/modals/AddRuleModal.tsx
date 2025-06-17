'use client';

import React, { useState } from 'react';
import BaseModal from '@/components/common/BaseModal';
import FormField from '@/components/common/FormField';
import MultiSelect from '@/components/common/MultiSelect';
import { mockRuleSets, ruleCategories, ruleSeverities } from './mockData';

interface RuleFormData {
  name: string;
  category: string;
  severity: string;
  description: string;
  ruleText: string;
  ruleSets: string[];
}

interface AddRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: RuleFormData) => void;
}

const AddRuleModal: React.FC<AddRuleModalProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  const initialData: RuleFormData = {
    name: '',
    category: '',
    severity: 'medium',
    description: '',
    ruleText: '',
    ruleSets: []
  };
  
  const [formData, setFormData] = useState<RuleFormData>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Reset form when modal opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setFormData(initialData);
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen]);
  
  // Update text field values
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
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
  const handleRuleSetsChange = (values: string[]) => {
    setFormData(prev => ({ ...prev, ruleSets: values }));
  };
  
  // Validate the form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Check required fields
    if (!formData.name.trim()) {
      newErrors.name = 'Rule name is required';
    }
    
    if (!formData.category) {
      newErrors.category = 'Category is required';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    
    if (!formData.ruleText.trim()) {
      newErrors.ruleText = 'Rule text is required';
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
        ) : 'Add Rule'}
      </button>
    </div>
  );
  
  return (
    <BaseModal
      title="Add Rule"
      isOpen={isOpen}
      onClose={onClose}
      footer={modalFooter}
      size="lg"
    >
      <div className="space-y-6">
        {/* Basic Information Section */}
        <div>
          <h3 className="text-md font-semibold mb-3">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            
            <FormField 
              label="Category" 
              htmlFor="category"
              required
              error={errors.category}
            >
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                className="input w-full"
              >
                <option value="">Select category</option>
                {ruleCategories.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
            
            <FormField 
              label="Severity" 
              htmlFor="severity"
            >
              <select
                id="severity"
                name="severity"
                value={formData.severity}
                onChange={handleInputChange}
                className="input w-full"
              >
                {ruleSeverities.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        </div>
        
        {/* Description and Rule Text */}
        <div>
          <FormField 
            label="Description" 
            htmlFor="description"
            required
            error={errors.description}
            helpText="Brief explanation of what this rule checks for"
          >
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              className="input w-full"
              rows={2}
              placeholder="Enter rule description"
            />
          </FormField>
          
          <FormField 
            label="Rule Text" 
            htmlFor="ruleText"
            required
            error={errors.ruleText}
            helpText="The exact wording of the compliance requirement"
          >
            <textarea
              id="ruleText"
              name="ruleText"
              value={formData.ruleText}
              onChange={handleInputChange}
              className="input w-full"
              rows={3}
              placeholder="Enter the exact rule text that will be used for compliance checking"
            />
          </FormField>
        </div>
        
        {/* Rule Sets Section */}
        <div>
          <FormField 
            label="Add to Rule Sets" 
            htmlFor="ruleSets"
            helpText="Select rule sets that should include this rule"
          >
            <MultiSelect
              id="ruleSets"
              options={mockRuleSets}
              selectedValues={formData.ruleSets}
              onChange={handleRuleSetsChange}
              placeholder="Select rule sets..."
            />
          </FormField>
        </div>
      </div>
    </BaseModal>
  );
};

export default AddRuleModal;
