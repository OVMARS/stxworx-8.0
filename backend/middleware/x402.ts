import type { NextFunction, Request, Response } from 'express';

export type X402Options = {
  amount?: string;
  challenge?: string;
};

export function createX402Middleware(options: X402Options = {}) {
  const challenge = options.challenge || `x402 amount=${options.amount || '100000'}`;

  return (req: Request, res: Response, next: NextFunction) => {
    const payTokenHeader = req.headers['x-pay-token'];
    const payToken = Array.isArray(payTokenHeader) ? payTokenHeader[0] : payTokenHeader;

    if (!payToken) {
      res.set('WWW-Authenticate', challenge);
      return res.status(402).json({ message: 'Payment required via x402' });
    }

    res.locals.x402Paid = true;
    res.locals.x402Token = payToken;
    next();
  };
}

export const x402Paywall = createX402Middleware();
export const x402 = x402Paywall;

export default x402Paywall;
