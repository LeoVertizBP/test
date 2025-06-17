import React, { useState } from 'react';

// Mock data for demonstration (Consider moving to a shared location or fetching via API)
const mockPublishers = [
  { id: '1', name: 'AcmeCo Financial' }, // Use string IDs if they come from DB
  { id: '2', name: 'BetaInc Credit' },
  { id: '3', name: 'GamesCo Banking' },
  { id: '4', name: 'TechFirm Finance' },
  { id: '5', name: 'MediaGroup Cards' }
];

const mockProducts = [
  { id: '101', name: 'Premium Card' },
  { id: '102', name: 'Basic Card' },
  { id: '103', name: 'Travel Card' },
  { id: '104', name: 'Rewards Card' },
  { id: '105', name: 'Business Card' }
];

const platforms = [
  { id: 'youtube', name: 'YouTube' },
  { id: 'instagram', name: 'Instagram' },
  { id: 'tiktok', name: 'TikTok' }
];

interface FormData {
  name: string;
  publisherId: string;
  productIds: string[];
  platformIds: string[];
}

interface NewScanJobModalProps {
  onClose: () => void;
  onSubmit: (data: Omit<FormData, ''> & { startDate: string }) => void; // Adjust type for submitted data
}

const NewScanJobModal: React.FC<NewScanJobModalProps> = ({ onClose, onSubmit }) => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    publisherId: '',
    productIds: [],
    platformIds: []
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>, arrayName: keyof FormData) => {
    const { value, checked } = e.target;
    setFormData(prev => {
      const currentArray = prev[arrayName] as string[]; // Type assertion
      if (checked) {
        return { ...prev, [arrayName]: [...currentArray, value] };
      } else {
        return { ...prev, [arrayName]: currentArray.filter(id => id !== value) };
      }
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.name || !formData.publisherId || formData.platformIds.length === 0) {
        alert("Please fill in all required fields (Name, Publisher, Platforms).");
        return;
    }
    onSubmit({
      ...formData,
      startDate: new Date().toISOString().split('T')[0]
    });
  };

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        {/* Modal Header */}
        <div className="modal-header">
          <h3>Create New Scan</h3>
          <button 
            className="text-text-secondary hover:text-text-primary p-1 rounded-full hover:bg-background"
            onClick={onClose}
            aria-label="Close modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Scan Job Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium mb-1 text-text-secondary">
              Scan Job Name <span className="text-error">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="input w-full"
              placeholder="e.g., Q2 YouTube Review"
              required
            />
          </div>
          
          {/* Publisher Selection */}
          <div>
            <label htmlFor="publisherId" className="block text-sm font-medium mb-1 text-text-secondary">
              Publisher <span className="text-error">*</span>
            </label>
            <select
              id="publisherId"
              name="publisherId"
              value={formData.publisherId}
              onChange={handleChange}
              className="input w-full"
              required
            >
              <option value="" disabled>Select a publisher...</option>
              {mockPublishers.map(publisher => (
                <option key={publisher.id} value={publisher.id}>
                  {publisher.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Products Selection */}
          <div>
            <label className="block text-sm font-medium mb-1 text-text-secondary">
              Products to Scan (Optional)
            </label>
            <div className="space-y-2 max-h-32 overflow-y-auto bg-background p-3 rounded-input border border-neutral-light">
              {mockProducts.map(product => (
                <div key={product.id} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`product-${product.id}`}
                    value={product.id}
                    checked={formData.productIds.includes(product.id)}
                    onChange={(e) => handleCheckboxChange(e, 'productIds')}
                    className="mr-2 h-4 w-4 rounded text-secondary focus:ring-secondary border-neutral-light bg-surface" 
                  />
                  <label htmlFor={`product-${product.id}`} className="text-sm text-text-primary cursor-pointer">
                    {product.name}
                  </label>
                </div>
              ))}
            </div>
             <p className="text-xs text-text-secondary mt-1">Leave blank to scan all products for the selected publisher.</p>
          </div>
          
          {/* Platforms Selection */}
          <div>
            <label className="block text-sm font-medium mb-2 text-text-secondary">
              Platforms <span className="text-error">*</span>
            </label>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {platforms.map(platform => (
                <div key={platform.id} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`platform-${platform.id}`}
                    value={platform.id}
                    checked={formData.platformIds.includes(platform.id)}
                    onChange={(e) => handleCheckboxChange(e, 'platformIds')}
                    className="mr-1.5 h-4 w-4 rounded text-secondary focus:ring-secondary border-neutral-light bg-surface" 
                  />
                  <label htmlFor={`platform-${platform.id}`} className="text-sm text-text-primary cursor-pointer">
                    {platform.name}
                  </label>
                </div>
              ))}
            </div>
          </div>
          
          {/* Modal Footer */}
          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
            >
              Start Scan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewScanJobModal;
