import { Router, Request, Response } from 'express';
import { query, withTransaction } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

export const campaignsRouter = Router();

// GET /api/campaigns - List campaigns
campaignsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { status, category, search } = req.query;

    let sql = `
      SELECT 
        c.*,
        o.name AS org_name,
        o.wallet_address AS org_wallet,
        o.is_verified AS org_verified,
        ROUND((c.total_contributed / NULLIF(c.target_amount, 0)) * 100, 2) AS funding_progress_pct,
        (c.total_contributed - c.total_allocated) AS unallocated_balance
      FROM campaigns c
      JOIN organisations o ON c.org_id = o.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      params.push(status);
      sql += ` AND c.status = $${params.length}`;
    }

    if (category) {
      params.push(`%${category}%`);
      sql += ` AND array_to_string(c.categories, ',') ILIKE $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (c.title ILIKE $${params.length} OR c.description ILIKE $${params.length} OR o.name ILIKE $${params.length})`;
    }

    sql += ` ORDER BY c.created_at DESC`;

    const result = await query(sql, params, {
      wallet: req.user?.wallet,
      role: req.user?.role,
    });

    res.json({
      success: true,
      campaigns: result.rows,
    });
  } catch (err: any) {
    console.error('Error fetching campaigns:', err);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// GET /api/campaigns/:id - Get campaign details
campaignsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const campaignId = req.params.id;

    const campaignRes = await query(
      `
      SELECT 
        c.*,
        o.name AS org_name,
        o.wallet_address AS org_wallet,
        o.description AS org_description,
        o.contact_email AS org_contact,
        o.is_verified AS org_verified,
        ROUND((c.total_contributed / NULLIF(c.target_amount, 0)) * 100, 2) AS funding_progress_pct,
        (c.total_contributed - c.total_allocated) AS unallocated_balance
      FROM campaigns c
      JOIN organisations o ON c.org_id = o.id
      WHERE c.id = $1
    `,
      [campaignId],
      { wallet: req.user?.wallet, role: req.user?.role }
    );

    if (campaignRes.rowCount === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const campaign = campaignRes.rows[0];

    // Recent donations
    const donationsRes = await query(
      `SELECT * FROM donations WHERE campaign_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [campaignId]
    );

    // Recent audit events
    const auditRes = await query(
      `SELECT * FROM audit_events WHERE campaign_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [campaignId]
    );

    res.json({
      success: true,
      campaign,
      recentDonations: donationsRes.rows,
      auditTrail: auditRes.rows,
    });
  } catch (err: any) {
    console.error('Error fetching campaign details:', err);
    res.status(500).json({ error: 'Failed to fetch campaign details' });
  }
});

// POST /api/campaigns - Create a new campaign
campaignsRouter.post(
  '/',
  requireAuth,
  requireRole('organisation'),
  async (req: Request, res: Response) => {
    try {
      const {
        title,
        description,
        target_amount,
        token_address,
        token_symbol = 'USDC',
        categories = ['FOOD', 'MEDS', 'SHELTER'],
        duration_days = 60,
        tx_hash,
        on_chain_id,
      } = req.body;

      if (!title || !target_amount) {
        return res.status(400).json({ error: 'Title and target amount are required' });
      }

      const wallet = req.user!.wallet;

      // Find organisation id for current wallet
      const orgRes = await query(
        `SELECT id FROM organisations WHERE wallet_address = $1`,
        [wallet]
      );

      if (orgRes.rowCount === 0) {
        return res
          .status(400)
          .json({ error: 'No organisation registered for this wallet address' });
      }

      const orgId = orgRes.rows[0].id;

      const startDate = new Date();
      const endDate = new Date(Date.now() + duration_days * 24 * 60 * 60 * 1000);

      const campaign = await withTransaction(
        async (client) => {
          const insertRes = await client.query(
            `
            INSERT INTO campaigns (
              on_chain_id, org_id, title, description, target_amount,
              token_address, token_symbol, categories, start_date, end_date, tx_hash
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
          `,
            [
              on_chain_id || Math.floor(Date.now() / 1000),
              orgId,
              title,
              description || '',
              target_amount,
              token_address || 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCUSDC',
              token_symbol,
              categories,
              startDate,
              endDate,
              tx_hash || null,
            ]
          );

          const newCampaign = insertRes.rows[0];

          // Record audit event
          await client.query(
            `
            INSERT INTO audit_events (campaign_id, event_type, actor_wallet, amount, tx_hash, metadata)
            VALUES ($1, 'allocation', $2, 0, $3, $4)
          `,
            [
              newCampaign.id,
              wallet,
              tx_hash || null,
              JSON.stringify({ action: 'create_campaign', title, target_amount }),
            ]
          );

          return newCampaign;
        },
        { wallet, role: req.user?.role }
      );

      res.status(201).json({
        success: true,
        campaign,
      });
    } catch (err: any) {
      console.error('Error creating campaign:', err);
      res.status(500).json({ error: 'Failed to create campaign' });
    }
  }
);

// POST /api/campaigns/:id/donate - Record / Broadcast a donation
campaignsRouter.post(
  '/:id/donate',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const campaignId = req.params.id;
      const { amount, token_symbol = 'USDC', tx_hash } = req.body;

      if (!amount || Number(amount) <= 0) {
        return res.status(400).json({ error: 'Valid donation amount is required' });
      }

      const donorWallet = req.user!.wallet;
      const finalTxHash =
        tx_hash ||
        `0x${Buffer.from(donorWallet.slice(0, 10) + Date.now()).toString('hex').slice(0, 64)}`;

      const donation = await withTransaction(async (client) => {
        // Update campaign total_contributed
        const updateRes = await client.query(
          `
          UPDATE campaigns
          SET total_contributed = total_contributed + $1, updated_at = NOW()
          WHERE id = $2
          RETURNING *
        `,
          [amount, campaignId]
        );

        if (updateRes.rowCount === 0) {
          throw new Error('Campaign not found');
        }

        const campaign = updateRes.rows[0];

        // Insert donation
        const donationRes = await client.query(
          `
          INSERT INTO donations (campaign_id, donor_wallet, amount, token_symbol, tx_hash)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `,
          [campaignId, donorWallet, amount, token_symbol, finalTxHash]
        );

        // Record public audit event
        await client.query(
          `
          INSERT INTO audit_events (campaign_id, event_type, actor_wallet, amount, tx_hash, metadata)
          VALUES ($1, 'donation', $2, $3, $4, $5)
        `,
          [
            campaignId,
            donorWallet,
            amount,
            finalTxHash,
            JSON.stringify({ campaign_title: campaign.title, token_symbol }),
          ]
        );

        // Notify Organisation
        const orgRes = await client.query(
          `SELECT wallet_address FROM organisations WHERE id = $1`,
          [campaign.org_id]
        );

        if (orgRes.rowCount && orgRes.rowCount > 0) {
          await client.query(
            `
            INSERT INTO notifications (recipient_wallet, title, message, type, link)
            VALUES ($1, 'New Campaign Donation Received', $2, 'success', $3)
          `,
            [
              orgRes.rows[0].wallet_address,
              `Received ${amount} ${token_symbol} for campaign: ${campaign.title}`,
              `/campaigns/${campaignId}`,
            ]
          );
        }

        return donationRes.rows[0];
      });

      res.status(201).json({
        success: true,
        donation,
      });
    } catch (err: any) {
      console.error('Error processing donation:', err);
      res.status(500).json({ error: err.message || 'Failed to process donation' });
    }
  }
);

// POST /api/campaigns/:id/status - Change status (pause/close)
campaignsRouter.post(
  '/:id/status',
  requireAuth,
  requireRole('organisation'),
  async (req: Request, res: Response) => {
    try {
      const campaignId = req.params.id;
      const { status } = req.body;

      if (!['active', 'paused', 'closed'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const resUpdate = await query(
        `
        UPDATE campaigns
        SET status = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `,
        [status, campaignId],
        { wallet: req.user?.wallet, role: req.user?.role }
      );

      if (resUpdate.rowCount === 0) {
        return res.status(404).json({ error: 'Campaign not found or not authorized' });
      }

      res.json({
        success: true,
        campaign: resUpdate.rows[0],
      });
    } catch (err: any) {
      console.error('Error updating campaign status:', err);
      res.status(500).json({ error: 'Failed to update campaign status' });
    }
  }
);
