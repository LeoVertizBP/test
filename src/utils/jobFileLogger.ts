import fs from 'fs';
import path from 'path';

// Defines the structure of the logger object
interface JobLogger {
  info: (message: string, data?: Record<string, any>) => void;
  warn: (message: string, data?: Record<string, any>) => void;
  error: (message: string, error?: Error | any, data?: Record<string, any>) => void;
}

/**
 * Creates a logger instance that writes to a job-specific file.
 * @param jobId The unique ID of the scan job.
 *   This will be used to name the log file (e.g., scan_job_XYZ.log).
 * @param logDir The directory where log files will be stored, relative to the project root.
 *   Defaults to 'job_logs'.
 * @returns A JobLogger object with info, warn, and error methods.
 */
export const createJobLogger = (jobId: string, logDir: string = 'job_logs'): JobLogger => {
  const resolvedLogDir = path.join(process.cwd(), logDir);
  const logFilePath = path.join(resolvedLogDir, `scan_job_${jobId}.log`);

  // Ensure the log directory exists
  try {
    if (!fs.existsSync(resolvedLogDir)) {
      fs.mkdirSync(resolvedLogDir, { recursive: true });
    }
  } catch (e: any) {
    // Fallback to console if directory creation fails
    console.error(`[JobFileLogger] Failed to create log directory ${resolvedLogDir}: ${e.message}. Falling back to console for job ${jobId}.`);
    return {
      info: (message, data) => console.info(`[Job ${jobId}] INFO: ${message}`, data || ''),
      warn: (message, data) => console.warn(`[Job ${jobId}] WARN: ${message}`, data || ''),
      error: (message, err, data) => console.error(`[Job ${jobId}] ERROR: ${message}`, err || '', data || ''),
    };
  }

  const logToFile = (level: string, message: string, details?: any) => {
    const timestamp = new Date().toISOString();
    let logMessage = `${timestamp} [${level.toUpperCase()}] ${message}`;
    
    if (details) {
      if (details instanceof Error) {
        logMessage += `\nError: ${details.message}\nStack: ${details.stack}`;
      } else if (typeof details === 'object') {
        try {
          logMessage += `\nDetails: ${JSON.stringify(details, null, 2)}`;
        } catch (e) {
          logMessage += `\nDetails: (Unserializable object)`;
        }
      } else {
        logMessage += `\nDetails: ${String(details)}`;
      }
    }
    logMessage += '\n';

    try {
      fs.appendFileSync(logFilePath, logMessage, 'utf8');
    } catch (e: any) {
      // Fallback to console if file write fails
      console.error(`[JobFileLogger] Failed to write to log file ${logFilePath}: ${e.message}. Original message for job ${jobId}: [${level.toUpperCase()}] ${message}`);
      if (details) console.error(`[JobFileLogger] Original details:`, details);
    }
  };

  return {
    info: (message, data) => {
      logToFile('info', message, data);
    },
    warn: (message, data) => {
      logToFile('warn', message, data);
    },
    error: (message, errorDetails, data) => {
      // Combine errorDetails and data if both are provided
      const combinedDetails = {
        ...(errorDetails instanceof Error ? { error: { message: errorDetails.message, stack: errorDetails.stack } } : errorDetails ? { errorDetails } : {}),
        ...(data ? { data } : {}),
      };
      logToFile('error', message, Object.keys(combinedDetails).length > 0 ? combinedDetails : undefined);
    }
  };
};

export default createJobLogger;
