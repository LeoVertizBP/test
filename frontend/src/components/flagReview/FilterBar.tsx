import React, { useState, useEffect } from 'react';

// Define the structure for options passed as props
interface Option {
  id: string;
  name: string;
}

interface Filters {
  scanJob: string;
  publisher: string;
  product: string;
  status: string;
  platform: string; // Changed channel to platform
  dateRange: { start: string; end: string };
}

interface FilterBarProps {
  filters: Filters;
  onFilterChange: (newFilters: Filters) => void;
  scanJobOptions: Option[];
  publisherOptions: Option[];
  productOptions: Option[];
  statusOptions: Option[];
  platformOptions: Option[]; // Changed channelOptions to platformOptions
}

const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  scanJobOptions,
  publisherOptions,
  productOptions,
  statusOptions,
  platformOptions // Changed channelOptions to platformOptions
}) => {
  const [localFilters, setLocalFilters] = useState<Filters>(filters);

  // Update local state if external filters change
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    const newFilters = { ...localFilters, [name]: value };
    setLocalFilters(newFilters);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const newDateRange = { ...localFilters.dateRange, [name]: value };
    const newFilters = { ...localFilters, dateRange: newDateRange };
    setLocalFilters(newFilters);
  };

  const handleApply = () => {
    console.log('Applying filters:', localFilters);
    onFilterChange(localFilters);
  };

  const handleReset = () => {
    const resetFilters: Filters = {
      scanJob: '',
      publisher: '',
      product: '',
      status: '',
      platform: '', // Reset platform
      dateRange: { start: '', end: '' }
    };
    setLocalFilters(resetFilters);
    onFilterChange(resetFilters);
  };

  return (
    <div className="card p-4">
      {/* Adjusted grid columns for potentially 6 items + buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
        {/* Scan Job Filter */}
        <div className="lg:col-span-1">
          <div className="flex justify-between items-center">
            <label htmlFor="scanJob" className="block text-sm font-medium mb-1 text-text-secondary">
              Scan
            </label>
            {scanJobOptions.length === 0 && (
              <span className="text-xs text-text-secondary flex items-center mb-1">
                <svg className="animate-spin -ml-1 mr-1 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading
              </span>
            )}
          </div>
          <div className="relative">
            <select
              id="scanJob"
              name="scanJob"
              value={localFilters.scanJob}
              onChange={handleChange}
              className="input w-full"
              disabled={scanJobOptions.length === 0}
            >
              <option value="">
                {scanJobOptions.length === 0 ? 'Loading scans...' : 'All Scans'}
              </option>
              {scanJobOptions.map(job => (
                <option key={job.id} value={job.id}> {/* Use ID for value */}
                  {job.name}
                </option>
              ))}
            </select>
            {scanJobOptions.length === 0 && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <svg className="animate-spin h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Publisher Filter */}
        <div className="lg:col-span-1">
          <div className="flex justify-between items-center">
            <label htmlFor="publisher" className="block text-sm font-medium mb-1 text-text-secondary">
              Publisher
            </label>
            {publisherOptions.length === 0 && (
              <span className="text-xs text-text-secondary flex items-center mb-1">
                <svg className="animate-spin -ml-1 mr-1 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading
              </span>
            )}
          </div>
          <div className="relative">
            <select
              id="publisher"
              name="publisher"
              value={localFilters.publisher}
              onChange={handleChange}
              className="input w-full"
              disabled={publisherOptions.length === 0}
            >
              <option value="">
                {publisherOptions.length === 0 ? 'Loading publishers...' : 'All Publishers'}
              </option>
              {publisherOptions.map(pub => (
                <option key={pub.id} value={pub.id}> {/* Use ID for value */}
                  {pub.name}
                </option>
              ))}
            </select>
            {publisherOptions.length === 0 && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <svg className="animate-spin h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Product Filter */}
        <div className="lg:col-span-1">
          <div className="flex justify-between items-center">
            <label htmlFor="product" className="block text-sm font-medium mb-1 text-text-secondary">
              Product
            </label>
            {productOptions.length === 0 && (
              <span className="text-xs text-text-secondary flex items-center mb-1">
                <svg className="animate-spin -ml-1 mr-1 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading
              </span>
            )}
          </div>
          <div className="relative">
            <select
              id="product"
              name="product"
              value={localFilters.product}
              onChange={handleChange}
              className="input w-full"
              disabled={productOptions.length === 0}
            >
              <option value="">
                {productOptions.length === 0 ? 'Loading products...' : 'All Products'}
              </option>
              {productOptions.map(prod => (
                <option key={prod.id} value={prod.id}> {/* Use ID for value */}
                  {prod.name}
                </option>
              ))}
            </select>
            {productOptions.length === 0 && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <svg className="animate-spin h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Status Filter */}
        <div className="lg:col-span-1">
          <div className="flex justify-between items-center">
            <label htmlFor="status" className="block text-sm font-medium mb-1 text-text-secondary">
              Status
            </label>
            {statusOptions.length === 0 && (
              <span className="text-xs text-text-secondary flex items-center mb-1">
                <svg className="animate-spin -ml-1 mr-1 h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading
              </span>
            )}
          </div>
          <div className="relative">
            <select
              id="status"
              name="status"
              value={localFilters.status}
              onChange={handleChange}
              className="input w-full"
              disabled={statusOptions.length === 0}
            >
              <option value="">
                {statusOptions.length === 0 ? 'Loading statuses...' : 'All Statuses'}
              </option>
              {statusOptions.map(status => (
                <option key={status.id} value={status.id}> {/* Status ID is the UI string */}
                  {status.name}
                </option>
              ))}
            </select>
            {statusOptions.length === 0 && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <svg className="animate-spin h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            )}
          </div>
        </div>

        {/* Platform Filter */}
        <div className="lg:col-span-1">
          <div className="flex justify-between items-center">
            <label htmlFor="platform" className="block text-sm font-medium mb-1 text-text-secondary">
              Platform
            </label>
            {/* Loading indicator removed as options are static */}
          </div>
          <div className="relative">
            <select
              id="platform"
              name="platform" // Ensure name matches the state key
              value={localFilters.platform}
              onChange={handleChange}
              className="input w-full"
              // disabled={platformOptions.length === 0} // No longer needed
            >
              <option value="">
                All Platforms
              </option>
              {platformOptions.map(plat => (
                <option key={plat.id} value={plat.id}> {/* Use ID (e.g., 'youtube') for value */}
                  {plat.name} {/* Display name (e.g., 'YouTube Video') */}
                </option>
              ))}
            </select>
            {/* Loading indicator removed */}
          </div>
        </div>

        {/* Action Buttons */}
        {/* Adjust grid columns if needed for layout */}
        <div className="flex items-end space-x-2 lg:col-span-2 lg:col-start-6"> {/* Adjusted col-span and start */}
          <button
            onClick={handleApply}
            className="btn-primary py-2 px-4 flex-grow text-sm" /* Adjusted padding/size */
          >
            Apply
          </button>
          <button
            onClick={handleReset}
            className="btn-secondary py-2 px-4 text-sm" /* Adjusted padding/size */
          >
            Reset
          </button>
        </div>
      </div>

      {/* Date Range Filters (Optional - uncomment if needed) */}
      {/*
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div>
          <label htmlFor="dateStart" className="block text-sm font-medium mb-1 text-text-secondary">
            Date Range (Start)
          </label>
          <input
            type="date"
            id="dateStart"
            name="start"
            value={localFilters.dateRange.start}
            onChange={handleDateChange}
            className="input w-full"
          />
        </div>

        <div>
          <label htmlFor="dateEnd" className="block text-sm font-medium mb-1 text-text-secondary">
            Date Range (End)
          </label>
          <input
            type="date"
            id="dateEnd"
            name="end"
            value={localFilters.dateRange.end}
            onChange={handleDateChange}
            className="input w-full"
          />
        </div>
      </div>
      */}
    </div>
  );
};

export default FilterBar;
