import apiClient from './api/client';
import ENDPOINTS from './api/endpoints';

// TypeScript interfaces
export interface Channel {
  id: string;
  platform: string;
  url: string;
}

export interface ScanJobPayload {
  publisherChannelId: string;
  jobName?: string;
  jobDescription?: string;
}

// Payload for the new multi-target scan endpoint
export interface MultiTargetScanJobPayload {
  publisherIds: string[];
  platformTypes: string[];
  productIds?: string[]; // Optional
  jobName?: string;
  jobDescription?: string;
}

export interface ScanJob {
  id: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
  publisher_id?: string;
  publisher_name?: string;
  items_count?: number;
  total_flags?: number;
  pending_flags?: number;
  closed_flags?: number;
  progress?: number;
  assignee?: string;
  assignee_name?: string;
  platform?: string;
}

// API service for scan job operations
export const scanJobService = {
  /**
   * Start a new channel scan
   * @param payload The scan job configuration
   * @returns Promise with the created scan job
   */
  startScan: (payload: ScanJobPayload) => {
    return apiClient.post<ScanJob>(ENDPOINTS.START_SCAN, payload);
  },

  /**
   * Start a new multi-target scan (multiple publishers, platforms, products)
   * @param payload The multi-target scan job configuration
   * @returns Promise with the created scan job
   */
  startMultiTargetScan: (payload: MultiTargetScanJobPayload) => {
    // Use the new endpoint defined in endpoints.ts
    return apiClient.post<ScanJob>(ENDPOINTS.START_MULTI_TARGET_SCAN, payload);
  },

  /**
   * Get all scan jobs
   * @param params Optional query parameters including activeFlagsOnly
   * @returns Promise with scan jobs list
   */
  getScanJobs: (params?: { status?: string; publisherId?: string; limit?: number; offset?: number; activeFlagsOnly?: boolean }) => {
    console.log('getScanJobs called with params:', params);

    // Create fallback data for emergencies
    const createFallbackData = (): ScanJob[] => {
      console.log('Creating fallback scan job data');
      return [
        {
          id: 'fallback-job-1',
          name: 'Fallback Job 1 (API Error)',
          status: 'COMPLETED',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'fallback-job-2',
          name: 'Fallback Job 2 (API Error)',
          status: 'COMPLETED',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];
    };
    
    // Create a Promise with timeout
    const timeoutPromise = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
      let timeoutHandle: NodeJS.Timeout;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      });
      
      return Promise.race([
        promise,
        timeoutPromise
      ]).finally(() => {
        clearTimeout(timeoutHandle);
      }) as Promise<T>;
    };
    
    // Try to get data from cache first for non-filtered requests
    try {
      if (!params || (Object.keys(params).length === 0 || (params.limit === 50 && params.offset === 0 && !params.status && !params.publisherId))) {
        // Check localStorage cache first
        const cacheKey = 'scanJobs_cache';
        const cachedData = localStorage.getItem(cacheKey);
        const cacheTime = localStorage.getItem(cacheKey + '_time');
        
        // Use cache if it exists and is less than 5 minutes old
        if (cachedData && cacheTime) {
          try {
            const cachedTimeMs = parseInt(cacheTime, 10);
            const now = Date.now();
            // Cache valid for 5 minutes
            if (now - cachedTimeMs < 5 * 60 * 1000) {
              console.log('Using cached scan jobs data');
              const data = JSON.parse(cachedData);
              
              // Verify data is valid and an array
              if (Array.isArray(data) && data.length > 0) {
                // Return fake promise that resolves with cached data
                return {
                  then: (callback: (result: { data: ScanJob[] }) => any) => {
                    return callback({ data });
                  },
                  catch: (callback: (error: any) => any) => {
                    return { then: (cb: any) => cb() }; // Empty catch chain
                  }
                } as any;
              } else {
                console.warn('Invalid cached data format, will fetch fresh data');
              }
            }
          } catch (cacheError) {
            console.error('Error processing cache:', cacheError);
            // Continue to API call if cache processing fails
          }
        }
      }
    } catch (outerCacheError) {
      console.error('Unexpected error in cache handling:', outerCacheError);
      // Continue to API call if there's an error in cache handling
    }
    
    // Add default pagination if not specified
    const requestParams = { ...params };
    if (!requestParams.limit) {
      requestParams.limit = 20; // Increased limit to show more scan jobs
    }
    
    // Make the actual API call with timeout
    console.log('Making API call to get scan jobs with params:', requestParams);
    return timeoutPromise(apiClient.get<ScanJob[]>(ENDPOINTS.SCAN_JOBS, { params: requestParams }), 10000) // 10 second timeout
      .then(response => {
        console.log(`API returned ${response.data?.length || 0} scan jobs`);
        
        // Validate response data
        if (!response.data || !Array.isArray(response.data)) {
          console.error('Invalid API response format:', response);
          throw new Error('Invalid scan jobs response format');
        }
        
        // Cache the response if it's a default request
        if (!params || (params.limit === 50 && params.offset === 0 && !params.status && !params.publisherId)) {
          try {
            localStorage.setItem('scanJobs_cache', JSON.stringify(response.data));
            localStorage.setItem('scanJobs_cache_time', Date.now().toString());
            console.log('Cached scan jobs data');
          } catch (e) {
            console.warn('Failed to cache scan jobs data', e);
          }
        }
        return response;
      })
      .catch(error => {
        console.error('Error fetching scan jobs:', error);
        
        // Try to get data from cache as fallback, even if it's expired
        try {
          const cacheKey = 'scanJobs_cache';
          const cachedData = localStorage.getItem(cacheKey);
          
          if (cachedData) {
            console.log('Using expired cache as fallback after API error');
            const data = JSON.parse(cachedData);
            if (Array.isArray(data) && data.length > 0) {
              return { data };
            }
          }
        } catch (fallbackError) {
          console.error('Error using cached fallback:', fallbackError);
        }
        
        // If all else fails, return emergency fallback data
        console.log('Using emergency fallback scan job data');
        return { data: createFallbackData() };
      });
  },

  /**
   * Get a specific scan job by ID
   * @param id The scan job ID
   * @returns Promise with scan job details
   */
  getScanJob: (id: string) => {
    return apiClient.get<ScanJob>(ENDPOINTS.SCAN_JOB_BY_ID(id));
  },
  
  /**
   * Update a scan job
   * @param id The scan job ID
   * @param data The update data
   * @returns Promise with the updated scan job
   */
  updateScanJob: (id: string, data: Partial<ScanJob>) => {
    return apiClient.put<ScanJob>(ENDPOINTS.SCAN_JOB_BY_ID(id), data);
  },
  
  /**
   * Cancel a running scan job
   * @param id The scan job ID
   * @returns Promise with the updated scan job
   */
  cancelScanJob: (id: string) => {
    return apiClient.post<ScanJob>(`${ENDPOINTS.SCAN_JOB_BY_ID(id)}/cancel`);
  },

  /**
   * Assign a user to a scan job
   * @param id The scan job ID
   * @param assigneeId The ID of the user to assign
   * @returns Promise with the updated scan job
   */
  assignUserToScanJob: (id: string, assigneeId: string) => {
    console.log(`scanJobService: assignUserToScanJob called with id=${id}, assigneeId=${assigneeId}`);
    const endpoint = `${ENDPOINTS.SCAN_JOB_BY_ID(id)}/assign`;
    console.log(`scanJobService: Making API call to ${endpoint} with payload:`, { assigneeId });
    
    // Clear any cached scan jobs to ensure we get fresh data on next fetch
    try {
      localStorage.removeItem('scanJobs_cache');
      localStorage.removeItem('scanJobs_cache_time');
      console.log('scanJobService: Cleared scan jobs cache to ensure fresh data');
    } catch (e) {
      console.warn('scanJobService: Failed to clear cache', e);
    }
    
    return apiClient.put<ScanJob>(endpoint, { assigneeId })
      .then(response => {
        console.log(`scanJobService: assignUserToScanJob API response:`, response);
        
        // Validate the response contains the expected data
        if (response.data) {
          console.log(`scanJobService: Received updated scan job with assignee:`, {
            id: response.data.id,
            assignee: response.data.assignee,
            assignee_name: response.data.assignee_name
          });
          
          if (!response.data.assignee) {
            console.warn(`scanJobService: API response missing assignee field despite successful call`);
          }
        } else {
          console.warn(`scanJobService: API response missing data object`);
        }
        
        return response;
      })
      .catch(error => {
        console.error(`scanJobService: Error in assignUserToScanJob:`, error);
        console.error(`scanJobService: Error details:`, {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        throw error;
      });
  },

  /**
   * Unassign a user from a scan job
   * @param id The scan job ID
   * @returns Promise with the updated scan job
   */
  unassignUserFromScanJob: (id: string) => {
    console.log(`scanJobService: unassignUserFromScanJob called with id=${id}`);
    const endpoint = `${ENDPOINTS.SCAN_JOB_BY_ID(id)}/unassign`;
    console.log(`scanJobService: Making API call to ${endpoint}`);
    
    // Clear any cached scan jobs to ensure we get fresh data on next fetch
    try {
      localStorage.removeItem('scanJobs_cache');
      localStorage.removeItem('scanJobs_cache_time');
      console.log('scanJobService: Cleared scan jobs cache to ensure fresh data');
    } catch (e) {
      console.warn('scanJobService: Failed to clear cache', e);
    }
    
    return apiClient.put<ScanJob>(endpoint)
      .then(response => {
        console.log(`scanJobService: unassignUserFromScanJob API response:`, response);
        
        // Validate the response contains the expected data
        if (response.data) {
          console.log(`scanJobService: Received updated scan job after unassign:`, {
            id: response.data.id,
            assignee: response.data.assignee,
            assignee_name: response.data.assignee_name
          });
          
          if (response.data.assignee) {
            console.warn(`scanJobService: API response still has assignee field despite unassign call`);
          }
        } else {
          console.warn(`scanJobService: API response missing data object`);
        }
        
        return response;
      })
      .catch(error => {
        console.error(`scanJobService: Error in unassignUserFromScanJob:`, error);
        console.error(`scanJobService: Error details:`, {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        throw error;
      });
  }
};

export default scanJobService;
