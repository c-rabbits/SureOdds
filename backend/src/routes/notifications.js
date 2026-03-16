/**
 * Notifications API Routes (Phase 3 Step 3)
 * /api/notifications
 * 모든 엔드포인트는 requireAuth 필요.
 */

const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { createServiceLogger } = require('../config/logger');

const log = createServiceLogger('NotifRoute');

// GET /api/notifications — 알림 목록
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0, type, unread_only } = req.query;

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (type) {
      query = query.eq('type', type);
    }
    if (unread_only === 'true') {
      query = query.eq('read', false);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data: data || [], count: data?.length || 0 });
  } catch (err) {
    log.error('Error in GET /notifications', { error: err.message });
    res.status(500).json({ success: false, error: '알림을 불러오지 못했습니다.' });
  }
});

// GET /api/notifications/unread-count — 미읽음 수
router.get('/unread-count', async (req, res) => {
  try {
    const userId = req.user.id;

    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) throw error;

    res.json({ success: true, count: count || 0 });
  } catch (err) {
    log.error('Error in GET /unread-count', { error: err.message });
    res.status(500).json({ success: false, error: '미읽음 수를 불러오지 못했습니다.' });
  }
});

// PATCH /api/notifications/:id/read — 읽음 처리
router.patch('/:id/read', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    log.error('Error in PATCH /:id/read', { error: err.message });
    res.status(500).json({ success: false, error: '읽음 처리에 실패했습니다.' });
  }
});

// POST /api/notifications/read-all — 전체 읽음
router.post('/read-all', async (req, res) => {
  try {
    const userId = req.user.id;

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    log.error('Error in POST /read-all', { error: err.message });
    res.status(500).json({ success: false, error: '전체 읽음 처리에 실패했습니다.' });
  }
});

// GET /api/notifications/preferences — 알림 설정 조회
router.get('/preferences', async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('alert_preferences')
      .select('alert_type, telegram_enabled, push_enabled, min_threshold')
      .eq('user_id', userId);

    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (err) {
    log.error('Error in GET /preferences', { error: err.message });
    res.status(500).json({ success: false, error: '설정을 불러오지 못했습니다.' });
  }
});

// PUT /api/notifications/preferences — 알림 설정 저장
router.put('/preferences', async (req, res) => {
  try {
    const userId = req.user.id;
    const { preferences } = req.body;

    if (!Array.isArray(preferences)) {
      return res.status(400).json({ success: false, error: 'preferences 배열이 필요합니다.' });
    }

    const rows = preferences.map((p) => ({
      user_id: userId,
      alert_type: p.alert_type,
      telegram_enabled: p.telegram_enabled ?? true,
      push_enabled: p.push_enabled ?? true,
      min_threshold: p.min_threshold ?? 0,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('alert_preferences')
      .upsert(rows, { onConflict: 'user_id,alert_type' });

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    log.error('Error in PUT /preferences', { error: err.message });
    res.status(500).json({ success: false, error: '설정 저장에 실패했습니다.' });
  }
});

module.exports = router;
