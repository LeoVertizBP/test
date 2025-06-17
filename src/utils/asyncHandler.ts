import { Request, Response, NextFunction } from 'express';

/**
 * Wraps an async Express route handler to automatically catch and forward errors to the next middleware.
 * This eliminates the need for try/catch blocks in every route handler.
 * 
 * @param fn The async route handler function to wrap
 * @returns A function that will catch any errors and pass them to next()
 */
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default asyncHandler;
