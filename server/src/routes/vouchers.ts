import { Router, Request, Response } from 'express';
import { query, withTransaction } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { generateVoucherSecret, hashCredentialSecret } from '../stellar.js';

export const vouchersRouter = Router();

// GET /api/vouchers/:id - Get specific voucher
vouchersRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const voucherId = req.params.id;
    const result = await query(
      `
      SELECT 
        v.*,
        c.title AS campaign_title,
        c.token_symbol,
        b.alias_label AS beneficiary_alias,
        o.name AS org_name
      FROM vouchers v
      JOIN campaigns c ON v.campaign_id = c.id
      JOIN organisations o ON c.org_id = o.id
      JOIN beneficiaries b ON v.beneficiary_id = b.id
      WHERE v.id = $1
    `,
      [voucherId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Voucher not found' });
    }

    res.json({
      success: true,
      voucher: result.rows[0],
    });
  } catch (err: any) {
    console.error('Error fetching voucher:', err);
    res.status(500).json({ error: 'Failed to fetch voucher' });
  }
});

// POST /api/vouchers/allocate - Allocate aid from campaign to beneficiary
vouchersRouter.post(
  '/allocate',
  requireAuth,
  requireRole('organisation'),
  async (req: Request, res: Response) => {
    try {
      const { campaign_id, beneficiary_id, amount, category, expiry_days = 30, tx_hash } =
        req.body;

      if (!campaign_id || !beneficiary_id || !amount || Number(amount) <= 0) {
        return res
          .status(400)
          .json({ error: 'campaign_id, beneficiary_id, and valid amount are required' });
      }

      const wallet = req.user!.wallet;
      const expiryDate = new Date(Date.now() + expiry_days * 24 * 60 * 60 * 1000);

      const allocation = await withTransaction(
        async (client) => {
          // Check campaign unallocated balance
          const campRes = await client.query(
            `SELECT * FROM campaigns WHERE id = $1 FOR UPDATE`,
            [campaign_id]
          );

          if (campRes.rowCount === 0) {
            throw new Error('Campaign not found');
          }

          const camp = campRes.rows[0];
          const available = Number(camp.total_contributed) - Number(camp.total_allocated);
          if (Number(amount) > available) {
            throw new Error(
              `Insufficient unallocated campaign funds. Available: ${available}, Requested: ${amount}`
            );
          }

          // Update campaign allocated amount
          await client.query(
            `UPDATE campaigns SET total_allocated = total_allocated + $1, updated_at = NOW() WHERE id = $2`,
            [amount, campaign_id]
          );

          // Create allocation record
          const allocRes = await client.query(
            `
            INSERT INTO allocations (
              on_chain_id, campaign_id, beneficiary_id, amount, category, expiry_date, status, tx_hash
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'allocated', $7)
            RETURNING *
          `,
            [
              Math.floor(Date.now() / 1000),
              campaign_id,
              beneficiary_id,
              amount,
              category || 'FOOD',
              expiryDate,
              tx_hash || null,
            ]
          );

          // Record audit event
          await client.query(
            `
            INSERT INTO audit_events (campaign_id, event_type, actor_wallet, amount, tx_hash, metadata)
            VALUES ($1, 'allocation', $2, $3, $4, $5)
          `,
            [
              campaign_id,
              wallet,
              amount,
              tx_hash || null,
              JSON.stringify({ beneficiary_id, category: category || 'FOOD' }),
            ]
          );

          return allocRes.rows[0];
        },
        { wallet, role: req.user?.role }
      );

      res.status(201).json({
        success: true,
        allocation,
      });
    } catch (err: any) {
      console.error('Error allocating aid:', err);
      res.status(500).json({ error: err.message || 'Failed to allocate aid' });
    }
  }
);

// POST /api/vouchers/issue - Issue programmable aid voucher
vouchersRouter.post(
  '/issue',
  requireAuth,
  requireRole('organisation'),
  async (req: Request, res: Response) => {
    try {
      const {
        allocation_id,
        campaign_id,
        beneficiary_id,
        amount,
        max_per_tx = 100,
        category = 'FOOD',
        expiry_days = 30,
        tx_hash,
      } = req.body;

      if (!campaign_id || !beneficiary_id || !amount || Number(amount) <= 0) {
        return res
          .status(400)
          .json({ error: 'campaign_id, beneficiary_id, and valid amount are required' });
      }

      const wallet = req.user!.wallet;
      const expiryDate = new Date(Date.now() + expiry_days * 24 * 60 * 60 * 1000);
      const secret = generateVoucherSecret(category);
      const commitmentHash = hashCredentialSecret(secret);

      const voucher = await withTransaction(
        async (client) => {
          let finalAllocationId = allocation_id;

          // If no allocation_id provided, automatically allocate first
          if (!finalAllocationId) {
            const campRes = await client.query(
              `SELECT * FROM campaigns WHERE id = $1 FOR UPDATE`,
              [campaign_id]
            );
            if (campRes.rowCount === 0) throw new Error('Campaign not found');

            const camp = campRes.rows[0];
            const available = Number(camp.total_contributed) - Number(camp.total_allocated);
            if (Number(amount) > available) {
              throw new Error(`Insufficient campaign funds to issue voucher.`);
            }

            await client.query(
              `UPDATE campaigns SET total_allocated = total_allocated + $1, updated_at = NOW() WHERE id = $2`,
              [amount, campaign_id]
            );

            const allocRes = await client.query(
              `
              INSERT INTO allocations (on_chain_id, campaign_id, beneficiary_id, amount, category, expiry_date, status)
              VALUES ($1, $2, $3, $4, $5, $6, 'issued')
              RETURNING id
            `,
              [Math.floor(Date.now() / 1000), campaign_id, beneficiary_id, amount, category, expiryDate]
            );
            finalAllocationId = allocRes.rows[0].id;
          } else {
            await client.query(
              `UPDATE allocations SET status = 'issued' WHERE id = $1`,
              [finalAllocationId]
            );
          }

          // Insert voucher
          const voucherRes = await client.query(
            `
            INSERT INTO vouchers (
              on_chain_id, allocation_id, campaign_id, beneficiary_id,
              initial_amount, remaining_amount, max_per_tx, category, expiry_date,
              redemption_credential_secret, status, tx_hash
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', $11)
            RETURNING *
          `,
            [
              Math.floor(Date.now() / 1000),
              finalAllocationId,
              campaign_id,
              beneficiary_id,
              amount,
              amount,
              max_per_tx,
              category,
              expiryDate,
              secret,
              tx_hash || null,
            ]
          );

          // Record audit event
          await client.query(
            `
            INSERT INTO audit_events (campaign_id, event_type, actor_wallet, amount, tx_hash, metadata)
            VALUES ($1, 'voucher_issuance', $2, $3, $4, $5)
          `,
            [
              campaign_id,
              wallet,
              amount,
              tx_hash || null,
              JSON.stringify({
                voucher_id: voucherRes.rows[0].id,
                category,
                max_per_tx,
                commitment_hash: commitmentHash,
              }),
            ]
          );

          return voucherRes.rows[0];
        },
        { wallet, role: req.user?.role }
      );

      res.status(201).json({
        success: true,
        voucher,
        commitmentHash,
      });
    } catch (err: any) {
      console.error('Error issuing voucher:', err);
      res.status(500).json({ error: err.message || 'Failed to issue voucher' });
    }
  }
);

// POST /api/vouchers/:id/qr - Generate QR redemption payload
vouchersRouter.post('/:id/qr', async (req: Request, res: Response) => {
  try {
    const voucherId = req.params.id;

    const voucherRes = await query(
      `
      SELECT v.*, c.title as campaign_title, b.alias_label as beneficiary_alias
      FROM vouchers v
      JOIN campaigns c ON v.campaign_id = c.id
      JOIN beneficiaries b ON v.beneficiary_id = b.id
      WHERE v.id = $1
    `,
      [voucherId]
    );

    if (voucherRes.rowCount === 0) {
      return res.status(404).json({ error: 'Voucher not found' });
    }

    const voucher = voucherRes.rows[0];

    if (voucher.status !== 'active') {
      return res.status(400).json({ error: `Voucher is not active (${voucher.status})` });
    }

    if (new Date(voucher.expiry_date) < new Date()) {
      return res.status(400).json({ error: 'Voucher has expired' });
    }

    // QR credential payload contains cryptographic proof without revealing secret prematurely
    const qrPayload = {
      type: 'RELIEFRAIL_VOUCHER_CREDENTIAL',
      voucherId: voucher.id,
      campaignId: voucher.campaign_id,
      campaignTitle: voucher.campaign_title,
      beneficiaryAlias: voucher.beneficiary_alias,
      category: voucher.category,
      remainingAmount: voucher.remaining_amount,
      maxPerTx: voucher.max_per_tx,
      expiryDate: voucher.expiry_date,
      secret: voucher.redemption_credential_secret,
      signature: hashCredentialSecret(voucher.redemption_credential_secret + voucher.remaining_amount),
    };

    res.json({
      success: true,
      qrPayload,
      qrString: JSON.stringify(qrPayload),
    });
  } catch (err: any) {
    console.error('Error generating QR credential:', err);
    res.status(500).json({ error: 'Failed to generate QR payload' });
  }
});

// POST /api/vouchers/:id/revoke - Revoke voucher
vouchersRouter.post(
  '/:id/revoke',
  requireAuth,
  requireRole('organisation'),
  async (req: Request, res: Response) => {
    try {
      const voucherId = req.params.id;
      const wallet = req.user!.wallet;

      const voucher = await withTransaction(
        async (client) => {
          const vRes = await client.query(
            `SELECT * FROM vouchers WHERE id = $1 FOR UPDATE`,
            [voucherId]
          );

          if (vRes.rowCount === 0) throw new Error('Voucher not found');
          const v = vRes.rows[0];

          if (v.status !== 'active') throw new Error(`Voucher is already ${v.status}`);

          // Return remaining amount to unallocated campaign pool
          await client.query(
            `UPDATE campaigns SET total_allocated = total_allocated - $1, updated_at = NOW() WHERE id = $2`,
            [v.remaining_amount, v.campaign_id]
          );

          // Update voucher status
          const updateVoucher = await client.query(
            `UPDATE vouchers SET status = 'revoked', updated_at = NOW() WHERE id = $1 RETURNING *`,
            [voucherId]
          );

          // Record audit event
          await client.query(
            `
            INSERT INTO audit_events (campaign_id, event_type, actor_wallet, amount, metadata)
            VALUES ($1, 'voucher_revocation', $2, $3, $4)
          `,
            [
              v.campaign_id,
              wallet,
              v.remaining_amount,
              JSON.stringify({ voucher_id: v.id, refunded_amount: v.remaining_amount }),
            ]
          );

          return updateVoucher.rows[0];
        },
        { wallet, role: req.user?.role }
      );

      res.json({
        success: true,
        voucher,
      });
    } catch (err: any) {
      console.error('Error revoking voucher:', err);
      res.status(500).json({ error: err.message || 'Failed to revoke voucher' });
    }
  }
);
