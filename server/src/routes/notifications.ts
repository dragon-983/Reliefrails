import { Router, Request, Response } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../auth.js';

export const notificationsRouter = Router();

// GET /api/notifications - Get notifications for authenticated user
notificationsRouter.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const wallet = req.user!.wallet;
    const result = await query(
      `SELECT * FROM notifications WHERE recipient_wallet = $1 ORDER BY created_at DESC LIMIT 25`,
      [wallet]
    );

    res.json({
      success: true,
      notifications: result.rows,
    });
  } catch (err: any) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// POST /api/notifications/:id/read - Mark as read
notificationsRouter.post('/:id/read', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const wallet = req.user!.wallet;

    await query(
      `UPDATE notifications SET read = true WHERE id = $1 AND recipient_wallet = $2`,
      [id, wallet]
    );

    res.json({ success: true });
  } catch (err: any) {
    console.error('Error marking notification as read:', err);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// POST /api/notifications/read-all - Mark all as read
notificationsRouter.post('/read-all', requireAuth, async (req: Request, res: Response) => {
  try {
    const wallet = req.user!.wallet;
    await query(`UPDATE notifications SET read = true WHERE recipient_wallet = $1`, [wallet]);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error marking all notifications as read:', err);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

