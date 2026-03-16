/**
 * Web Push API Routes (Phase 3 Step 2)
 * /api/push
 */

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { requireAuth } = require('../middleware/auth');
const { createServiceLogger } = require('../config/logger');

const log = createServiceLogger('PushRoute');

// GET /api/push/vapid-key — VAPID 공개키 반환 (인증 불필요)
router.get('/vapid-key', (req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) {
    return res.status(503).json({ success: false, error: 'Web Push not configured' });
  }
  res.json({ success: true, key });
});

// POST /api/push/subscribe — 푸시 구독 저장
router.post('/subscribe', requireAuth, async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ success: false, error: 'Invalid subscription object' });
    }

    const userId = req.user.id;

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert({
        user_id: userId,
        endpoint: subscription.endpoint,
        keys_p256dh: subscription.keys.p256dh,
        keys_auth: subscription.keys.auth,
        user_agent: req.headers['user-agent'] || null,
      }, { onConflict: 'user_id,endpoint' });

    if (error) {
      log.error('Failed to save push subscription', { userId, error: error.message });
      return res.status(500).json({ success: false, error: 'Failed to save subscription' });
    }

    log.info(`Push subscription saved for user ${userId}`);
    res.json({ success: true });
  } catch (err) {
    log.error('Error in POST /subscribe', { error: err.message });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

// DELETE /api/push/subscribe — 푸시 구독 해제
router.delete('/subscribe', requireAuth, async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ success: false, error: 'Endpoint required' });
    }

    const userId = req.user.id;

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint);

    if (error) {
      log.error('Failed to delete push subscription', { userId, error: error.message });
      return res.status(500).json({ success: false, error: 'Failed to unsubscribe' });
    }

    log.info(`Push subscription removed for user ${userId}`);
    res.json({ success: true });
  } catch (err) {
    log.error('Error in DELETE /subscribe', { error: err.message });
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

module.exports = router;
