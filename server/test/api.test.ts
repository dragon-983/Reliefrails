import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { query } from '../src/db.js';

describe('RELIEFRAIL Backend API Test Suite', () => {
  beforeAll(async () => {
    // Ensure test database connection is healthy
    const res = await query('SELECT 1 as connected');
    expect(res.rows[0].connected).toBe(1);
  });

  it('GET /api/health returns healthy and stellar configuration', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.stellar.network).toBe('testnet');
    expect(res.body.stellar.rpcUrl).toBeDefined();
  });

  it('GET /api/auth/demo-profiles returns all 5 distinct roles', async () => {
    const res = await request(app).get('/api/auth/demo-profiles');
    expect(res.status).toBe(200);
    expect(res.body.profiles.donor).toBeDefined();
    expect(res.body.profiles.organisation).toBeDefined();
    expect(res.body.profiles.beneficiary).toBeDefined();
    expect(res.body.profiles.merchant).toBeDefined();
    expect(res.body.profiles.auditor).toBeDefined();
  });

  it('GET /api/campaigns returns active humanitarian aid campaigns', async () => {
    const res = await request(app).get('/api/campaigns');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.campaigns)).toBe(true);
    expect(res.body.campaigns.length).toBeGreaterThan(0);

    const first = res.body.campaigns[0];
    expect(first.title).toBeDefined();
    expect(first.target_amount).toBeDefined();
    expect(first.funding_progress_pct).toBeDefined();
  });

  it('POST /api/campaigns/:id/donate records a donation with transparency event', async () => {
    const res = await request(app)
      .post('/api/campaigns/1/donate')
      .set('x-wallet-address', 'GADONORTEST99999999999999999999999999999999999999999999')
      .set('x-user-role', 'donor')
      .send({
        amount: 250,
        token_symbol: 'USDC',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.donation.amount).toBe('250.0000000');
  });

  it('GET /api/audits/reconciliation verifies 100% mathematical zero-leakage parity', async () => {
    const res = await request(app).get('/api/audits/reconciliation');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.reconciliation.isReconciled).toBe(true);
    expect(res.body.reconciliation.leakagePercent).toBe(0.0);
  });

  it('GET /api/audits/trail returns immutable audit event logs', async () => {
    const res = await request(app).get('/api/audits/trail');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.events.length).toBeGreaterThan(0);
    expect(res.body.events[0].event_type).toBeDefined();
  });

  it('POST /api/merchants/verify-voucher checks category rules correctly', async () => {
    // Merchant 1 is FOOD category
    const resFood = await request(app)
      .post('/api/merchants/verify-voucher')
      .set('x-wallet-address', 'GAMERCHANT11111111111111111111111111111111111111111111111')
      .set('x-user-role', 'merchant')
      .send({ voucher_id: 1 }); // Voucher 1 is FOOD category

    expect(resFood.status).toBe(200);
    expect(resFood.body.valid).toBe(true);
    expect(resFood.body.category).toBe('FOOD');

    // Merchant 1 (FOOD) attempts to verify Voucher 3 (MEDS) -> Category Mismatch!
    const resMismatch = await request(app)
      .post('/api/merchants/verify-voucher')
      .set('x-wallet-address', 'GAMERCHANT11111111111111111111111111111111111111111111111')
      .set('x-user-role', 'merchant')
      .send({ voucher_id: 3 });

    expect(resMismatch.status).toBe(400);
    expect(resMismatch.body.valid).toBe(false);
    expect(resMismatch.body.reason).toContain('Category mismatch');
  });

  it('POST /api/merchants/redeem settles payment and reduces voucher balance', async () => {
    const initialVoucher = await request(app).get('/api/vouchers/2');
    const startBalance = Number(initialVoucher.body.voucher.remaining_amount);

    const redeemAmount = 50;
    const res = await request(app)
      .post('/api/merchants/redeem')
      .set('x-wallet-address', 'GAMERCHANT11111111111111111111111111111111111111111111111')
      .set('x-user-role', 'merchant')
      .send({
        voucher_id: 2,
        amount: redeemAmount,
        secret: 'AID-VOUCH-FOOD-8134-SEC',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Number(res.body.voucher.remaining_amount)).toBe(startBalance - redeemAmount);
  });
});
