/**
 * SureOdds - 인증 라우트
 * /api/auth
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { createServiceLogger } = require('../config/logger');

const log = createServiceLogger('Auth');

// GET /api/auth/me - 현재 로그인한 사용자 프로필 조회
router.get('/me', requireAuth, async (req, res) => {
  try {
    res.json({
      success: true,
      data: req.user.profile,
    });
  } catch (err) {
    log.error('Get profile error', { error: err.message });
    res.status(500).json({
      success: false,
      error: '프로필 조회에 실패했습니다.',
    });
  }
});

// PATCH /api/auth/me - 닉네임 변경
router.patch('/me', requireAuth, async (req, res) => {
  try {
    const { display_name } = req.body;
    if (!display_name || typeof display_name !== 'string' || display_name.trim().length === 0) {
      return res.status(400).json({ success: false, error: '닉네임을 입력해주세요.' });
    }
    if (display_name.trim().length > 20) {
      return res.status(400).json({ success: false, error: '닉네임은 20자 이하로 입력해주세요.' });
    }

    const supabase = require('../config/supabase');
    const { data, error } = await supabase
      .from('profiles')
      .update({ display_name: display_name.trim(), updated_at: new Date().toISOString() })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) throw error;

    log.info('Display name updated', { userId: req.user.id, display_name: display_name.trim() });
    res.json({ success: true, data });
  } catch (err) {
    log.error('Update profile error', { error: err.message });
    res.status(500).json({ success: false, error: '프로필 수정에 실패했습니다.' });
  }
});

module.exports = router;
