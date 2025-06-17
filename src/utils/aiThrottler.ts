/**
 * AIThrottler - A service for managing concurrent API calls to AI services
 * 
 * This utility helps prevent rate limits by controlling how many concurrent
 * requests can be made, queueing excess requests, and implementing exponential
 * backoff for failed requests.
 */

import { debug, info, warn, error } from './logUtil';

interface QueuedRequest {
  execute: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  priority: number;  // Lower numbers = higher priority
  attemptCount: number;
}

export class AIThrottler {
  private static instance: AIThrottler;
  private activeRequests: number = 0;
  private requestQueue: QueuedRequest[] = [];
  private maxConcurrent: number = 10;  // Set to optimal value based on testing (8-10 seems to be the sweet spot)
  private isProcessingQueue: boolean = false;
  private lastRateLimitError: number = 0;
  private recentErrors: { timestamp: number; isRateLimit: boolean }[] = [];

  // Singleton pattern
  private constructor() {}

  public static getInstance(): AIThrottler {
    if (!AIThrottler.instance) {
      AIThrottler.instance = new AIThrottler();
    }
    return AIThrottler.instance;
  }

  /**
   * Run a function with throttling to prevent rate limit errors
   * 
   * @param fn The async function to execute
   * @param priority Lower numbers = higher priority (default 10)
   * @param tag A tag for logging/debugging
   * @returns The result of the function
   */
  public async runWithThrottling<T>(
    fn: () => Promise<T>, 
    options: { 
      priority?: number,
      tag?: string, 
      maxRetries?: number 
    } = {}
  ): Promise<T> {
    const { 
      priority = 10, 
      tag = 'unspecified',
      maxRetries = 3 
    } = options;
    
    // If we've had recent rate limit errors, add a small delay
    if (Date.now() - this.lastRateLimitError < 60000) {
      const rateLimitCount = this.countRecentRateLimits();
      if (rateLimitCount > 0) {
        // Dynamically adjust max concurrent based on recent errors
        this.adjustMaxConcurrent(rateLimitCount);
      }
    }
    
    // Clean up old error records
    this.cleanupRecentErrors();
    
    return new Promise<T>((resolve, reject) => {
      // Create a wrapper that will execute the function with retries and backoff
      const executeWithRetries = async (attemptCount: number = 0): Promise<T> => {
        try {
          const result = await fn();
          debug('AIThrottler', `Request successful (${tag})`);
          return result;
        } catch (err: any) {
          // Add to recent errors list
          this.recentErrors.push({
            timestamp: Date.now(),
            isRateLimit: this.isRateLimitError(err)
          });
          
          const isRateLimit = this.isRateLimitError(err);
          if (isRateLimit) {
            this.lastRateLimitError = Date.now();
            warn('AIThrottler', `Rate limit error detected (${tag})`);
          }
          
          if (isRateLimit && attemptCount < maxRetries) {
            const nextAttempt = attemptCount + 1;
            const delay = Math.min(30000, Math.pow(2, nextAttempt) * 1000); // exponential backoff capped at 30 sec
            
            warn('AIThrottler', 
              `Retrying after rate limit error (attempt ${nextAttempt}/${maxRetries}) with ${delay}ms delay (${tag})`);
            
            // Wait for the backoff period
            await new Promise(r => setTimeout(r, delay));
            
            // Retry with incremented attempt count and reduced priority (to avoid blocking fresh requests)
            return this.runWithThrottling(() => fn(), { 
              priority: priority + 5, 
              tag,
              maxRetries
            });
          }
          
          // Either not a rate limit error or max retries exceeded
          throw err;
        }
      };
      
      // Add the request to the queue
      this.requestQueue.push({
        execute: () => executeWithRetries(),
        resolve,
        reject,
        priority,
        attemptCount: 0
      });
      
      // Sort the queue by priority (lowest numbers first)
      this.requestQueue.sort((a, b) => a.priority - b.priority);
      
      // Process the queue (if not already processing)
      if (!this.isProcessingQueue) {
        this.processQueue();
      }
    });
  }
  
  /**
   * Process the queue of pending requests
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;

    this.isProcessingQueue = true;

    // Keep processing as long as there are items in the queue
    while (this.requestQueue.length > 0) {
      // Check if we can start more requests
      if (this.activeRequests < this.maxConcurrent) {
        // Get the next request (already sorted by priority)
        const request = this.requestQueue.shift();
        if (!request) continue; // Should not happen if length > 0, but safety check

        // Increment active count *before* starting the async operation
        this.activeRequests++;

        // Start the execution but don't await it here
        request.execute()
          .then(result => {
            request.resolve(result);
          })
          .catch(err => {
            request.reject(err);
          })
          .finally(() => {
            // Decrement active count *after* the promise settles (success or failure)
            this.activeRequests--;
            // Trigger processing again in case the queue wasn't empty but we were at the limit
            // Use setImmediate to avoid deep recursion and allow I/O to proceed
            setImmediate(() => this.processQueue());
          });

        // Loop immediately to see if we can start another request
        continue; // Go back to the start of the while loop

      } else {
        // If we are at the concurrency limit, wait a short time before checking again
        await new Promise(resolve => setTimeout(resolve, 50)); // Wait 50ms
      }
    }

    // Queue is empty, stop processing for now
    this.isProcessingQueue = false;
    debug('AIThrottler', 'Request queue empty, pausing processing.');
  }

  /**
   * Adjust the maximum concurrent requests based on observed rate limits
   */
  private adjustMaxConcurrent(recentRateLimits: number): void {
    // If we've seen rate limit errors recently, reduce concurrency
    if (recentRateLimits > 0) {
      const reduceBy = Math.min(this.maxConcurrent - 1, Math.ceil(recentRateLimits / 2));
      const newMax = Math.max(1, this.maxConcurrent - reduceBy);
      
      if (newMax < this.maxConcurrent) {
        this.maxConcurrent = newMax;
        warn('AIThrottler', `Reduced max concurrent requests to ${this.maxConcurrent} due to rate limits`);
      }
    } 
    // If we haven't seen any rate limits in a while, cautiously increase
    else if (Date.now() - this.lastRateLimitError > 300000) { // 5 minutes
      const newMax = Math.min(30, this.maxConcurrent + 1); // Increased max auto-scaling limit
      if (newMax > this.maxConcurrent) {
        this.maxConcurrent = newMax;
        info('AIThrottler', `Increased max concurrent requests to ${this.maxConcurrent}`);
      }
    }
  }
  
  /**
   * Remove error records older than 5 minutes
   */
  private cleanupRecentErrors(): void {
    const fiveMinutesAgo = Date.now() - 300000;
    this.recentErrors = this.recentErrors.filter(e => e.timestamp > fiveMinutesAgo);
  }
  
  /**
   * Count how many rate limit errors we've seen in the last minute
   */
  private countRecentRateLimits(): number {
    const oneMinuteAgo = Date.now() - 60000;
    return this.recentErrors.filter(e => e.isRateLimit && e.timestamp > oneMinuteAgo).length;
  }
  
  /**
   * Check if an error is a rate limit error
   * This might need customization based on the exact error format from your AI provider
   */
  private isRateLimitError(err: any): boolean {
    // Check for common rate limit status codes
    if (err.status === 429 || err.statusCode === 429) {
      return true;
    }
    
    // Check for common rate limit error messages
    const errorMsg = err.message || err.toString();
    return /rate limit|too many requests|quota exceeded|resource exhausted/i.test(errorMsg);
  }
  
  /**
   * Get the current concurrency settings
   */
  public getStatus(): { activeRequests: number; queuedRequests: number; maxConcurrent: number } {
    return {
      activeRequests: this.activeRequests,
      queuedRequests: this.requestQueue.length,
      maxConcurrent: this.maxConcurrent
    };
  }
  
  /**
   * Manually set the maximum concurrent requests
   */
  public setMaxConcurrent(max: number): void {
    if (max < 1) {
      throw new Error('Maximum concurrent requests must be at least 1');
    }
    this.maxConcurrent = max;
    info('AIThrottler', `Max concurrent requests manually set to ${max}`);
  }
}

// Export a singleton instance for use throughout the application
export const aiThrottler = AIThrottler.getInstance();
