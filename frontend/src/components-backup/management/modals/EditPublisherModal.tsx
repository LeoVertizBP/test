'use client';

import React, { useState, useEffect } from 'react';
import BaseModal from '@/components/common/BaseModal';
import FormField from '@/components/common/FormField';
import MultiSelect from '@/components/common/MultiSelect';
import { 
  mockRuleSets, 
  publisherStatuses, 
  mockPlatforms, 
  channelStatuses 
} from './mockData';

type Channel = {
  id: string;
  platform: string;
  url: string;
  status: string;
};

interface PublisherFormData {
  name: string;
  status: string;
  contactEmail: string;
  contactPhone: string;
  channels: Channel[];
  globalRuleSets: string[];
  productRuleSets: string[];
  channelRuleSets: string[];
}

interface Publisher {
  id: string;
  name: string;
  status: string;
  contactInfo: {
    email: string;
    phone: string;
  };
  channels: {
    platform: string;
    url: string;
    status: string;
    lastScanned: string | null;
  }[];
  totalContent: number;
  totalFlags: number;
  complianceRate: number;
}

interface EditPublisherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PublisherFormData) => void;
  publisher: Publisher | null;
}

const EditPublisherModal: React.FC<EditPublisherModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  publisher
}) => {
  const initialData: PublisherFormData = {
    name: '',
    status: 'active',
    contactEmail: '',
    contactPhone: '',
    channels: [{ id: '1', platform: '', url: '', status: 'active' }],
    globalRuleSets: [],
    productRuleSets: [],
    channelRuleSets: []
  };
  
  const [formData, setFormData] = useState<PublisherFormData>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Update form when publisher data changes
  useEffect(() => {
    if (publisher) {
      setFormData({
        name: publisher.name,
        status: publisher.status.toLowerCase(),
        contactEmail: publisher.contactInfo.email,
        contactPhone: publisher.contactInfo.phone,
        channels: publisher.channels.map((channel, index) => ({
          id: String(index + 1),
          platform: mockPlatforms.find(p => p.label === channel.platform)?.value || '',
          url: channel.url,
          status: channel.status.toLowerCase()
        })),
        // In a real app, these would be loaded from the backend
        globalRuleSets: [],
        productRuleSets: [],
        channelRuleSets: []
      });
    }
  }, [publisher]);
  
  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen && !publisher) {
      setFormData(initialData);
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen, publisher]);
  
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
  
  // Add a new channel field
  const handleAddChannel = () => {
    setFormData(prev => ({
      ...prev,
      channels: [
        ...prev.channels,
        {
          id: `${prev.channels.length + 1}`,
          platform: '',
          url: '',
          status: 'active'
        }
      ]
    }));
  };
  
  // Remove a channel
  const handleRemoveChannel = (id: string) => {
    setFormData(prev => ({
      ...prev,
      channels: prev.channels.filter(channel => channel.id !== id)
    }));
  };
  
  // Update channel data
  const handleChannelChange = (id: string, field: keyof Channel, value: string) => {
    setFormData(prev => ({
      ...prev,
      channels: prev.channels.map(channel => 
        channel.id === id ? { ...channel, [field]: value } : channel
      )
    }));
    
    // Clear any channel errors
    if (errors[`channel-${id}-${field}`]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`channel-${id}-${field}`];
        return newErrors;
      });
    }
  };
  
  // Handle rule set selections
  const handleRuleSetChange = (type: 'globalRuleSets' | 'productRuleSets' | 'channelRuleSets', values: string[]) => {
    setFormData(prev => ({ ...prev, [type]: values }));
  };
  
  // Validate the form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    // Check required fields
    if (!formData.name.trim()) {
      newErrors.name = 'Publisher name is required';
    }
    
    // Validate email format if provided
    if (formData.contactEmail && !/^\S+@\S+\.\S+$/.test(formData.contactEmail)) {
      newErrors.contactEmail = 'Please enter a valid email address';
    }
    
    // Validate channels
    formData.channels.forEach(channel => {
      if (channel.platform && !channel.url) {
        newErrors[`channel-${channel.id}-url`] = 'URL is required when platform is selected';
      }
      
      if (!channel.platform && channel.url) {
        newErrors[`channel-${channel.id}-platform`] = 'Platform is required when URL is provided';
      }
      
      // Validate URL format if provided
      if (channel.url && !/^(https?:\/\/)?([\w-]+(\.[\w-]+)+\/?|localhost)(:\d+)?(\/\S*)?$/.test(channel.url)) {
        newErrors[`channel-${channel.id}-url`] = 'Please enter a valid URL';
      }
    });
    
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
      title="Edit Publisher"
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
              label="Publisher Name" 
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
                placeholder="Enter publisher name"
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
        
        {/* Channels Section */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-md font-semibold">Channels</h3>
            <button
              type="button"
              className="btn-tertiary"
              onClick={handleAddChannel}
            >
              + Add Channel
            </button>
          </div>
          
          {formData.channels.map((channel, index) => (
            <div key={channel.id} className="bg-background p-3 rounded-md mb-3">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium">Channel {index + 1}</h4>
                {formData.channels.length > 1 && (
                  <button
                    type="button"
                    className="text-error text-sm"
                    onClick={() => handleRemoveChannel(channel.id)}
                  >
                    Remove
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField 
                  label="Platform" 
                  htmlFor={`channel-${channel.id}-platform`}
                  error={errors[`channel-${channel.id}-platform`]}
                >
                  <select
                    id={`channel-${channel.id}-platform`}
                    value={channel.platform}
                    onChange={(e) => handleChannelChange(channel.id, 'platform', e.target.value)}
                    className="input w-full"
                  >
                    <option value="">Select platform</option>
                    {mockPlatforms.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FormField>
                
                <FormField 
                  label="URL" 
                  htmlFor={`channel-${channel.id}-url`}
                  error={errors[`channel-${channel.id}-url`]}
                >
                  <input
                    type="text"
                    id={`channel-${channel.id}-url`}
                    value={channel.url}
                    onChange={(e) => handleChannelChange(channel.id, 'url', e.target.value)}
                    className="input w-full"
                    placeholder="Enter channel URL"
                  />
                </FormField>
                
                <FormField 
                  label="Status" 
                  htmlFor={`channel-${channel.id}-status`}
                >
                  <select
                    id={`channel-${channel.id}-status`}
                    value={channel.status}
                    onChange={(e) => handleChannelChange(channel.id, 'status', e.target.value)}
                    className="input w-full"
                  >
                    {channelStatuses.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
            </div>
          ))}
        </div>
        
        {/* Default Rule Sets Section */}
        <div>
          <h3 className="text-md font-semibold mb-3">Default Rule Sets</h3>
          <div className="grid grid-cols-1 gap-4">
            <FormField 
              label="Global Rule Sets" 
              htmlFor="globalRuleSets"
              helpText="These rule sets will apply globally for this publisher"
            >
              <MultiSelect
                id="globalRuleSets"
                options={mockRuleSets}
                selectedValues={formData.globalRuleSets}
                onChange={(values) => handleRuleSetChange('globalRuleSets', values)}
                placeholder="Select global rule sets..."
              />
            </FormField>
            
            <FormField 
              label="Product Rule Sets" 
              htmlFor="productRuleSets"
              helpText="Default product-level rule sets for this publisher"
            >
              <MultiSelect
                id="productRuleSets"
                options={mockRuleSets}
                selectedValues={formData.productRuleSets}
                onChange={(values) => handleRuleSetChange('productRuleSets', values)}
                placeholder="Select product rule sets..."
              />
            </FormField>
            
            <FormField 
              label="Channel Rule Sets" 
              htmlFor="channelRuleSets"
              helpText="Default channel-level rule sets for this publisher"
            >
              <MultiSelect
                id="channelRuleSets"
                options={mockRuleSets}
                selectedValues={formData.channelRuleSets}
                onChange={(values) => handleRuleSetChange('channelRuleSets', values)}
                placeholder="Select channel rule sets..."
              />
            </FormField>
          </div>
        </div>
      </div>
    </BaseModal>
  );
};

export default EditPublisherModal;
