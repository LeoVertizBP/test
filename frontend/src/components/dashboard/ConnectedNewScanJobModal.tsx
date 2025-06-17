'use client';

import React, { useState, useEffect } from 'react';
import { scanJobService } from '@/services/scanJobService';
import { publisherService, Publisher } from '@/services/publisherService'; // Import publisher service and type
import { productService, Product } from '@/services/productService'; // Import product service and type
import MultiSelect from '@/components/common/MultiSelect'; // Import MultiSelect

// Define interfaces for data structures
// Publisher and Product interfaces are now imported from their respective services

interface PlatformOption {
  id: string; // e.g., 'YouTube Video', 'TikTok'
  name: string; // Display name
}

interface ConnectedNewScanJobModalProps {
  onClose: () => void;
  onSuccess?: (scanJobId: string) => void;
}

const ConnectedNewScanJobModal: React.FC<ConnectedNewScanJobModalProps> = ({
  onClose,
  onSuccess
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null); // Renamed for clarity
  const [success, setSuccess] = useState(false);

  // State for fetching data
  const [publishersLoading, setPublishersLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form state - using arrays for multi-select
  const [selectedPublisherIds, setSelectedPublisherIds] = useState<string[]>([]);
  const [selectedPlatformTypes, setSelectedPlatformTypes] = useState<string[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [jobName, setJobName] = useState<string>("");
  const [jobDescription, setJobDescription] = useState<string>("");
  const [bypassAiProcessing, setBypassAiProcessing] = useState<boolean>(false); // State for the new checkbox

  // State for available options
  const [availablePublishers, setAvailablePublishers] = useState<Publisher[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);

  // Hardcoded platforms based on backend service logic
  // TODO: Replace hardcoded platforms with API call when available and ensure consistency with DB values.
  const availablePlatforms: PlatformOption[] = [
    // Use platform IDs that match the backend values
    { id: "YouTube", name: "YouTube Video" }, 
    { id: "YOUTUBE_SHORTS", name: "YouTube Shorts" }, // Added YouTube Shorts
    { id: "TikTok", name: "TikTok" },             
    { id: "Instagram", name: "Instagram" },         
  ];

  // Fetch publishers and products on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setFetchError(null);
        setPublishersLoading(true);
        setProductsLoading(true);

        const [pubResponse, prodResponse] = await Promise.all([
          publisherService.getPublishers(),
          productService.getProducts()
        ]);

        setAvailablePublishers(pubResponse.data);
        setAvailableProducts(prodResponse.data);

      } catch (err: any) {
        console.error('Failed to fetch publishers or products:', err);
        setFetchError(err.response?.data?.message || 'Failed to load selection options. Please try again.');
      } finally {
        setPublishersLoading(false);
        setProductsLoading(false);
      }
    };

    fetchData();
  }, []); // Empty dependency array ensures this runs only once on mount

  // Validation: Ensure at least one publisher and one platform are selected
  const isFormValid = selectedPublisherIds.length > 0 && selectedPlatformTypes.length > 0;

  // Handle form submission
  const handleSubmit = async () => {
    if (!isFormValid) return;

    setIsSubmitting(true);
    setSubmitError(null); // Use renamed state

    try {
      // Create payload with the new structure
      const payload = {
        publisherIds: selectedPublisherIds,
        platformTypes: selectedPlatformTypes,
        productIds: selectedProductIds, // Include selected product IDs
        jobName: jobName || undefined,
        jobDescription: jobDescription || undefined,
        bypassAiProcessing: bypassAiProcessing // Include the bypass flag
      };

      console.log("Submitting Scan Job Payload:", payload); // Log payload for debugging

      // Call the new API service function
      const response = await scanJobService.startMultiTargetScan(payload);

      // Handle success
      setSuccess(true);
      if (onSuccess) {
        onSuccess(response.data.id);
      }

      // Auto-close after success
      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (err: any) {
      console.error('Failed to create scan job:', err);
      setSubmitError(err.response?.data?.message || 'Failed to create scan job. Please try again.'); // Use renamed state
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
      <div className="bg-surface rounded-lg shadow-lg z-10 max-w-lg w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-h2">Start New Scan</h2>
            <button 
              className="text-text-secondary hover:text-text-primary"
              onClick={onClose}
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {success ? (
            <div className="bg-success bg-opacity-10 text-success p-4 rounded-md mb-4">
              <p className="font-medium">Scan created successfully!</p>
              <p className="text-sm">The scan has been started and will begin processing shortly.</p>
            </div>
          ) : (
            <>
              {submitError && ( // Use renamed state
                <div className="bg-error bg-opacity-10 text-error p-4 rounded-md mb-4">
                  <p>{submitError}</p>
                </div>
              )}
              {fetchError && ( // Show fetch error if present
                <div className="bg-warning bg-opacity-10 text-warning p-4 rounded-md mb-4">
                  <p>{fetchError}</p>
                </div>
              )}

              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2"> {/* Added max-height and scroll */}
                {/* Publisher Selection */}
                <div>
                  <label className="block text-sm font-medium mb-1 text-text-secondary">
                    Publishers * {publishersLoading ? '(Loading...)' : ''}
                  </label>
                  <MultiSelect
                    id="publisher-select" // Added ID
                    options={availablePublishers.map(p => ({ value: p.id, label: p.name }))}
                    selectedValues={selectedPublisherIds}
                    onChange={setSelectedPublisherIds}
                    placeholder={publishersLoading ? "Loading..." : "Select publishers..."}
                    disabled={isSubmitting || publishersLoading || !!fetchError} // Disable if loading or error
                  />
                   <p className="mt-1 text-xs text-text-tertiary">Select one or more publishers to scan.</p>
                </div>

                 {/* Platform Selection */}
                 <div>
                  <label className="block text-sm font-medium mb-1 text-text-secondary">
                    Platforms *
                  </label>
                  <MultiSelect
                    id="platform-select" // Added ID
                    options={availablePlatforms.map(p => ({ value: p.id, label: p.name }))} // Uses updated availablePlatforms
                    selectedValues={selectedPlatformTypes}
                    onChange={setSelectedPlatformTypes}
                    placeholder="Select platforms..."
                    disabled={isSubmitting || !!fetchError} // Disable if error fetching other data
                  />
                   <p className="mt-1 text-xs text-text-tertiary">Select platforms to scan across the chosen publishers.</p>
                </div>

                 {/* Product Selection */}
                 <div>
                  <label className="block text-sm font-medium mb-1 text-text-secondary">
                    Products (Optional) {productsLoading ? '(Loading...)' : ''}
                  </label>
                  <MultiSelect
                    id="product-select" // Added ID
                    options={availableProducts.map(p => ({ value: p.id, label: p.name }))}
                    selectedValues={selectedProductIds}
                    onChange={setSelectedProductIds}
                    placeholder={productsLoading ? "Loading..." : "Select products..."}
                    disabled={isSubmitting || productsLoading || !!fetchError} // Disable if loading or error
                  />
                   <p className="mt-1 text-xs text-text-tertiary">Focus analysis on these specific products.</p>
                </div>

                {/* Optional Scan Details */}
                <div>
                  <label className="block text-sm font-medium mb-1 text-text-secondary">
                    Scan Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={jobName}
                    onChange={(e) => setJobName(e.target.value)}
                    className="input w-full"
                    placeholder="e.g., April YouTube Review"
                    disabled={isSubmitting}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1 text-text-secondary">
                    Description (Optional)
                  </label>
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    className="input w-full h-24"
                    placeholder="Add details about this scan job..."
                    disabled={isSubmitting}
                  />
                </div>

                {/* AI Bypass Checkbox */}
                <div className="flex items-center mt-4">
                  <input
                    id="bypassAiProcessing"
                    type="checkbox"
                    checked={bypassAiProcessing}
                    onChange={(e) => setBypassAiProcessing(e.target.checked)}
                    className="text-primary focus:ring-primary border-gray-300 rounded"
                    disabled={isSubmitting}
                  />
                  <label htmlFor="bypassAiProcessing" className="ml-2 block text-sm text-text-primary">
                    Disable AI Bypass for this job?
                  </label>
                </div>
                 <p className="mt-1 text-xs text-text-tertiary">If checked, flags from this specific job will not be automatically processed, regardless of organization settings.</p>
              </div>
              
              <div className="flex justify-end mt-6">
                <button
                  className="btn-secondary mr-3"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={handleSubmit}
                  disabled={!isFormValid || isSubmitting}
                >
                  {isSubmitting ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Starting Scan...
                    </span>
                  ) : 'Start Scan'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConnectedNewScanJobModal;
