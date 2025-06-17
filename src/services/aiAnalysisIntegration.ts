/**
 * AI Analysis Integration
 * 
 * This file serves as an integration point between the original sequential analysis
 * implementation and the new parallelized implementation. It provides an easy way
 * to switch between the two implementations with a simple configuration.
 */

import * as Sequential from './aiAnalysisService';
import * as Parallel from './aiAnalysisServiceParallel';
import { aiThrottler } from '../utils/aiThrottler';

// Configuration settings
export interface ParallelizationConfig {
  // Whether to use the parallelized implementation (true) or the sequential one (false)
  useParallelAnalysis: boolean;
  
  // Maximum number of concurrent AI requests (only applies when useParallelAnalysis is true)
  maxConcurrentRequests: number;
}

// Default configuration
const DEFAULT_CONFIG: ParallelizationConfig = {
  useParallelAnalysis: true,
  maxConcurrentRequests: 8
};

// Current configuration (can be updated at runtime)
let currentConfig: ParallelizationConfig = { ...DEFAULT_CONFIG };

/**
 * Updates the parallelization configuration
 * @param config The new configuration options
 */
export function updateConfig(config: Partial<ParallelizationConfig>): void {
  currentConfig = { ...currentConfig, ...config };
  
  // Apply throttler settings if using parallelized version
  if (currentConfig.useParallelAnalysis) {
    aiThrottler.setMaxConcurrent(currentConfig.maxConcurrentRequests);
  }
  
  console.log(`AI Analysis configuration updated:`, currentConfig);
}

/**
 * Initialize the AI analysis system with the given configuration
 * @param config Optional configuration to use
 */
export function initialize(config?: Partial<ParallelizationConfig>): void {
  if (config) {
    updateConfig(config);
  } else {
    // Apply default throttler settings
    aiThrottler.setMaxConcurrent(currentConfig.maxConcurrentRequests);
  }
  
  console.log(`AI Analysis system initialized with ${currentConfig.useParallelAnalysis ? 'PARALLEL' : 'SEQUENTIAL'} processing`);
  if (currentConfig.useParallelAnalysis) {
    console.log(`Maximum concurrent requests: ${currentConfig.maxConcurrentRequests}`);
  }
}

/**
 * Analyzes a specific content item against applicable rules.
 * Routes to either the sequential or parallel implementation based on configuration.
 * @param contentItemId The ID of the content item to analyze
 */
export async function analyzeContentItemForFlags(
    contentItemId: string,
    scanJobId: string = '',
    productIds: string[] = [],
    options: object = {}
): Promise<void> {
    if (currentConfig.useParallelAnalysis) {
        await Parallel.analyzeContentItemForFlags(contentItemId, scanJobId, productIds, options);
    } else {
        await Sequential.analyzeContentItemForFlags(contentItemId, scanJobId, productIds, options);
    }
}

// Re-export other functions from both implementations
// This allows using specific functions from either implementation if needed
export const Sequential_Functions = Sequential;
export const Parallel_Functions = Parallel;

// Initialize with default configuration
initialize();
