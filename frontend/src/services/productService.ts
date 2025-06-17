import apiClient from './api/client';
import ENDPOINTS from './api/endpoints';

// TypeScript interfaces
export interface Product {
  id: string;
  name: string;
  advertiser_id?: string;
  status?: string;
  description?: string;
  code?: string;
  category?: string;
  compliance_level?: string;
  // Add potentially missing fields based on usage elsewhere
  marketing_bullets?: string | null; // Stored as JSON string
  fee?: string | number | null; // Could be string or number from DB
  primary_issuer?: string | null; // Add this too as it's used
  ruleIds?: string[]; // For sending to backend
  ruleSetIds?: string[]; // For sending to backend
  created_at: string;
  updated_at: string;
}

export interface ProductFilterParams {
  status?: string;
  advertiserId?: string;
  category?: string;
  complianceLevel?: string;
}

// API service for product operations
export const productService = {
  /**
   * Get all products with optional filtering
   * @param params Optional filter parameters
   * @returns Promise with products list
   */
  getProducts: (params?: ProductFilterParams) => {
    return apiClient.get<Product[]>(ENDPOINTS.PRODUCTS, { params });
  },

  /**
   * Get a specific product by ID
   * @param id The product ID
   * @returns Promise with product details
   */
  getProduct: (id: string) => {
    return apiClient.get<Product>(ENDPOINTS.PRODUCT_BY_ID(id));
  },
  
  /**
   * Create a new product
   * @param data The product data, can include ruleIds and ruleSetIds
   * @returns Promise with the created product
   */
  createProduct: (data: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'ruleIds' | 'ruleSetIds'> & { ruleIds?: string[], ruleSetIds?: string[] }) => {
    console.log('[productService] createProduct data:', JSON.stringify(data, null, 2));
    try {
      const response = apiClient.post<Product>(ENDPOINTS.PRODUCTS, data);
      console.log('[productService] createProduct API call made. Response promise:', response);
      response.then(res => {
        console.log('[productService] createProduct success response:', res);
      }).catch(err => {
        console.error('[productService] createProduct error response:', err.response ? err.response.data : err.message, err.toJSON ? err.toJSON() : err);
      });
      return response;
    } catch (error: any) {
      console.error('[productService] createProduct synchronous error:', error, error.stack);
      throw error;
    }
  },
  
  /**
   * Update a product
   * @param id The product ID
   * @param data The update data
   * @returns Promise with the updated product
   */
  updateProduct: (id: string, data: Partial<Product>) => {
    return apiClient.put<Product>(ENDPOINTS.PRODUCT_BY_ID(id), data);
  },
  
  /**
   * Delete a product
   * @param id The product ID
   * @returns Promise with the delete confirmation
   */
  deleteProduct: (id: string) => {
    return apiClient.delete(ENDPOINTS.PRODUCT_BY_ID(id));
  },
  
  /**
   * Get rule sets assigned to a product
   * @param productId The product ID
   * @returns Promise with rule sets list
   */
  getProductRuleSets: (productId: string) => {
    return apiClient.get(`${ENDPOINTS.PRODUCT_BY_ID(productId)}/rule-sets`);
  },
  
  /**
   * Assign a rule set to a product
   * @param productId The product ID
   * @param ruleSetId The rule set ID
   * @returns Promise with the assignment confirmation
   */
  assignRuleSetToProduct: (productId: string, ruleSetId: string) => {
    return apiClient.post(`${ENDPOINTS.PRODUCT_BY_ID(productId)}/rule-sets/${ruleSetId}`);
  },
  
  /**
   * Remove a rule set from a product
   * @param productId The product ID
   * @param ruleSetId The rule set ID
   * @returns Promise with the removal confirmation
   */
  removeRuleSetFromProduct: (productId: string, ruleSetId: string) => {
    return apiClient.delete(`${ENDPOINTS.PRODUCT_BY_ID(productId)}/rule-sets/${ruleSetId}`);
  },
  
  /**
   * Get product-specific rules
   * @param productId The product ID
   * @returns Promise with rules list
   */
  getProductRules: (productId: string) => {
    return apiClient.get(`${ENDPOINTS.PRODUCT_BY_ID(productId)}/rules`);
  },
  
  /**
   * Get scan jobs for a product
   * @param productId The product ID
   * @returns Promise with scan jobs list
   */
  getProductScanJobs: (productId: string) => {
    return apiClient.get(`${ENDPOINTS.PRODUCT_BY_ID(productId)}/scan-jobs`);
  },
  
  /**
   * Get flags for a product
   * @param productId The product ID
   * @param params Optional filter parameters
   * @returns Promise with flags list
   */
  getProductFlags: (productId: string, params?: { status?: string; dateFrom?: string; dateTo?: string }) => {
    return apiClient.get(`${ENDPOINTS.PRODUCT_BY_ID(productId)}/flags`, { params });
  }
};

export default productService;
