'use client';

import React, { useEffect, useRef } from 'react';

interface BaseModalProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  closeOnClickOutside?: boolean;
}

const BaseModal: React.FC<BaseModalProps> = ({ 
  title, 
  isOpen, 
  onClose, 
  children, 
  footer,
  size = 'md',
  closeOnClickOutside = true
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Handle escape key press to close modal
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (isOpen && event.key === 'Escape') {
        onClose();
      }
    };
    
    // Add event listener for escape key
    document.addEventListener('keydown', handleEscapeKey);
    
    // Prevent scrolling on body when modal is open
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    
    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);
  
  // Handle outside click
  const handleOutsideClick = (event: React.MouseEvent) => {
    if (closeOnClickOutside && modalRef.current && !modalRef.current.contains(event.target as Node)) {
      onClose();
    }
  };
  
  if (!isOpen) return null;
  
  // Size classes
  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl'
  };
  
  return (
    <div 
      className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-50"
      onClick={handleOutsideClick}
    >
      <div 
        ref={modalRef}
        className={`bg-surface rounded-card shadow-lg w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col`}
        onClick={(e) => e.stopPropagation()} // Prevent click from propagating to overlay
      >
        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-neutral-light">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button 
            className="text-text-secondary hover:text-text-primary transition-colors"
            onClick={onClose}
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Modal Content */}
        <div className="px-6 py-4 overflow-auto flex-grow">
          {children}
        </div>
        
        {/* Modal Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-neutral-light">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default BaseModal;
