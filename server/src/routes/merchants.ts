import { Router, Request, Response } from 'express';
import { query, withTransaction } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

export const merchantsRouter = Router();

// GET /api/merchants - List merchants
merchantsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { category, approved_only = 'true' } = req.query;
    let sql = `SELECT * FROM merchants WHERE 1=1`;
    const params: any[] = [];

    if (approved_only === 'true') {
      sql += ` AND is_approved = true`;
    }

    if (category) {
      params.push(category);
      sql += ` AND category = $${params.length}`;
    }

    sql += ` ORDER BY total_redeemed_amount DESC, business_name ASC`;

    const result = await query(sql, params);
    res.json({
      success: true,
      merchants: result.rows,
    });
  } catch (err: any) {
    console.error('Error fetching merchants:', err);
    res.status(500).json({ error: 'Failed to fetch merchants' });
  }
});

// POST /api/merchants/register - Register or update merchant profile
merchantsRouter.post('/register', requireAuth, async (req: Request, res: Response) => {
  try {
    const { business_name, category, location, contact_phone } = req.body;
    const wallet = req.user!.wallet;

    if (!business_name || !category) {
      return res.status(400).json({ error: 'business_name and category are required' });
    }

    const validCategories = ['FOOD', 'MEDS', 'SHELTER', 'EDU', 'SUPPLIES'];
    if (!validCategories.includes(category)) {
      return res
        .status(400)
        .json({ error: `Category must be one of: ${validCategories.join(', ')}` });
    }

    const insertRes = await query(
      `
      INSERT INTO merchants (wallet_address, business_name, category, location, contact_phone, is_approved)
      VALUES ($1, $2, $3, $4, $5, TRUE)
      ON CONFLICT (wallet_address) DO UPDATE
      SET business_name = EXCLUDED.business_name,
          category = EXCLUDED.category,
          location = EXCLUDED.location,
          contact_phone = EXCLUDED.contact_phone,
          updated_at = NOW()
      RETURNING *
    `,
      [wallet, business_name, category, location || null, contact_phone || null]
    );

    res.status(201).json({
      success: true,
      merchant: insertRes.rows[0],
    });
  } catch (err: any) {
    console.error('Error registering merchant:', err);
    res.status(500).json({ error: 'Failed to register merchant' });
  }
});

// POST /api/merchants/verify-voucher - Validate voucher when scanned by merchant
merchantsRouter.post(
  '/verify-voucher',
  requireAuth,
  requireRole('merchant'),
  async (req: Request, res: Response) => {
    try {
      const { voucher_id } = req.body;
      const merchantWallet = req.user!.wallet;

      // Find merchant
      const merchantRes = await query(
        `SELECT * FROM merchants WHERE wallet_address = $1`,
        [merchantWallet]
      );

      if (merchantRes.rowCount === 0 || !merchantRes.rows[0].is_approved) {
        return res
          .status(403)
          .json({ error: 'Merchant is not approved or not registered.' });
      }

      const merchant = merchantRes.rows[0];

      // Find voucher
      const voucherRes = await query(
        `
        SELECT 
          v.*,
          c.title AS campaign_title,
          c.token_symbol,
          b.alias_label AS beneficiary_alias
        FROM vouchers v
        JOIN campaigns c ON v.campaign_id = c.id
        JOIN beneficiaries b ON v.beneficiary_id = b.id
        WHERE v.id = $1
      `,
        [voucher_id]
      );

      if (voucherRes.rowCount === 0) {
        return res.status(404).json({ error: 'Voucher not found' });
      }

      const voucher = voucherRes.rows[0];

      // Check status
      if (voucher.status !== 'active') {
        return res.status(400).json({
          valid: false,
          reason: `Voucher is not active (${voucher.status}).`,
          voucher,
        });
      }

      // Check expiry
      if (new Date(voucher.expiry_date) < new Date()) {
        return res.status(400).json({
          valid: false,
          reason: 'Voucher has expired.',
          voucher,
        });
      }

      // Check category match
      if (voucher.category !== merchant.category) {
        return res.status(400).json({
          valid: false,
          reason: `Category mismatch! Voucher is restricted to [${voucher.category}], but merchant category is [${merchant.category}].`,
          voucher,
          merchantCategory: merchant.category,
        });
      }

      // Check remaining balance
      if (Number(voucher.remaining_amount) <= 0) {
        return res.status(400).json({
          valid: false,
          reason: 'Voucher balance is depleted.',
          voucher,
        });
      }

      res.json({
        valid: true,
        voucherId: voucher.id,
        category: voucher.category,
        remainingAmount: voucher.remaining_amount,
        maxPerTx: voucher.max_per_tx,
        campaignTitle: voucher.campaign_title,
        tokenSymbol: voucher.token_symbol,
        beneficiaryAlias: voucher.beneficiary_alias,
        expiryDate: voucher.expiry_date,
      });
    } catch (err: any) {
      console.error('Error verifying voucher:', err);
      res.status(500).json({ error: 'Failed to verify voucher' });
    }
  }
);

// POST /api/merchants/redeem - Execute redemption settlement
merchantsRouter.post(
  '/redeem',
  requireAuth,
  requireRole('merchant'),
  async (req: Request, res: Response) => {
    try {
      const {
        voucher_id,
        amount,
        secret,
        credential_nonce,
        settlement_tx_hash,
      } = req.body;

      if (!voucher_id || !amount || Number(amount) <= 0) {
        return res.status(400).json({ error: 'voucher_id and valid amount are required' });
      }

      const merchantWallet = req.user!.wallet;
      const redeemAmount = Number(amount);

      const result = await withTransaction(
        async (client) => {
          // Verify merchant
          const mRes = await client.query(
            `SELECT * FROM merchants WHERE wallet_address = $1`,
            [merchantWallet]
          );

          if (mRes.rowCount === 0 || !mRes.rows[0].is_approved) {
            throw new Error('Merchant is not approved or not registered.');
          }

          const merchant = mRes.rows[0];

          // Lock voucher row
          const vRes = await client.query(
            `SELECT * FROM vouchers WHERE id = $1 FOR UPDATE`,
            [voucher_id]
          );

          if (vRes.rowCount === 0) throw new Error('Voucher not found.');
          const voucher = vRes.rows[0];

          if (voucher.status !== 'active') {
            throw new Error(`Voucher is not active (${voucher.status}).`);
          }

          if (new Date(voucher.expiry_date) < new Date()) {
            throw new Error('Voucher has expired.');
          }

          if (voucher.category !== merchant.category) {
            throw new Error(
              `Category restriction violation: cannot redeem [${voucher.category}] voucher at [${merchant.category}] merchant.`
            );
          }

          // Verify secret if provided
          if (secret && secret !== voucher.redemption_credential_secret) {
            throw new Error('Invalid redemption credential secret.');
          }

          if (redeemAmount > Number(voucher.remaining_amount)) {
            throw new Error(
              `Requested redemption ${redeemAmount} exceeds available balance ${voucher.remaining_amount}.`
            );
          }

          if (redeemAmount > Number(voucher.max_per_tx)) {
            throw new Error(
              `Requested redemption ${redeemAmount} exceeds per-transaction limit ${voucher.max_per_tx}.`
            );
          }

          // Calculate new remaining balance
          const newRemaining = Number(voucher.remaining_amount) - redeemAmount;
          const newStatus = newRemaining === 0 ? 'redeemed' : 'active';

          // Update voucher
          const updatedVoucherRes = await client.query(
            `
            UPDATE vouchers
            SET remaining_amount = $1, status = $2, updated_at = NOW()
            WHERE id = $3
            RETURNING *
          `,
            [newRemaining, newStatus, voucher.id]
          );

          // Update campaign total_redeemed
          await client.query(
            `UPDATE campaigns SET total_redeemed = total_redeemed + $1, updated_at = NOW() WHERE id = $2`,
            [redeemAmount, voucher.campaign_id]
          );

          // Update merchant total_redeemed_amount
          await client.query(
            `UPDATE merchants SET total_redeemed_amount = total_redeemed_amount + $1, updated_at = NOW() WHERE id = $2`,
            [redeemAmount, merchant.id]
          );

          // Insert redemption record
          const nonce =
            credential_nonce ||
            `NONCE-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
          const txHash =
            settlement_tx_hash ||
            `0x${Buffer.from('REDEEM-' + merchantWallet.slice(0, 8) + Date.now()).toString('hex').slice(0, 64)}`;

          const redemptionRes = await client.query(
            `
            INSERT INTO redemptions (voucher_id, merchant_id, amount, credential_nonce, settlement_tx_hash, status)
            VALUES ($1, $2, $3, $4, $5, 'settled')
            RETURNING *
          `,
            [voucher.id, merchant.id, redeemAmount, nonce, txHash]
          );

          // Insert audit event
          await client.query(
            `
            INSERT INTO audit_events (campaign_id, event_type, actor_wallet, amount, tx_hash, metadata)
            VALUES ($1, 'redemption', $2, $3, $4, $5)
          `,
            [
              voucher.campaign_id,
              merchantWallet,
              redeemAmount,
              txHash,
              JSON.stringify({
                merchant: merchant.business_name,
                voucher_id: voucher.id,
                remaining_balance: newRemaining,
                category: voucher.category,
              }),
            ]
          );

          // Notification for merchant
          await client.query(
            `
            INSERT INTO notifications (recipient_wallet, title, message, type)
            VALUES ($1, 'Instant Settlement Confirmed', $2, 'success')
          `,
            [
              merchantWallet,
              `Received ${redeemAmount} USDC settlement for voucher #${voucher.id}.`,
            ]
          );

          return {
            redemption: redemptionRes.rows[0],
            voucher: updatedVoucherRes.rows[0],
            txHash,
          };
        },
        { wallet: merchantWallet, role: req.user?.role }
      );

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (err: any) {
      console.error('Error redeeming voucher:', err);
      res.status(400).json({ error: err.message || 'Redemption failed' });
    }
  }
);
