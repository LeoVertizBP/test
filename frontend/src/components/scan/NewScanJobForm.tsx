'use client';

import React, { useState, useEffect } from 'react'; // Added useEffect
import axios from 'axios'; // Import axios for API calls

// Step interfaces
interface BasicInfoStep {
  name: string;
  description: string;
}

interface PublisherSelectionStep {
  publishers: string[];
  scanAllPublishers: boolean;
}

interface ChannelSelectionStep {
  platforms: string[];
  scanAllPlatforms: boolean;
}

interface ProductSelectionStep {
  products: string[];
  advertiserFilter: string;
}

interface ScheduleStep {
  runImmediately: boolean;
  scheduledTime?: string;
}

// Form state interface
interface ScanJobFormData {
  basicInfo: BasicInfoStep;
  publishers: PublisherSelectionStep;
  channels: ChannelSelectionStep;
  products: ProductSelectionStep;
  schedule: ScheduleStep;
}

// Platform type from API
interface PlatformOption {
  value: string;
  label: string;
}

// Mock data (Keep for publishers/products for now)
const mockPublishers = [
  { id: '1', name: 'AcmeCo' },
  { id: '2', name: 'BetaInc' },
  { id: '3', name: 'GamesCo' },
  { id: '4', name: 'TechFirm' }
];

const mockProducts = [
  { id: '101', name: 'Premium Card' },
  { id: '102', name: 'Travel Card' },
  { id: '103', name: 'Rewards Card' },
  { id: '104', name: 'Basic Card' }
];

interface NewScanJobFormProps {
  onSubmit: (formData: ScanJobFormData) => void;
  onCancel: () => void;
}

const NewScanJobForm: React.FC<NewScanJobFormProps> = ({ onSubmit, onCancel }) => {
  const [currentStep, setCurrentStep] = useState(0);
  
  // Initialize form state
  const [formData, setFormData] = useState<ScanJobFormData>({
    basicInfo: { name: '', description: '' },
    publishers: { publishers: [], scanAllPublishers: false },
    channels: { platforms: [], scanAllPlatforms: false },
    products: { products: [], advertiserFilter: '' },
    schedule: { runImmediately: true }
  });
  const [platformOptions, setPlatformOptions] = useState<PlatformOption[]>([]); // State for fetched platforms
  const [platformError, setPlatformError] = useState<string | null>(null); // State for platform fetch error
  const [isLoadingPlatforms, setIsLoadingPlatforms] = useState(true); // Loading state for platforms
  
  const steps = ['Basic Information', 'Select Publishers', 'Select Channels', 'Select Products', 'Schedule'];
  
  // Navigation functions
  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };
  
  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };
  
  const handleSubmit = () => {
    // Map selected platform labels/values if needed before submitting
    // Currently, formData.channels.platforms stores the 'value' (e.g., 'YOUTUBE_SHORTS')
    onSubmit(formData);
  };

  // Fetch platforms from API when component mounts or step changes to 2
  useEffect(() => {
    // --- SIMPLIFIED DEBUG LOGGING ---
    console.log(`[Effect Check - Step Change] currentStep: ${currentStep}, platformOptions.length: ${platformOptions.length}, platformError: ${platformError}`);
    // --- DEBUG LOGGING END ---
    const fetchPlatforms = async () => {
      // Only fetch if we are on the channel selection step and haven't fetched yet
      // console.log(`[Effect Check Inside] Checking condition: currentStep === 2 (${currentStep === 2}), platformOptions.length === 0 (${platformOptions.length === 0}), !platformError (${!platformError})`); // DEBUG LOG (Removed)
      if (currentStep === 2 && platformOptions.length === 0 && !platformError) {
        // console.log('[Effect Check Inside] Condition MET. Fetching platforms...'); // DEBUG LOG (Removed)
        setIsLoadingPlatforms(true);
        setPlatformError(null);
        try {
          // Use environment variable with fallback for local development
          const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
          console.log(`[API Debug] Using API base URL: ${apiBaseUrl}`);
          const response = await axios.get(`${apiBaseUrl}/api/v1/platforms`); 
          if (response.data && Array.isArray(response.data)) {
            setPlatformOptions(response.data);
          } else {
            throw new Error('Invalid data format received for platforms');
          }
        } catch (error) {
          console.error('Error fetching platforms:', error);
          setPlatformError('Failed to load platform options. Please try again later.');
          // Keep existing hardcoded options as fallback? Or show error? Showing error for now.
          setPlatformOptions([]); // Clear options on error
        } finally {
          setIsLoadingPlatforms(false);
        }
      }
    };

    fetchPlatforms();
  // Dependency array includes currentStep to trigger fetch when reaching step 2
  // Also include platformOptions.length and platformError to prevent re-fetching if already loaded or failed
  }, [currentStep, platformOptions.length, platformError]); 
  
  // Form update functions
  const updateBasicInfo = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      basicInfo: {
        ...formData.basicInfo,
        [name]: value
      }
    });
  };
  
  const updatePublishers = (e: React.ChangeEvent<HTMLInputElement>, publisherId: string) => {
    const { checked } = e.target;
    
    if (checked) {
      setFormData({
        ...formData,
        publishers: {
          ...formData.publishers,
          publishers: [...formData.publishers.publishers, publisherId]
        }
      });
    } else {
      setFormData({
        ...formData,
        publishers: {
          ...formData.publishers,
          publishers: formData.publishers.publishers.filter(id => id !== publisherId)
        }
      });
    }
  };
  
  const toggleScanAllPublishers = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { checked } = e.target;
    setFormData({
      ...formData,
      publishers: {
        ...formData.publishers,
        scanAllPublishers: checked,
        publishers: checked ? [] : formData.publishers.publishers
      }
    });
  };
  
  const updatePlatforms = (e: React.ChangeEvent<HTMLInputElement>, platform: string) => {
    const { checked } = e.target;
    
    if (checked) {
      setFormData({
        ...formData,
        channels: {
          ...formData.channels,
          platforms: [...formData.channels.platforms, platform]
        }
      });
    } else {
      setFormData({
        ...formData,
        channels: {
          ...formData.channels,
          platforms: formData.channels.platforms.filter(p => p !== platform)
        }
      });
    }
  };
  
  const toggleScanAllPlatforms = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { checked } = e.target;
    setFormData({
      ...formData,
      channels: {
        ...formData.channels,
        scanAllPlatforms: checked,
        platforms: checked ? [] : formData.channels.platforms
      }
    });
  };
  
  const updateProducts = (e: React.ChangeEvent<HTMLInputElement>, productId: string) => {
    const { checked } = e.target;
    
    if (checked) {
      setFormData({
        ...formData,
        products: {
          ...formData.products,
          products: [...formData.products.products, productId]
        }
      });
    } else {
      setFormData({
        ...formData,
        products: {
          ...formData.products,
          products: formData.products.products.filter(id => id !== productId)
        }
      });
    }
  };
  
  const updateSchedule = (runImmediately: boolean, scheduledTime?: string) => {
    setFormData({
      ...formData,
      schedule: {
        runImmediately,
        scheduledTime
      }
    });
  };
  
  // Validation functions
  const isBasicInfoValid = () => formData.basicInfo.name.trim() !== '';
  
  const isPublishersValid = () => 
    formData.publishers.scanAllPublishers || formData.publishers.publishers.length > 0;
  
  const isPlatformsValid = () => 
    formData.channels.scanAllPlatforms || formData.channels.platforms.length > 0;
  
  const isProductsValid = () => formData.products.products.length > 0;
  
  const isScheduleValid = () => 
    formData.schedule.runImmediately || (formData.schedule.scheduledTime && formData.schedule.scheduledTime.trim() !== '');
  
  // Check if current step is valid
  const isCurrentStepValid = () => {
    switch (currentStep) {
      case 0: return isBasicInfoValid();
      case 1: return isPublishersValid();
      case 2: return isPlatformsValid();
      case 3: return isProductsValid();
      case 4: return isScheduleValid();
      default: return false;
    }
  };
  
  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-text-secondary">
                Scan Job Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.basicInfo.name}
                onChange={updateBasicInfo}
                className="input w-full"
                placeholder="e.g., YouTube April Review"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-text-secondary">
                Description (Optional)
              </label>
              <textarea
                name="description"
                value={formData.basicInfo.description}
                onChange={updateBasicInfo}
                className="input w-full h-24"
                placeholder="Add details about this scan job..."
              />
            </div>
          </div>
        );
      case 1:
        return (
          <div className="space-y-4">
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="scanAllPublishers"
                checked={formData.publishers.scanAllPublishers}
                onChange={toggleScanAllPublishers}
                className="mr-2"
              />
              <label htmlFor="scanAllPublishers" className="font-medium">
                Scan all publishers
              </label>
            </div>
            
            {!formData.publishers.scanAllPublishers && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {mockPublishers.map(publisher => (
                  <div key={publisher.id} className="flex items-center p-2 bg-background rounded-input">
                    <input
                      type="checkbox"
                      id={`publisher-${publisher.id}`}
                      checked={formData.publishers.publishers.includes(publisher.id)}
                      onChange={(e) => updatePublishers(e, publisher.id)}
                      className="mr-2"
                    />
                    <label htmlFor={`publisher-${publisher.id}`}>
                      {publisher.name}
                    </label>
                  </div>
                ))}
              </div>
            )}
            
            {!formData.publishers.scanAllPublishers && mockPublishers.length === 0 && (
              <div className="text-text-secondary text-center py-4">
                No publishers available
              </div>
            )}
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="scanAllPlatforms"
                checked={formData.channels.scanAllPlatforms}
                onChange={toggleScanAllPlatforms}
                className="mr-2"
              />
              <label htmlFor="scanAllPlatforms" className="font-medium">
                Scan all platforms
              </label>
            </div>
            
            {!formData.channels.scanAllPlatforms && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isLoadingPlatforms && <p className="text-text-secondary col-span-full">Loading platforms...</p>}
                {platformError && <p className="text-error col-span-full">{platformError}</p>}
                {!isLoadingPlatforms && !platformError && platformOptions.length === 0 && (
                  <p className="text-text-secondary col-span-full">No platforms available.</p>
                )}
                {!isLoadingPlatforms && !platformError && platformOptions.map((platform) => (
                  <div key={platform.value} className="flex items-center p-2 bg-background rounded-input">
                    <input
                      type="checkbox"
                      id={`platform-${platform.value}`}
                      // Check against the platform value (e.g., 'YOUTUBE_SHORTS')
                      checked={formData.channels.platforms.includes(platform.value)}
                      // Pass the platform value to the handler
                      onChange={(e) => updatePlatforms(e, platform.value)}
                      className="mr-2"
                    />
                    <label htmlFor={`platform-${platform.value}`} className="flex items-center">
                      {/* Basic Icon Logic (can be improved) */}
                      {platform.value === 'YOUTUBE' || platform.value === 'YOUTUBE_SHORTS' ? (
                        <svg className="w-5 h-5 text-error mr-2" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                        </svg>
                      ) : platform.value === 'INSTAGRAM' ? (
                        <svg className="w-5 h-5 text-secondary mr-2" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                        </svg>
                      ) : platform.value === 'TIKTOK' ? (
                        <svg className="w-5 h-5 text-primary mr-2" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                        </svg>
                      ) : (
                        // Default placeholder icon
                        <span className="w-5 h-5 mr-2">?</span> 
                      )}
                      {platform.label}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1 text-text-secondary">
                Filter by Advertiser
              </label>
              <input
                type="text"
                value={formData.products.advertiserFilter}
                onChange={(e) => setFormData({
                  ...formData,
                  products: {
                    ...formData.products,
                    advertiserFilter: e.target.value
                  }
                })}
                className="input w-full"
                placeholder="Type to filter by advertiser..."
              />
            </div>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {/* Filter products by advertiser if filter is provided */}
              {mockProducts
                .filter(product => formData.products.advertiserFilter 
                  ? product.name.toLowerCase().includes(formData.products.advertiserFilter.toLowerCase()) 
                  : true)
                .map(product => (
                <div key={product.id} className="flex items-center p-2 bg-background rounded-input">
                  <input
                    type="checkbox"
                    id={`product-${product.id}`}
                    checked={formData.products.products.includes(product.id)}
                    onChange={(e) => updateProducts(e, product.id)}
                    className="mr-2"
                  />
                  <label htmlFor={`product-${product.id}`}>
                    {product.name}
                  </label>
                </div>
              ))}
            </div>
            
            {mockProducts.length === 0 && (
              <div className="text-text-secondary text-center py-4">
                No products available
              </div>
            )}
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            <div className="flex items-center mb-4">
              <input
                type="radio"
                id="runImmediately"
                checked={formData.schedule.runImmediately}
                onChange={() => updateSchedule(true)}
                className="mr-2"
              />
              <label htmlFor="runImmediately" className="font-medium">
                Run immediately
              </label>
            </div>
            
            <div className="flex items-center mb-4">
              <input
                type="radio"
                id="scheduleForLater"
                checked={!formData.schedule.runImmediately}
                onChange={() => updateSchedule(false)}
                className="mr-2"
              />
              <label htmlFor="scheduleForLater" className="font-medium">
                Schedule for later
              </label>
            </div>
            
            {!formData.schedule.runImmediately && (
              <div>
                <label className="block text-sm font-medium mb-1 text-text-secondary">
                  Date and Time
                </label>
                <input
                  type="datetime-local"
                  value={formData.schedule.scheduledTime || ''}
                  onChange={(e) => updateSchedule(false, e.target.value)}
                  className="input w-full"
                />
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };
  
  return (
    <div className="bg-surface p-6 rounded-lg shadow-md max-w-6xl w-full mx-auto relative">
      <button 
        className="absolute top-4 right-4 text-text-secondary hover:text-text-primary p-1 rounded-full hover:bg-background"
        onClick={onCancel}
        aria-label="Close form"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <h2 className="text-h2 mb-6">Create New Scan Job</h2>
      
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`text-xs font-medium ${
                index === currentStep
                  ? 'text-secondary'
                  : index < currentStep
                  ? 'text-success'
                  : 'text-text-secondary'
              }`}
            >
              {step}
            </div>
          ))}
        </div>
        <div className="w-full bg-background rounded-full h-2">
          <div
            className="bg-secondary h-2 rounded-full"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          ></div>
        </div>
      </div>
      
      {/* Step content */}
      <div className="mb-8">
        {renderStepContent()}
      </div>
      
      {/* Navigation */}
      <div className="flex justify-between">
        <button
          className="btn-secondary"
          onClick={currentStep === 0 ? onCancel : prevStep}
        >
          {currentStep === 0 ? 'Cancel' : 'Back'}
        </button>
        
        <button
          className="btn-primary"
          disabled={!isCurrentStepValid()}
          onClick={currentStep === steps.length - 1 ? handleSubmit : nextStep}
        >
          {currentStep === steps.length - 1 ? 'Create Scan Job' : 'Next'}
        </button>
      </div>
    </div>
  );
};

export default NewScanJobForm;
