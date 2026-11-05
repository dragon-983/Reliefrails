import { Router, Request, Response } from 'express';
import { query } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

export const organisationsRouter = Router();

// GET /api/organisations - List verified organisations
organisationsRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT 
        o.*,
        COUNT(DISTINCT c.id) AS campaign_count,
        COALESCE(SUM(c.total_contributed), 0) AS total_raised,
        COALESCE(SUM(c.total_redeemed), 0) AS total_aid_delivered
      FROM organisations o
      LEFT JOIN campaigns c ON o.id = c.org_id
      GROUP BY o.id
      ORDER BY o.is_verified DESC, total_raised DESC
    `);

    res.json({
      success: true,
      organisations: result.rows,
    });
  } catch (err: any) {
    console.error('Error fetching organisations:', err);
    res.status(500).json({ error: 'Failed to fetch organisations' });
  }
});

// GET /api/organisations/:id - Get specific organisation details
organisationsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const orgId = req.params.id;

    const orgRes = await query(`SELECT * FROM organisations WHERE id = $1`, [orgId]);
    if (orgRes.rowCount === 0) {
      return res.status(404).json({ error: 'Organisation not found' });
    }

    const campaignsRes = await query(
      `SELECT * FROM campaigns WHERE org_id = $1 ORDER BY created_at DESC`,
      [orgId]
    );

    res.json({
      success: true,
      organisation: orgRes.rows[0],
      campaigns: campaignsRes.rows,
    });
  } catch (err: any) {
    console.error('Error fetching organisation details:', err);
    res.status(500).json({ error: 'Failed to fetch organisation details' });
  }
});

// POST /api/organisations - Register organisation
organisationsRouter.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, description, ein_registration, contact_email, website } = req.body;
    const wallet = req.user!.wallet;

    if (!name) {
      return res.status(400).json({ error: 'Organisation name is required' });
    }

    const insertRes = await query(
      `
      INSERT INTO organisations (wallet_address, name, description, ein_registration, contact_email, website, is_verified)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE)
      ON CONFLICT (wallet_address) DO UPDATE
      SET name = EXCLUDED.name, description = EXCLUDED.description, contact_email = EXCLUDED.contact_email, website = EXCLUDED.website, updated_at = NOW()
      RETURNING *
    `,
      [wallet, name, description || '', ein_registration || null, contact_email || null, website || null],
      { wallet, role: req.user?.role }
    );

    res.status(201).json({
      success: true,
      organisation: insertRes.rows[0],
    });
  } catch (err: any) {
    console.error('Error registering organisation:', err);
    res.status(500).json({ error: 'Failed to register organisation' });
  }
});

// POST /api/organisations/:id/verify - Verify organisation (Auditor or Admin)
organisationsRouter.post(
  '/:id/verify',
  requireAuth,
  requireRole('auditor'),
  async (req: Request, res: Response) => {
    try {
      const orgId = req.params.id;
      const { is_verified = true } = req.body;

      const resUpdate = await query(
        `UPDATE organisations SET is_verified = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [is_verified, orgId]
      );

      if (resUpdate.rowCount === 0) {
        return res.status(404).json({ error: 'Organisation not found' });
      }

      res.json({
        success: true,
        organisation: resUpdate.rows[0],
      });
    } catch (err: any) {
      console.error('Error verifying organisation:', err);
      res.status(500).json({ error: 'Failed to verify organisation' });
    }
  }
);
