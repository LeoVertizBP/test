'use client';

import React from 'react';

interface WebsiteChannelBadgeProps {
  isConfigured: boolean;
  onClick: () => void;
  disabled?: boolean;
}

/**
 * A badge component specifically for website channels that shows
 * configuration status and includes a button to configure the crawl settings.
 */
const WebsiteChannelBadge: React.FC<WebsiteChannelBadgeProps> = ({
  isConfigured,
  onClick,
  disabled = false
}) => {
  return (
    <div className="flex items-center space-x-2">
      {/* Website Icon */}
      <svg 
        className="w-4 h-4 text-primary" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" 
        />
      </svg>
      
      {/* Configuration Status */}
      <span 
        className={`text-xs px-2 py-1 rounded-full ${
          isConfigured 
            ? 'bg-success bg-opacity-20 text-success' 
            : 'bg-warning bg-opacity-20 text-warning'
        }`}
      >
        {isConfigured ? 'Configured' : 'Not Configured'}
      </span>
      
      {/* Configure Button */}
      <button
        onClick={onClick}
        disabled={disabled}
        className={`btn-tertiary text-xs py-1 px-2 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={isConfigured ? "Edit Crawl Configuration" : "Set Up Crawl Configuration"}
      >
        {isConfigured ? 'Edit Config' : 'Configure'}
      </button>
    </div>
  );
};

export default WebsiteChannelBadge;
