'use client';

import React, { useState } from 'react';
import BaseModal from '@/components/common/BaseModal';
import FormField from '@/components/common/FormField';
import MultiSelect from '@/components/common/MultiSelect';
import { mockRules, ruleSetTypes } from './mockData';

interface RuleSetFormData {
  name: string;
  description: string;
  type: string;
  rules: string[];
}

interface AddRuleSetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: RuleSetFormData) => void;
}

const AddRuleSetModal: React.FC<AddRuleSetModalProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  const initialData: RuleSetFormData = {
    name: '',
    description: '',
    type: 'global',
    rules: []
  };
  
  const [formData, setFormData] = useState<RuleSetFormData>(initialData);
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
  
  // Handle rule selections
  const handleRulesChange = (values: string[]) => {
    setFormData(prev => ({ ...prev, rules: values }));
  };
  
  // Validate the form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Check required fields
    if (!formData.name.trim()) {
      newErrors.name = 'Rule set name is required';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    
    if (!formData.type) {
      newErrors.type = 'Rule set type is required';
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
        ) : 'Create Rule Set'}
      </button>
    </div>
  );
  
  return (
    <BaseModal
      title="Create Rule Set"
      isOpen={isOpen}
      onClose={onClose}
      footer={modalFooter}
      size="lg"
    >
      <div className="space-y-6">
        {/* Basic Information Section */}
        <div>
          <h3 className="text-md font-semibold mb-3">Basic Information</h3>
          <div className="grid grid-cols-1 gap-4">
            <FormField 
              label="Rule Set Name" 
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
                placeholder="Enter rule set name"
              />
            </FormField>
            
            <FormField 
              label="Rule Set Type" 
              htmlFor="type"
              required
              error={errors.type}
            >
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                className="input w-full"
              >
                {ruleSetTypes.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FormField>
            
            <FormField 
              label="Description" 
              htmlFor="description"
              required
              error={errors.description}
              helpText="Brief explanation of when this rule set applies"
            >
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="input w-full"
                rows={2}
                placeholder="Enter rule set description"
              />
            </FormField>
          </div>
        </div>
        
        {/* Included Rules Section */}
        <div>
          <FormField 
            label="Included Rules" 
            htmlFor="rules"
            helpText="Select rules to include in this rule set"
          >
            <MultiSelect
              id="rules"
              options={mockRules}
              selectedValues={formData.rules}
              onChange={handleRulesChange}
              placeholder="Select rules to include..."
            />
          </FormField>
        </div>
      </div>
    </BaseModal>
  );
};

export default AddRuleSetModal;
