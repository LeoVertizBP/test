'use client';

import React from 'react';

interface FormFieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
  helpText?: string;
}

const FormField: React.FC<FormFieldProps> = ({ 
  label, 
  htmlFor, 
  required = false, 
  error,
  children,
  className = '',
  helpText
}) => {
  return (
    <div className={`mb-4 ${className}`}>
      <label 
        htmlFor={htmlFor} 
        className="block text-sm font-medium mb-1"
      >
        {label}
        {required && <span className="text-error ml-1">*</span>}
      </label>
      
      {children}
      
      {helpText && !error && (
        <p className="mt-1 text-xs text-text-secondary">
          {helpText}
        </p>
      )}
      
      {error && (
        <p className="mt-1 text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
};

export default FormField;
