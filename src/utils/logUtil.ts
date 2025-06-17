/**
 * Centralized logging utility for consistent logging across the application
 */

// Log levels (in increasing order of severity)
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// Set the current log level based on environment
// In production, we may want to set this to INFO or higher
const currentLogLevel = process.env.NODE_ENV === 'production' 
  ? LogLevel.INFO 
  : LogLevel.DEBUG;

/**
 * Log a message with the specified level
 * @param level The log level
 * @param module The module/component name for context
 * @param message The log message
 * @param meta Optional metadata to include
 */
export function log(level: LogLevel, module: string, message: string, meta?: any): void {
  // Only log if the level is at or above the current log level
  if (level >= currentLogLevel) {
    const timestamp = new Date().toISOString();
    const levelString = LogLevel[level];
    
    // Format metadata for logging
    let metaStr = '';
    if (meta) {
      if (typeof meta === 'object') {
        try {
          // Handle circular references and other serialization issues
          const seen = new Set();
          metaStr = JSON.stringify(meta, (key, value) => {
            // Handle circular references or complex objects
            if (typeof value === 'object' && value !== null) {
              // If we've seen this object before (circular reference)
              if (seen.has(value)) {
                return '[Circular]';
              }
              seen.add(value);
            }
            
            // Truncate long strings
            if (typeof value === 'string' && value.length > 500) {
              return value.substring(0, 500) + '... [truncated]';
            }
            
            return value;
          }, 2);
        } catch (e: unknown) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          metaStr = `[Error serializing metadata: ${errorMessage}]`;
        }
      } else {
        metaStr = String(meta);
      }
    }
    
    // Use the appropriate console method based on level
    let logFn: (message: string, ...args: any[]) => void;
    switch (level) {
      case LogLevel.ERROR:
        logFn = console.error;
        break;
      case LogLevel.WARN:
        logFn = console.warn;
        break;
      case LogLevel.INFO:
        logFn = console.info;
        break;
      default:
        logFn = console.log;
    }
    
    // Log with consistent format
    if (metaStr) {
      logFn(`[${timestamp}] [${levelString}] [${module}] ${message}\n${metaStr}`);
    } else {
      logFn(`[${timestamp}] [${levelString}] [${module}] ${message}`);
    }
  }
}

// Convenience methods
export const debug = (module: string, message: string, meta?: any) => log(LogLevel.DEBUG, module, message, meta);
export const info = (module: string, message: string, meta?: any) => log(LogLevel.INFO, module, message, meta);
export const warn = (module: string, message: string, meta?: any) => log(LogLevel.WARN, module, message, meta);
export const error = (module: string, message: string, meta?: any) => log(LogLevel.ERROR, module, message, meta);

/**
 * Safely stringify an object, handling circular references and providing fallbacks
 * @param obj The object to stringify
 * @param fallback Optional fallback value if stringification fails
 * @returns A JSON string representation of the object
 */
export function safeStringify(obj: any, fallback: string = '{}'): string {
  if (!obj) return fallback;
  
  try {
    const seen = new Set();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    });
  } catch (e: unknown) {
    // If stringify failed, return the fallback
    return fallback;
  }
}
