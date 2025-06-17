'use client';

import React, { useState, useEffect } from 'react'; // Added useEffect
import BaseModal from '@/components/common/BaseModal';
import FormField from '@/components/common/FormField';
import MultiSelect from '@/components/common/MultiSelect';
// import { mockAdvertisers, mockRules, mockRuleSets } from './mockData'; // Comment out or remove mock data
import { Advertiser } from '@/services/advertiserService'; // Import actual types
import { ProductRuleDetail, ChannelRule, RuleSet } from '@/services/ruleService'; // Import actual types

interface ProductFormData {
  name: string;
  advertiser: string;
  fee: number | string;
  marketingBullets: string[];
  rules: string[];
  ruleSets: string[];
}

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProductFormData) => void;
  advertisers: Advertiser[];
  rules: (ProductRuleDetail | ChannelRule)[];
  ruleSets: RuleSet[];
}

const AddProductModal: React.FC<AddProductModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  advertisers,
  rules,
  ruleSets
}) => {
  const initialData: ProductFormData = {
    name: '',
    advertiser: '',
    fee: '',
    marketingBullets: [''],
    rules: [],
    ruleSets: []
  };
  
  const [formData, setFormData] = useState<ProductFormData>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Reset form when modal opens/closes
  useEffect(() => { // Changed React.useEffect to useEffect
    if (isOpen) {
      setFormData(initialData);
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen]);
  
  // Update text field values
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Handle numeric fee value
    if (name === 'fee') {
      // Allow empty string or only numbers
      if (value === '' || !isNaN(parseFloat(value))) {
        setFormData(prev => ({ ...prev, [name]: value }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };
  
  // Add a new marketing bullet
  const handleAddBullet = () => {
    setFormData(prev => ({
      ...prev,
      marketingBullets: [...prev.marketingBullets, '']
    }));
  };
  
  // Remove a bullet
  const handleRemoveBullet = (index: number) => {
    setFormData(prev => ({
      ...prev,
      marketingBullets: prev.marketingBullets.filter((_, i) => i !== index)
    }));
  };
  
  // Update bullet value
  const handleBulletChange = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      marketingBullets: prev.marketingBullets.map((bullet, i) => 
        i === index ? value : bullet
      )
    }));
    
    // Clear any bullet errors
    if (errors[`bullet-${index}`]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`bullet-${index}`];
        return newErrors;
      });
    }
  };
  
  // Handle rule selections
  const handleRulesChange = (values: string[]) => {
    setFormData(prev => ({ ...prev, rules: values }));
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
      newErrors.name = 'Product name is required';
    }
    
    if (!formData.advertiser) {
      newErrors.advertiser = 'Advertiser is required';
    }
    
    // Validate fee if provided
    if (formData.fee !== '' && isNaN(parseFloat(String(formData.fee)))) {
      newErrors.fee = 'Fee must be a valid number';
    }
    
    // Check marketing bullets
    formData.marketingBullets.forEach((bullet, index) => {
      if (!bullet.trim() && index !== formData.marketingBullets.length - 1) {
        newErrors[`bullet-${index}`] = 'Bullet point cannot be empty';
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Handle form submission
  const handleSubmit = () => {
    if (validateForm()) {
      setIsSubmitting(true);
      
      // Prepare data for submission
      const submitData = {
        ...formData,
        // Filter out empty bullet points
        marketingBullets: formData.marketingBullets.filter(bullet => bullet.trim() !== ''),
        // Convert fee to number if not empty
        fee: formData.fee === '' ? 0 : parseFloat(String(formData.fee))
      };
      
      // Simulate API call
      setTimeout(() => {
        onSubmit(submitData);
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
        ) : 'Add Product'}
      </button>
    </div>
  );
  
  return (
    <BaseModal
      title="Add Product"
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
              label="Product Name" 
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
                placeholder="Enter product name"
              />
            </FormField>
            
            <FormField 
              label="Advertiser" 
              htmlFor="advertiser"
              required
              error={errors.advertiser}
            >
              <select
                id="advertiser"
                name="advertiser"
                value={formData.advertiser}
                onChange={handleInputChange}
                className="input w-full"
              >
                <option value="">Select advertiser</option>
                {advertisers.map(adv => (
                  <option key={adv.id} value={adv.id}>
                    {adv.name}
                  </option>
                ))}
              </select>
            </FormField>
            
            <FormField 
              label="Annual Fee" 
              htmlFor="fee"
              error={errors.fee}
              helpText="Leave empty for 'No Annual Fee'"
            >
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-text-secondary">
                  $
                </span>
                <input
                  type="text"
                  id="fee"
                  name="fee"
                  value={formData.fee}
                  onChange={handleInputChange}
                  className="input w-full pl-6"
                  placeholder="0.00"
                />
              </div>
            </FormField>
          </div>
        </div>
        
        {/* Marketing Bullets Section */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-md font-semibold">Marketing Bullets</h3>
            <button
              type="button"
              className="btn-tertiary"
              onClick={handleAddBullet}
            >
              + Add Bullet
            </button>
          </div>
          
          {formData.marketingBullets.map((bullet, index) => (
            <div key={index} className="flex items-center gap-2 mb-2">
              <span className="text-text-secondary">•</span>
              <input
                type="text"
                value={bullet}
                onChange={(e) => handleBulletChange(index, e.target.value)}
                className={`input flex-grow ${errors[`bullet-${index}`] ? 'border-error' : ''}`}
                placeholder="Enter marketing point"
              />
              <button
                type="button"
                className="text-error"
                onClick={() => handleRemoveBullet(index)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        
        {/* Rules and Rule Sets Section */}
        <div>
          <h3 className="text-md font-semibold mb-3">Compliance Rules</h3>
          <div className="grid grid-cols-1 gap-4">
            <FormField 
              label="Individual Rules" 
              htmlFor="rules"
              helpText="Select individual rules that apply to this product"
            >
              <MultiSelect
                id="rules"
                options={rules.map(rule => ({ label: rule.name, value: rule.id }))}
                selectedValues={formData.rules}
                onChange={handleRulesChange}
                placeholder="Select applicable rules..."
              />
            </FormField>
            
            <FormField 
              label="Rule Sets" 
              htmlFor="ruleSets"
              helpText="Select rule sets to apply to this product"
            >
              <MultiSelect
                id="ruleSets"
                options={ruleSets.map(rs => ({ label: rs.name, value: rs.id }))}
                selectedValues={formData.ruleSets}
                onChange={handleRuleSetsChange}
                placeholder="Select rule sets..."
              />
            </FormField>
          </div>
        </div>
      </div>
    </BaseModal>
  );
};

export default AddProductModal;
