import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config.js';
import { authMiddleware, DEMO_PROFILES } from './auth.js';
import { generateAuthChallenge, verifyStellarSignature, getAccountBalances } from './stellar.js';
import { campaignsRouter } from './routes/campaigns.js';
import { organisationsRouter } from './routes/organisations.js';
import { beneficiariesRouter } from './routes/beneficiaries.js';
import { vouchersRouter } from './routes/vouchers.js';
import { merchantsRouter } from './routes/merchants.js';
import { auditsRouter } from './routes/audits.js';
import { notificationsRouter } from './routes/notifications.js';

export const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());
app.use(authMiddleware);

// Health check endpoint
app.get('/api/health', async (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    product: 'RELIEFRAIL - Programmable Humanitarian Aid Infrastructure',
    stellar: {
      network: config.stellar.network,
      rpcUrl: config.stellar.rpcUrl,
      horizonUrl: config.stellar.horizonUrl,
      contractId: config.stellar.contractId,
      usdcContractId: config.stellar.usdcContractId,
    },
    timestamp: new Date().toISOString(),
  });
});

// Authentication & Wallet helpers
app.get('/api/auth/challenge', (req: Request, res: Response) => {
  const wallet = req.query.wallet as string;
  if (!wallet) {
    return res.status(400).json({ error: 'Wallet query parameter required' });
  }
  const challengeData = generateAuthChallenge(wallet);
  res.json({ success: true, ...challengeData });
});

app.post('/api/auth/verify', (req: Request, res: Response) => {
  const { wallet, message, signature } = req.body;
  if (!wallet || !message || !signature) {
    return res.status(400).json({ error: 'wallet, message, and signature are required' });
  }

  const isValid = verifyStellarSignature(wallet, message, signature);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid Stellar cryptographic signature' });
  }

  res.json({
    success: true,
    wallet,
    role: 'user',
  });
});

app.get('/api/auth/demo-profiles', (_req: Request, res: Response) => {
  res.json({
    success: true,
    profiles: DEMO_PROFILES,
  });
});

app.get('/api/auth/balances', async (req: Request, res: Response) => {
  const wallet = (req.query.wallet as string) || req.user?.wallet;
  if (!wallet) {
    return res.status(400).json({ error: 'Wallet address required' });
  }

  const balances = await getAccountBalances(wallet);
  res.json({
    success: true,
    wallet,
    balances,
  });
});

// Mount modular subrouters
app.use('/api/campaigns', campaignsRouter);
app.use('/api/organisations', organisationsRouter);
app.use('/api/beneficiaries', beneficiariesRouter);
app.use('/api/vouchers', vouchersRouter);
app.use('/api/merchants', merchantsRouter);
app.use('/api/audits', auditsRouter);
app.use('/api/notifications', notificationsRouter);

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled API Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});
