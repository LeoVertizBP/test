'use client';

import React from 'react';
import ChannelConfigForm from '../forms/ChannelConfigForm';
import { PublisherChannel } from '@/services/publisherService';

interface ChannelConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: PublisherChannel | null;
  publisherId: string | undefined;
}

/**
 * Modal for configuring website channel crawl settings.
 */
const ChannelConfigModal: React.FC<ChannelConfigModalProps> = ({
  isOpen,
  onClose,
  channel,
  publisherId
}) => {
  if (!isOpen || !channel || !publisherId) return null;
  
  // Add debugging to see what values are being passed to the form
  console.log('ChannelConfigModal: Rendering with:', {
    publisherId,
    publisherIdType: typeof publisherId,
    channel: {
      id: channel.id,
      idType: typeof channel.id,
      publisher_id: channel.publisher_id,
      platform: channel.platform,
      channel_url: channel.channel_url
    }
  });

  const handleConfigSuccess = (action: 'create' | 'update' | 'delete') => {
    // Close the modal after successful operation
    if (action === 'delete') {
      onClose();
    }
    // For create/update, we could stay on the form to allow further edits
    // But could also close if preferred
    // onClose();
  };

  const handleConfigError = (error: any) => {
    console.error('Error with channel config operation:', error);
    // We could show a toast/notification here if available in the app
    // For now, the form itself will display the error
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-border flex justify-between items-center">
          <h2 className="text-xl font-semibold">
            Configure Website Crawl: {channel.channel_url}
          </h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-error"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto">
          <ChannelConfigForm
            publisherId={publisherId}
            channelId={channel.id}
            onSuccess={handleConfigSuccess}
            onError={handleConfigError}
          />
        </div>
      </div>
    </div>
  );
};

export default ChannelConfigModal;
