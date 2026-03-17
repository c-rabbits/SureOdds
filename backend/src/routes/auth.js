/**
 * SureOdds - 인증 라우트
 * /api/auth
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { createServiceLogger } = require('../config/logger');

const log = createServiceLogger('Auth');

// ============================================================
// 헬퍼: app_settings에서 설정값 읽기
// ============================================================
async function getSetting(supabase, key, defaultValue) {
  try {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .single();
    if (data) return JSON.parse(data.value);
  } catch { /* ignore */ }
  return defaultValue;
}

// ============================================================
// POST /api/auth/login - 로그인 + 세션 등록
// 프론트에서 Supabase signIn 성공 후 이 엔드포인트를 호출
// ============================================================
router.post('/login', requireAuth, async (req, res) => {
  try {
    const supabase = require('../config/supabase');
    const userId = req.user.id;
    const sessionToken = req.headers.authorization?.split(' ')[1] || '';
    const deviceInfo = req.headers['user-agent'] || 'unknown';
    const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';

    // 설정값 읽기
    const allowConcurrent = await getSetting(supabase, 'allow_concurrent_login', true);
    const forceLogout = await getSetting(supabase, 'force_logout_on_new_login', true);

    if (!allowConcurrent) {
      // 중복 로그인 불허 → 기존 세션 전부 무효화
      const { data: existingSessions } = await supabase
        .from('active_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('is_valid', true);

      if (existingSessions && existingSessions.length > 0) {
        await supabase
          .from('active_sessions')
          .update({ is_valid: false })
          .eq('user_id', userId)
          .eq('is_valid', true);

        log.info('Existing sessions invalidated', { userId, count: existingSessions.length });
      }
    } else if (forceLogout) {
      // 중복 허용 + 강제로그아웃 모드 → 기존 세션 무효화
      await supabase
        .from('active_sessions')
        .update({ is_valid: false })
        .eq('user_id', userId)
        .eq('is_valid', true);
    }

    // 새 세션 등록
    await supabase
      .from('active_sessions')
      .insert({
        user_id: userId,
        session_token: sessionToken.substring(0, 50), // 토큰 앞부분만 저장 (식별용)
        device_info: deviceInfo.substring(0, 200),
        ip_address: typeof ipAddress === 'string' ? ipAddress.split(',')[0].trim() : '',
      });

    log.info('Session registered', { userId, ip: ipAddress });

    res.json({
      success: true,
      data: {
        ...req.user.profile,
        session_registered: true,
      },
    });
  } catch (err) {
    log.error('Login session registration error', { error: err.message });
    // 세션 등록 실패해도 로그인 자체는 성공으로 처리
    res.json({
      success: true,
      data: req.user.profile,
    });
  }
});

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
