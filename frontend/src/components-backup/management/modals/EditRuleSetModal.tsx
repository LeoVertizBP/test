'use client';

import React, { useState, useEffect } from 'react';
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

interface RuleSetData {
  id: string;
  name: string;
  description: string;
  rules: number;
  assignedProducts: number;
}

interface EditRuleSetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: RuleSetFormData) => void;
  ruleSet: RuleSetData | null;
}

const EditRuleSetModal: React.FC<EditRuleSetModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  ruleSet
}) => {
  const initialData: RuleSetFormData = {
    name: '',
    description: '',
    type: 'core',
    rules: []
  };
  
  const [formData, setFormData] = useState<RuleSetFormData>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Update form when ruleSet data changes
  useEffect(() => {
    if (ruleSet) {
      setFormData({
        name: ruleSet.name,
        description: ruleSet.description,
        type: 'core', // Default to core type since we don't have real type data
        rules: [] // We don't have the real rule IDs, so default to empty
      });
    }
  }, [ruleSet]);
  
  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setErrors({});
      setIsSubmitting(false);
      // Don't reset formData here, as we want to keep it populated with the rule set data
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
  
  // Handle rule selection
  const handleRuleMultiSelectChange = (selectedValues: string[]) => {
    setFormData(prev => ({ ...prev, rules: selectedValues }));
  };
  
  // Validate the form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Name is required
    if (!formData.name.trim()) {
      newErrors.name = 'Rule set name is required';
    }
    
    // Description is required
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
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
      title="Edit Rule Set"
      isOpen={isOpen}
      onClose={onClose}
      footer={modalFooter}
      size="md"
    >
      <div className="space-y-6">
        {/* Basic Information Section */}
        <div>
          <h3 className="text-md font-semibold mb-3">Rule Set Information</h3>
          <div className="space-y-4">
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
              label="Type" 
              htmlFor="type"
              required
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
            >
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="input w-full h-24"
                placeholder="Enter rule set description"
              />
            </FormField>
          </div>
        </div>
        
        {/* Rules Section */}
        <div>
          <h3 className="text-md font-semibold mb-3">Included Rules</h3>
          <FormField 
            label="Rules" 
            htmlFor="rules" 
            helpText="Select the rules to include in this rule set"
          >
            <MultiSelect
              id="rules"
              options={mockRules}
              selectedValues={formData.rules}
              onChange={handleRuleMultiSelectChange}
              placeholder="Select rules to include..."
            />
          </FormField>
          
          {ruleSet && (
            <div className="bg-background p-3 rounded-md mt-4 text-text-secondary text-sm">
              <p>This rule set is currently used by <span className="font-semibold">{ruleSet.assignedProducts}</span> products.</p>
              <p className="mt-1">Changes will apply to all assigned products.</p>
            </div>
          )}
        </div>
      </div>
    </BaseModal>
  );
};

export default EditRuleSetModal;
