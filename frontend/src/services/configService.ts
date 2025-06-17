'use client';

// Import the configured apiClient instead of the default axios
import apiClient from './api/client'; 

// Types for API requests and responses
export interface ChannelConfigData {
  name: string;
  sitemapUrl?: string;
  loginCredentials?: {
    username: string;
    password: string;
  } | null;
  includeDomains: string[];
  excludePatterns?: string[];
  maxPages?: number | null;
  maxDepth?: number | null;
  imageMaxBytes?: number | null;
  heroImageSelector?: string; // Optional CSS selector for hero image(s)
  articleContentSelector?: string; // Optional CSS selector for article content container
}

export interface TestCrawlResult {
  estimatedPages: number;
  estimatedImages: number;
}

/**
 * Service for interacting with the publisher channel configuration API endpoints.
 */
const configService = {
  /**
   * Get the configuration for a specific channel
   */
  getConfig: async (publisherId: string, channelId: string) => {
    // Ensure IDs are properly formatted and encoded
    const safePublisherId = encodeURIComponent(String(publisherId));
    const safeChannelId = encodeURIComponent(String(channelId));
    
    // Remove '/api' prefix as it's included in apiClient baseURL
    const url = `/publishers/${safePublisherId}/channels/${safeChannelId}/config`; 
    console.log('configService.getConfig - Making request to:', url);
    
    try {
      // Use apiClient instead of axios
      return await apiClient.get(url);
    } catch (error) {
      console.error(`Error fetching config for channel - URL: ${url}, Error:`, error);
      throw error;
    }
  },

  /**
   * Create a new configuration for a channel
   */
  createConfig: async (publisherId: string, channelId: string, configData: ChannelConfigData) => {
    // Ensure IDs are properly formatted and encoded
    const safePublisherId = encodeURIComponent(String(publisherId));
    const safeChannelId = encodeURIComponent(String(channelId));
    
    // Remove '/api' prefix as it's included in apiClient baseURL
    const url = `/publishers/${safePublisherId}/channels/${safeChannelId}/config`; 
    console.log('configService.createConfig - Making request to:', url);
    
    try {
      // Use apiClient instead of axios
      return await apiClient.post(url, configData);
    } catch (error) {
      console.error(`Error creating config for channel - URL: ${url}, Error:`, error);
      throw error;
    }
  },

  /**
   * Update an existing configuration for a channel
   */
  updateConfig: async (publisherId: string, channelId: string, configData: Partial<ChannelConfigData>) => {
    // Ensure IDs are properly formatted and encoded
    const safePublisherId = encodeURIComponent(String(publisherId));
    const safeChannelId = encodeURIComponent(String(channelId));
    
    // Remove '/api' prefix as it's included in apiClient baseURL
    const url = `/publishers/${safePublisherId}/channels/${safeChannelId}/config`; 
    console.log('configService.updateConfig - Making request to:', url);
    
    try {
      // Use apiClient instead of axios
      return await apiClient.put(url, configData);
    } catch (error) {
      console.error(`Error updating config for channel - URL: ${url}, Error:`, error);
      throw error;
    }
  },

  /**
   * Delete a channel's configuration
   */
  deleteConfig: async (publisherId: string, channelId: string) => {
    // Ensure IDs are properly formatted and encoded
    const safePublisherId = encodeURIComponent(String(publisherId));
    const safeChannelId = encodeURIComponent(String(channelId));
    
    // Remove '/api' prefix as it's included in apiClient baseURL
    const url = `/publishers/${safePublisherId}/channels/${safeChannelId}/config`; 
    console.log('configService.deleteConfig - Making request to:', url);
    
    try {
      // Use apiClient instead of axios
      return await apiClient.delete(url);
    } catch (error) {
      console.error(`Error deleting config for channel - URL: ${url}, Error:`, error);
      throw error;
    }
  },

  /**
   * Run a test crawl simulation for a channel
   */
  runTestCrawl: async (publisherId: string, channelId: string) => {
    // Ensure IDs are properly formatted and encoded
    const safePublisherId = encodeURIComponent(String(publisherId));
    const safeChannelId = encodeURIComponent(String(channelId));
    
    // Remove '/api' prefix as it's included in apiClient baseURL
    const url = `/publishers/${safePublisherId}/channels/${safeChannelId}/test-crawl`; 
    console.log('configService.runTestCrawl - Making request to:', url);
    
    try {
      // Use apiClient instead of axios
      return await apiClient.post<TestCrawlResult>(url);
    } catch (error) {
      console.error(`Error running test crawl for channel - URL: ${url}, Error:`, error);
      throw error;
    }
  },

  /**
   * Check if a configuration exists for a channel
   */
  hasConfig: async (publisherId: string, channelId: string) => {
    // Ensure IDs are properly formatted and encoded
    const safePublisherId = encodeURIComponent(String(publisherId));
    const safeChannelId = encodeURIComponent(String(channelId));
    
    // Remove '/api' prefix as it's included in apiClient baseURL
    const url = `/publishers/${safePublisherId}/channels/${safeChannelId}/config`; 
    console.log('configService.hasConfig - Making request to:', url);
    
    try {
      // Use apiClient instead of axios
      const response = await apiClient.get(url);
      return { exists: true, data: response.data };
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        return { exists: false, data: null };
      }
      console.error(`Error checking config for channel - URL: ${url}, Error:`, error);
      throw error;
    }
  }
};

export default configService;
