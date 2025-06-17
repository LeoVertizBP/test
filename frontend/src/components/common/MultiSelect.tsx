'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: Option[];
  selectedValues: string[];
  onChange: (selectedValues: string[]) => void;
  placeholder?: string;
  id: string;
  disabled?: boolean;
}

const MultiSelect: React.FC<MultiSelectProps> = ({
  options,
  selectedValues,
  onChange,
  placeholder = 'Select options...',
  id,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Filter options based on search term
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Toggle an option's selection
  const toggleOption = (value: string) => {
    if (disabled) return;
    
    const newSelectedValues = selectedValues.includes(value)
      ? selectedValues.filter(val => val !== value)
      : [...selectedValues, value];
    
    onChange(newSelectedValues);
  };
  
  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  // Get selected options for display
  const getSelectedOptionsText = () => {
    if (selectedValues.length === 0) {
      return <span className="text-text-secondary">{placeholder}</span>;
    }
    
    if (selectedValues.length === 1) {
      const option = options.find(opt => opt.value === selectedValues[0]);
      return option ? option.label : '';
    }
    
    return `${selectedValues.length} items selected`;
  };
  
  return (
    <div 
      className="relative"
      ref={dropdownRef}
    >
      <div
        className={`input w-full flex items-center justify-between cursor-pointer ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <div className="truncate">
          {getSelectedOptionsText()}
        </div>
        <svg 
          className={`h-5 w-5 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      
      {isOpen && (
        <div className="absolute z-20 mt-1 w-full bg-surface rounded-card shadow-lg border border-neutral-light max-h-60 overflow-hidden">
          <div className="p-2 border-b border-neutral-light">
            <input
              type="text"
              className="input w-full text-sm"
              placeholder="Search..."
              value={searchTerm}
              onChange={handleSearchChange}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          
          <div className="overflow-y-auto max-h-[calc(60vh-3rem)]">
            {/* Select All Option */}
            {options.length > 0 && ( // Only show if there are options
              <div 
                className="flex items-center p-2 hover:bg-background cursor-pointer border-b border-neutral-light sticky top-0 bg-surface z-10" // Added sticky positioning
                onClick={(e) => {
                  e.stopPropagation(); // Prevent dropdown from closing
                  const allValues = options.map(opt => opt.value);
                  const allSelected = selectedValues.length === allValues.length && allValues.every(val => selectedValues.includes(val));
                  onChange(allSelected ? [] : allValues); // Toggle select all/none
                }}
              >
                <input 
                  type="checkbox" 
                  className="mr-2"
                  checked={selectedValues.length === options.length && options.length > 0} // Checked if all options are selected
                  onChange={() => {}} // Handled by div click
                  id={`${id}-select-all`}
                />
                <label 
                  htmlFor={`${id}-select-all`}
                  className="cursor-pointer flex-grow font-medium" // Made bold
                >
                  Select All
                </label>
              </div>
            )}

            {/* Individual Options */}
            {filteredOptions.length > 0 ? (
              filteredOptions.map(option => (
                <div 
                  key={option.value} 
                  className={`flex items-center p-2 hover:bg-background cursor-pointer ${
                    selectedValues.includes(option.value) ? 'bg-primary bg-opacity-10' : ''
                  }`}
                  onClick={() => toggleOption(option.value)}
                >
                  <input 
                    type="checkbox" 
                    className="mr-2"
                    checked={selectedValues.includes(option.value)}
                    onChange={() => {}} // Handled by div click
                    id={`${id}-option-${option.value}`}
                  />
                  <label 
                    htmlFor={`${id}-option-${option.value}`}
                    className="cursor-pointer flex-grow"
                  >
                    {option.label}
                  </label>
                </div>
              ))
            ) : (
              <div className="p-2 text-text-secondary text-center">
                No options found
              </div>
            )}
          </div>
          
          {/* Removed the bottom footer with Clear/Select All buttons */}
        </div>
      )}
    </div>
  );
};

export default MultiSelect;
