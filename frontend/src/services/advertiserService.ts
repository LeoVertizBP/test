import apiClient from './api/client';
import ENDPOINTS from './api/endpoints';

// TypeScript interfaces
export interface Advertiser {
  id: string;
  name: string;
  organization_id?: string;
  status?: string;
  website?: string;
  contact_name?: string;
  contact_email?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface AdvertiserFilterParams {
  status?: string;
  organizationId?: string;
}

// API service for advertiser operations
export const advertiserService = {
  /**
   * Get all advertisers with optional filtering
   * @param params Optional filter parameters
   * @returns Promise with advertisers list
   */
  getAdvertisers: (params?: AdvertiserFilterParams) => {
    return apiClient.get<Advertiser[]>(ENDPOINTS.ADVERTISERS, { params });
  },

  /**
   * Get a specific advertiser by ID
   * @param id The advertiser ID
   * @returns Promise with advertiser details
   */
  getAdvertiser: (id: string) => {
    return apiClient.get<Advertiser>(ENDPOINTS.ADVERTISER_BY_ID(id));
  },
  
  /**
   * Create a new advertiser
   * @param data The advertiser data
   * @returns Promise with the created advertiser
   */
  createAdvertiser: (data: Omit<Advertiser, 'id' | 'created_at' | 'updated_at'>) => {
    return apiClient.post<Advertiser>(ENDPOINTS.ADVERTISERS, data);
  },
  
  /**
   * Update an advertiser
   * @param id The advertiser ID
   * @param data The update data
   * @returns Promise with the updated advertiser
   */
  updateAdvertiser: (id: string, data: Partial<Advertiser>) => {
    return apiClient.put<Advertiser>(ENDPOINTS.ADVERTISER_BY_ID(id), data);
  },
  
  /**
   * Delete an advertiser
   * @param id The advertiser ID
   * @returns Promise with the delete confirmation
   */
  deleteAdvertiser: (id: string) => {
    return apiClient.delete(ENDPOINTS.ADVERTISER_BY_ID(id));
  },
  
  /**
   * Get products associated with an advertiser
   * @param advertiserId The advertiser ID
   * @returns Promise with products list
   */
  getAdvertiserProducts: (advertiserId: string) => {
    return apiClient.get(`${ENDPOINTS.ADVERTISER_BY_ID(advertiserId)}/products`);
  },
  
  /**
   * Get rules associated with an advertiser
   * @param advertiserId The advertiser ID
   * @returns Promise with rules list
   */
  getAdvertiserRules: (advertiserId: string) => {
    return apiClient.get(`${ENDPOINTS.ADVERTISER_BY_ID(advertiserId)}/rules`);
  }
};

export default advertiserService;
