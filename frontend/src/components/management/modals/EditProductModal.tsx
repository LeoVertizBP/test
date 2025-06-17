'use client';

import React, { useState, useEffect } from 'react';
import BaseModal from '@/components/common/BaseModal';
import FormField from '@/components/common/FormField';
import { Product } from '@/services/productService'; // Assuming Product type is exported
import { mockAdvertisers } from './mockData'; // Use mock data for now

// Define form data structure (adjust as needed)
interface ProductFormData {
  name: string;
  advertiserId: string; // Changed from issuer
  fee: string;
  marketingBullets: string[];
  // Add other editable fields
}

// Define the props for the modal
interface EditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProductFormData) => void; // Data type might need adjustment
  product: Product | null; // Use the actual Product type
}

const EditProductModal: React.FC<EditProductModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  product
}) => {
  const initialData: ProductFormData = {
    name: '',
    advertiserId: '',
    fee: '',
    marketingBullets: [],
  };

  const [formData, setFormData] = useState<ProductFormData>(initialData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update form when product data changes
  useEffect(() => {
    if (product) {
      let bullets: string[] = [];
      try {
        // Assuming marketing_bullets is stored as a JSON string in the DB
        if (product.marketing_bullets) {
          bullets = JSON.parse(product.marketing_bullets as string);
        }
      } catch (e) {
        console.error("Error parsing marketing bullets:", e);
      }

      setFormData({
        name: product.name || '',
        advertiserId: product.advertiser_id || '', // Use advertiser_id
        fee: product.fee?.toString() || '', // Convert fee to string
        marketingBullets: bullets,
      });
    }
  }, [product]);

   // Reset form when modal opens/closes
   useEffect(() => {
    if (isOpen && !product) {
      setFormData(initialData);
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen, product]);

  // Handle basic input changes
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

  // Handle marketing bullets (simple example: comma-separated)
  const handleBulletsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const bulletsArray = e.target.value.split('\n').map(b => b.trim()).filter(b => b);
    setFormData(prev => ({ ...prev, marketingBullets: bulletsArray }));
  };


  // Validate the form (basic example)
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Product name is required';
    if (!formData.advertiserId) newErrors.advertiserId = 'Advertiser is required';
    // Add more validation as needed
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = () => {
    if (validateForm()) {
      setIsSubmitting(true);
      // Pass data back to parent for actual API call
      // Need to structure data correctly for the API (e.g., stringify bullets)
      const submissionData = {
        ...formData,
        marketingBullets: formData.marketingBullets // Parent will stringify if needed
      };
      onSubmit(submissionData);
      // Parent component (ProductManagement) handles closing and resetting state
      // setIsSubmitting(false); // Parent should handle this after API call
      // onClose();
    }
  };

  // Modal footer
  const modalFooter = (
    <div className="flex justify-end space-x-3">
      <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>Cancel</button>
      <button type="button" className="btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
        {isSubmitting ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );

  return (
    <BaseModal title="Edit Product" isOpen={isOpen} onClose={onClose} footer={modalFooter} size="lg">
      <div className="space-y-4">
        <FormField label="Product Name" htmlFor="name" required error={errors.name}>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            className="input w-full"
          />
        </FormField>

        <FormField label="Advertiser" htmlFor="advertiserId" required error={errors.advertiserId}>
           <select
            id="advertiserId"
            name="advertiserId"
            value={formData.advertiserId}
            onChange={handleInputChange}
            className="input w-full"
          >
            <option value="">Select Advertiser...</option>
            {/* TODO: Load real advertisers */}
            {mockAdvertisers.map(adv => (
              <option key={adv.value} value={adv.value}>{adv.label}</option>
            ))}
          </select>
        </FormField>

        <FormField label="Annual Fee ($)" htmlFor="fee" error={errors.fee}>
           <input
            type="number"
            id="fee"
            name="fee"
            value={formData.fee}
            onChange={handleInputChange}
            className="input w-full"
            placeholder="e.g., 95"
          />
        </FormField>

         <FormField label="Marketing Bullets (one per line)" htmlFor="marketingBullets" error={errors.marketingBullets}>
          <textarea
            id="marketingBullets"
            name="marketingBullets"
            rows={4}
            value={formData.marketingBullets.join('\n')}
            onChange={handleBulletsChange}
            className="input w-full"
            placeholder="Enter key benefits or features, one per line."
          />
        </FormField>

        {/* Add fields for rules, publishers later */}

      </div>
    </BaseModal>
  );
};

export default EditProductModal;
