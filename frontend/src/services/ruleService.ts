import apiClient from './api/client';
import ENDPOINTS from './api/endpoints';

/**
 * Interface for the detailed product rule object expected from the API.
 */
export interface ProductRuleDetail {
  id: string;
  name: string; // The name/title of the rule
  description: string; // General description of the rule
  manual_text: string | null; // The specific manual/guidance text for the rule
  rule_type: string;
  version: string;
  // Add any other fields that might be returned and useful
}

/**
 * Interface for a RuleSet object.
 */
export interface RuleSet {
  id: string;
  name: string;
  description?: string;
  // Add other relevant fields
}

/**
 * Interface for a ChannelRule object.
 */
export interface ChannelRule {
  id: string;
  name: string;
  description: string;
  rule_type: string;
  version: string;
  // Add other relevant fields
}

/**
 * API service for rule operations.
 */
export const ruleService = {
  /**
   * Get a specific product rule by its ID.
   * @param ruleId The ID of the product rule.
   * @returns Promise with product rule details.
   */
  getProductRule: (ruleId: string) => {
    // Assuming the endpoint for a single product rule is /product-rules/:id
    // ENDPOINTS.PRODUCT_RULES is '/product-rules'
    return apiClient.get<ProductRuleDetail>(`${ENDPOINTS.PRODUCT_RULES}/${ruleId}`);
  },

  /**
   * Get all rule sets.
   * @returns Promise with rule sets list.
   */
  getRuleSets: () => {
    return apiClient.get<RuleSet[]>(ENDPOINTS.RULE_SETS);
  },

  /**
   * Get all product rules.
   * @returns Promise with product rules list.
   */
  getProductRules: () => {
    return apiClient.get<ProductRuleDetail[]>(ENDPOINTS.PRODUCT_RULES);
  },

  /**
   * Get all channel rules.
   * @returns Promise with channel rules list.
   */
  getChannelRules: () => {
    return apiClient.get<ChannelRule[]>(ENDPOINTS.CHANNEL_RULES);
  },

  // Potentially add other rule-related service functions here in the future
};

export default ruleService;
