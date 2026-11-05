import { Router, Request, Response } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { hashCredentialSecret } from '../stellar.js';

export const beneficiariesRouter = Router();

// GET /api/beneficiaries - List registered beneficiaries (Organisations only)
beneficiariesRouter.get(
  '/',
  requireAuth,
  requireRole('organisation', 'auditor'),
  async (req: Request, res: Response) => {
    try {
      const wallet = req.user!.wallet;
      let sql = `
        SELECT 
          b.id,
          b.org_id,
          b.privacy_commitment,
          b.alias_label,
          b.family_size,
          b.location_zone,
          b.is_verified,
          b.verification_tier,
          b.created_at,
          COUNT(v.id) AS voucher_count,
          COALESCE(SUM(v.remaining_amount), 0) AS total_unspent_aid
        FROM beneficiaries b
        JOIN organisations o ON b.org_id = o.id
        LEFT JOIN vouchers v ON b.id = v.beneficiary_id AND v.status = 'active'
      `;
      const params: any[] = [];

      if (req.user!.role === 'organisation') {
        params.push(wallet);
        sql += ` WHERE o.wallet_address = $1`;
      }

      sql += ` GROUP BY b.id ORDER BY b.created_at DESC`;

      const result = await query(sql, params, {
        wallet,
        role: req.user!.role,
      });

      res.json({
        success: true,
        beneficiaries: result.rows,
      });
    } catch (err: any) {
      console.error('Error fetching beneficiaries:', err);
      res.status(500).json({ error: 'Failed to fetch beneficiaries' });
    }
  }
);

// POST /api/beneficiaries - Register beneficiary (Preserving Privacy Commitment)
beneficiariesRouter.post(
  '/',
  requireAuth,
  requireRole('organisation'),
  async (req: Request, res: Response) => {
    try {
      const {
        alias_label,
        family_size = 1,
        location_zone = 'ZONE_NORTH',
        verification_tier = 'tier_1',
        raw_seed_or_id,
      } = req.body;

      if (!alias_label) {
        return res.status(400).json({ error: 'Alias label is required' });
      }

      const wallet = req.user!.wallet;
      const orgRes = await query(`SELECT id FROM organisations WHERE wallet_address = $1`, [
        wallet,
      ]);

      if (orgRes.rowCount === 0) {
        return res.status(400).json({ error: 'Organisation not found for current wallet' });
      }

      const orgId = orgRes.rows[0].id;
      // Derive a deterministic zero-knowledge privacy commitment hash
      const privacyCommitment = hashCredentialSecret(
        raw_seed_or_id || `${alias_label}-${Date.now()}-${Math.random()}`
      );

      const insertRes = await query(
        `
        INSERT INTO beneficiaries (
          org_id, privacy_commitment, alias_label, family_size, location_zone, is_verified, verification_tier
        )
        VALUES ($1, $2, $3, $4, $5, TRUE, $6)
        RETURNING *
      `,
        [orgId, privacyCommitment, alias_label, family_size, location_zone, verification_tier],
        { wallet, role: req.user!.role }
      );

      res.status(201).json({
        success: true,
        beneficiary: insertRes.rows[0],
      });
    } catch (err: any) {
      console.error('Error creating beneficiary:', err);
      res.status(500).json({ error: 'Failed to register beneficiary' });
    }
  }
);

// GET /api/beneficiaries/me/vouchers - Get vouchers for current authenticated beneficiary
beneficiariesRouter.get('/me/vouchers', requireAuth, async (req: Request, res: Response) => {
  try {
    // For demo/beneficiary role, match by demo profile or default beneficiary (id 1)
    const beneficiaryId = req.query.beneficiary_id ? Number(req.query.beneficiary_id) : 1;

    const vouchersRes = await query(
      `
      SELECT 
        v.*,
        c.title AS campaign_title,
        c.token_symbol,
        o.name AS org_name
      FROM vouchers v
      JOIN campaigns c ON v.campaign_id = c.id
      JOIN organisations o ON c.org_id = o.id
      WHERE v.beneficiary_id = $1
      ORDER BY v.created_at DESC
    `,
      [beneficiaryId]
    );

    const beneficiaryRes = await query(
      `SELECT id, alias_label, family_size, location_zone, verification_tier FROM beneficiaries WHERE id = $1`,
      [beneficiaryId]
    );

    res.json({
      success: true,
      beneficiary: beneficiaryRes.rows[0] || null,
      vouchers: vouchersRes.rows,
    });
  } catch (err: any) {
    console.error('Error fetching beneficiary vouchers:', err);
    res.status(500).json({ error: 'Failed to fetch vouchers' });
  }
});
