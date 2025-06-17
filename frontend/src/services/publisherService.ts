import apiClient from './api/client';
import ENDPOINTS from './api/endpoints';

// TypeScript interfaces
export interface Publisher {
  id: string;
  name: string;
  organization_id?: string;
  status?: string;
  website?: string;
  contact_name?: string;
  // contact_email?: string; // Will be part of contact_info
  contact_info?: {
    email?: string;
    phone?: string;
  };
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface PublisherChannel {
  id: string;
  publisher_id: string;
  platform: string;
  channel_url: string;
  channel_name?: string;
  status: string;
  subscriber_count?: number;
  content_count?: number;
  last_scan_date?: string;
  created_at: string;
  updated_at: string;
}

export interface PublisherFilterParams {
  status?: string;
  organizationId?: string;
}

// API service for publisher operations
export const publisherService = {
  /**
   * Get all publishers with optional filtering
   * @param params Optional filter parameters
   * @returns Promise with publishers list
   */
  getPublishers: (params?: PublisherFilterParams) => {
    return apiClient.get<Publisher[]>(ENDPOINTS.PUBLISHERS, { params });
  },

  /**
   * Get a specific publisher by ID
   * @param id The publisher ID
   * @returns Promise with publisher details
   */
  getPublisher: (id: string) => {
    return apiClient.get<Publisher>(ENDPOINTS.PUBLISHER_BY_ID(id));
  },
  
  /**
   * Create a new publisher
   * @param data The publisher data
   * @returns Promise with the created publisher
   */
  createPublisher: (data: Omit<Publisher, 'id' | 'created_at' | 'updated_at'>) => {
    return apiClient.post<Publisher>(ENDPOINTS.PUBLISHERS, data);
  },
  
  /**
   * Update a publisher
   * @param id The publisher ID
   * @param data The update data
   * @returns Promise with the updated publisher
   */
  updatePublisher: (id: string, data: Partial<Publisher>) => {
    return apiClient.put<Publisher>(ENDPOINTS.PUBLISHER_BY_ID(id), data);
  },
  
  /**
   * Delete a publisher
   * @param id The publisher ID
   * @returns Promise with the delete confirmation
   */
  deletePublisher: (id: string) => {
    return apiClient.delete(ENDPOINTS.PUBLISHER_BY_ID(id));
  },
  
  /**
   * Get all channels for a specific publisher
   * @param publisherId The publisher ID
   * @returns Promise with channels list
   */
  getPublisherChannels: (publisherId: string) => {
    return apiClient.get<PublisherChannel[]>(`${ENDPOINTS.PUBLISHER_BY_ID(publisherId)}/channels`);
  },
  
  /**
   * Create a new channel for a publisher
   * @param publisherId The publisher ID
   * @param data The channel data
   * @returns Promise with the created channel
   */
  createPublisherChannel: (
    publisherId: string, 
    data: Omit<PublisherChannel, 'id' | 'publisher_id' | 'created_at' | 'updated_at'>
  ) => {
    return apiClient.post<PublisherChannel>(`${ENDPOINTS.PUBLISHER_BY_ID(publisherId)}/channels`, data);
  },
  
  /**
   * Update a publisher channel
   * @param publisherId The publisher ID
   * @param channelId The channel ID
   * @param data The update data
   * @returns Promise with the updated channel
   */
  updatePublisherChannel: (publisherId: string, channelId: string, data: Partial<PublisherChannel>) => {
    return apiClient.put<PublisherChannel>(
      `${ENDPOINTS.PUBLISHER_BY_ID(publisherId)}/channels/${channelId}`, 
      data
    );
  },
  
  /**
   * Delete a publisher channel
   * @param publisherId The publisher ID
   * @param channelId The channel ID
   * @returns Promise with the delete confirmation
   */
  deletePublisherChannel: (publisherId: string, channelId: string) => {
    return apiClient.delete(`${ENDPOINTS.PUBLISHER_BY_ID(publisherId)}/channels/${channelId}`);
  }
};

export default publisherService;
