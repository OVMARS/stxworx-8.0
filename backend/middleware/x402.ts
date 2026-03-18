import type { NextFunction, Request, Response } from 'express';

export type X402Options = {
  required?: boolean;
  message?: string;
};

export function createX402Middleware(options: X402Options = {}) {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (options.required && !res.locals.x402Paid) {
      return res.status(402).json({ message: options.message || 'Payment required' });
    }

    next();
  };
}

export const x402 = createX402Middleware();

export default x402;
