'use client';

import React, { useState, useEffect } from 'react';
import BaseModal from '@/components/common/BaseModal';
import FormField from '@/components/common/FormField';
import MultiSelect from '@/components/common/MultiSelect';
import { ruleCategories, ruleSeverities } from './mockData';

interface RuleFormData {
  name: string;
  category: string;
  severity: string;
  description: string;
}

interface RuleData {
  id: string;
  name: string;
  category: string;
  severity: string;
  description: string;
  products: number;
  violationCount: number;
}

interface EditRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: RuleFormData) => void;
  rule: RuleData | null;
}

const EditRuleModal: React.FC<EditRuleModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  rule
}) => {
  const initialData: RuleFormData = {
    name: '',
    category: 'financial_terms',
    severity: 'medium',
    description: ''
  };
  
  const [formData, setFormData] = useState<RuleFormData>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Update form when rule data changes
  useEffect(() => {
    if (rule) {
      // Try to map the category string to a value in our dropdown
      const categoryValue = ruleCategories.find(c => 
        c.label.toLowerCase() === rule.category.toLowerCase()
      )?.value || 'other';
      
      // Same for severity
      const severityValue = ruleSeverities.find(s => 
        s.label.toLowerCase() === rule.severity.toLowerCase()
      )?.value || 'medium';
      
      setFormData({
        name: rule.name,
        category: categoryValue,
        severity: severityValue,
        description: rule.description
      });
    }
  }, [rule]);
  
  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setErrors({});
      setIsSubmitting(false);
      // Don't reset formData here, as we want to keep it populated with the rule's data
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
    
    // Name is required
    if (!formData.name.trim()) {
      newErrors.name = 'Rule name is required';
    }
    
    // Category is required
    if (!formData.category) {
      newErrors.category = 'Category is required';
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                required
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
