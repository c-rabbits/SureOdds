/**
 * SureOdds - 관리자 라우트
 * /api/admin
 * 모든 라우트에 requireAuth + requireAdmin 적용
 */
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { createServiceLogger } = require('../config/logger');

const log = createServiceLogger('Admin');

// 모든 관리자 라우트에 인증 + 관리자 권한 적용
router.use(requireAuth, requireAdmin);

// ============================================================
// GET /api/admin/users - 전체 사용자 목록 조회
// ============================================================
router.get('/users', async (req, res) => {
  try {
    // profiles 테이블에서 전체 조회
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // auth.users에서 last_sign_in_at 가져오기
    const {
      data: { users },
      error: authError,
    } = await supabase.auth.admin.listUsers();

    if (authError) throw authError;

    // 병합
    const merged = (profiles || []).map((profile) => {
      const authUser = users.find((u) => u.id === profile.id);
      return {
        ...profile,
        last_sign_in_at: authUser?.last_sign_in_at || null,
        email_confirmed_at: authUser?.email_confirmed_at || null,
      };
    });

    res.json({ success: true, data: merged });
  } catch (err) {
    log.error('List users error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// POST /api/admin/users - 새 사용자 생성 (관리자만)
// ============================================================
router.post('/users', async (req, res) => {
  try {
    const { email, username, password, display_name, role = 'vip1' } = req.body;

    const VALID_ROLES = ['admin', 'vip1', 'vip2', 'vip3', 'vip4', 'vip5', 'test_vip1', 'test_vip2', 'test_vip3', 'test_vip4', 'test_vip5'];
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        error: `역할은 ${VALID_ROLES.join(', ')} 중 하나여야 합니다.`,
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        error: '비밀번호는 최소 6자 이상이어야 합니다.',
      });
    }

    let authEmail;
    let userDisplayName;

    if (role === 'admin') {
      // 관리자: 이메일 필수
      if (!email) {
        return res.status(400).json({ success: false, error: '관리자는 이메일이 필수입니다.' });
      }
      authEmail = email;
      userDisplayName = display_name || email.split('@')[0];
    } else {
      // 일반/VIP/테스트 회원: 아이디 필수
      if (!username) {
        return res.status(400).json({ success: false, error: '아이디는 필수입니다.' });
      }
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        return res.status(400).json({
          success: false,
          error: '아이디는 영문, 숫자, 밑줄(_)만 사용하여 3~20자로 입력하세요.',
        });
      }
      authEmail = `${username}@sureodds.local`;
      userDisplayName = display_name || username;
    }

    // Supabase Admin API로 사용자 생성
    const { data, error } = await supabase.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: userDisplayName,
        role,
        username: role !== 'admin' ? username : undefined,
      },
    });

    if (error) {
      // 중복 이메일 에러를 아이디 중복으로 변환
      if (error.message.includes('already been registered') && role !== 'admin') {
        throw new Error('이미 사용 중인 아이디입니다.');
      }
      throw error;
    }

    // profiles 업데이트 (role, display_name, username 확실히 세팅)
    await supabase
      .from('profiles')
      .update({
        role,
        display_name: userDisplayName,
        username: role !== 'admin' ? username : null,
      })
      .eq('id', data.user.id);

    res.json({
      success: true,
      data: {
        id: data.user.id,
        email: authEmail,
        username: role !== 'admin' ? username : null,
        role,
        display_name: userDisplayName,
      },
    });
  } catch (err) {
    log.error('Create user error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// PATCH /api/admin/users/:id - 사용자 정보 수정
// ============================================================
router.patch('/users/:id', async (req, res) => {
  try {
    const { role, is_active, display_name, vip_expires_at, admin_memo, suspended_until, suspended_reason } = req.body;
    const updates = {};

    const VALID_ROLES = ['admin', 'vip1', 'vip2', 'vip3', 'vip4', 'vip5', 'test_vip1', 'test_vip2', 'test_vip3', 'test_vip4', 'test_vip5'];
    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ success: false, error: `유효하지 않은 역할입니다.` });
      }
      updates.role = role;
    }
    if (is_active !== undefined) updates.is_active = is_active;
    if (display_name !== undefined) updates.display_name = display_name;
    if (vip_expires_at !== undefined) updates.vip_expires_at = vip_expires_at;
    if (admin_memo !== undefined) updates.admin_memo = admin_memo;
    if (suspended_until !== undefined) updates.suspended_until = suspended_until;
    if (suspended_reason !== undefined) updates.suspended_reason = suspended_reason;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: '수정할 항목이 없습니다.',
      });
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, data });
  } catch (err) {
    log.error('Update user error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// PATCH /api/admin/users/:id/password - 비밀번호 변경 (관리자)
// ============================================================
router.patch('/users/:id/password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, error: '비밀번호는 최소 6자 이상이어야 합니다.' });
    }

    const { error } = await supabase.auth.admin.updateUserById(req.params.id, { password });
    if (error) throw error;

    log.info('Password changed by admin', { targetUserId: req.params.id, adminId: req.user.id });
    res.json({ success: true });
  } catch (err) {
    log.error('Change password error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/admin/users/:id/activity - 사용자 활동 로그 조회
// ============================================================
router.get('/users/:id/activity', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 30, 100);
    const offset = parseInt(req.query.offset) || 0;
    const action = req.query.action; // optional filter

    let query = supabase
      .from('user_activity_logs')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (action) {
      query = query.eq('action', action);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data: data || [] });
  } catch (err) {
    log.error('Get user activity error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/admin/users/:id/stats - 사용자 접속 통계
// ============================================================
router.get('/users/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    // 최근 30일 로그인 수
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: loginLogs, error } = await supabase
      .from('user_activity_logs')
      .select('created_at')
      .eq('user_id', id)
      .eq('action', 'login')
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // 일별 접속 횟수 계산 (최근 7일)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const dailyCounts = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split('T')[0];
      dailyCounts[key] = 0;
    }

    if (loginLogs) {
      for (const log of loginLogs) {
        const key = new Date(log.created_at).toISOString().split('T')[0];
        if (dailyCounts[key] !== undefined) {
          dailyCounts[key]++;
        }
      }
    }

    // 마지막 활동 시간
    const { data: lastActivity } = await supabase
      .from('user_activity_logs')
      .select('created_at, action')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    res.json({
      success: true,
      data: {
        totalLogins30d: loginLogs?.length || 0,
        dailyLogins7d: dailyCounts,
        lastActivity: lastActivity || null,
      },
    });
  } catch (err) {
    log.error('Get user stats error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// DELETE /api/admin/users/:id - 사용자 삭제
// ============================================================
router.delete('/users/:id', async (req, res) => {
  try {
    // 자기 자신 삭제 방지
    if (req.params.id === req.user.id) {
      return res.status(400).json({
        success: false,
        error: '자신의 계정은 삭제할 수 없습니다.',
      });
    }

    // auth.users 삭제 (CASCADE로 profiles도 삭제됨)
    const { error } = await supabase.auth.admin.deleteUser(req.params.id);
    if (error) throw error;

    res.json({ success: true, data: { deleted: req.params.id } });
  } catch (err) {
    log.error('Delete user error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/admin/site-registrations - 전체 사이트 등록 목록 (관리자)
// ============================================================
router.get('/site-registrations', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('site_registrations')
      .select('*, profiles:user_id(email, display_name, username)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // 민감정보 제거 (비밀번호, 세션 토큰)
    const safe = (data || []).map(({ login_pw_encrypted, session_token, ...rest }) => rest);
    res.json({ success: true, data: safe });
  } catch (err) {
    log.error('List site registrations error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// PATCH /api/admin/site-registrations/:id - 사이트 상태 변경 (관리자)
// ============================================================
router.patch('/site-registrations/:id', async (req, res) => {
  try {
    const { status, isActive } = req.body;
    const updates = {};
    if (status) updates.status = status;
    if (isActive !== undefined) updates.is_active = isActive;

    const { data, error } = await supabase
      .from('site_registrations')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (data) {
      delete data.login_pw_encrypted;
      delete data.session_token;
    }

    res.json({ success: true, data });
  } catch (err) {
    log.error('Update site registration error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /api/admin/site-requests - 전체 사이트 요청 목록 (관리자)
// ============================================================
router.get('/site-requests', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('site_requests')
      .select('*, profiles:user_id(email, display_name, username)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err) {
    log.error('List site requests error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// Available Sites 관리 (마스터 사이트 목록)
// ============================================================

// GET /api/admin/available-sites - 전체 목록
router.get('/available-sites', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('available_sites')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, data: data || [] });
  } catch (err) {
    log.error('List available sites error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/admin/available-sites - 새 사이트 추가
router.post('/available-sites', async (req, res) => {
  try {
    const { siteUrl, siteName, description } = req.body;

    if (!siteUrl || !siteName) {
      return res.status(400).json({ success: false, error: '사이트 URL과 이름은 필수입니다.' });
    }

    const { data, error } = await supabase
      .from('available_sites')
      .insert({ site_url: siteUrl.trim(), site_name: siteName.trim(), description: description || null })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    log.error('Create available site error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/admin/available-sites/:id - 수정
router.patch('/available-sites/:id', async (req, res) => {
  try {
    const { siteName, siteUrl, description, isActive } = req.body;
    const updates = {};
    if (siteName !== undefined) updates.site_name = siteName;
    if (siteUrl !== undefined) updates.site_url = siteUrl;
    if (description !== undefined) updates.description = description;
    if (isActive !== undefined) updates.is_active = isActive;

    const { data, error } = await supabase
      .from('available_sites')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    log.error('Update available site error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/admin/available-sites/:id - 삭제 (연관 사이트 등록도 함께 삭제)
router.delete('/available-sites/:id', async (req, res) => {
  try {
    // 1. Get the site info first (to find site_url for cascading delete)
    const { data: site, error: fetchError } = await supabase
      .from('available_sites')
      .select('site_url, site_name')
      .eq('id', req.params.id)
      .single();

    if (fetchError) throw fetchError;

    // 2. Delete all user site_registrations with matching site_url
    const { error: regError } = await supabase
      .from('site_registrations')
      .delete()
      .eq('site_url', site.site_url);

    if (regError) {
      log.warn('Error deleting related site_registrations', { error: regError.message });
    }

    // 3. Delete the available_site itself
    const { error } = await supabase
      .from('available_sites')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;

    log.info(`Deleted available site: ${site.site_name} (${site.site_url}) and related registrations`);
    res.json({ success: true });
  } catch (err) {
    log.error('Delete available site error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// 앱 설정 (app_settings 테이블)
// ============================================================

// GET /api/admin/settings - 전체 설정 조회
router.get('/settings', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('*');

    if (error) throw error;

    // key-value 형태로 변환
    const settings = {};
    (data || []).forEach((row) => {
      settings[row.key] = row.value;
    });

    res.json({ success: true, data: settings });
  } catch (err) {
    // 테이블이 없으면 기본값 반환
    log.error('Get settings error', { error: err.message });
    res.json({ success: true, data: {} });
  }
});

// PATCH /api/admin/settings - 설정 변경 (upsert)
router.patch('/settings', async (req, res) => {
  try {
    const { key, value } = req.body;

    if (!key) {
      return res.status(400).json({ success: false, error: '설정 키가 필요합니다.' });
    }

    const { error } = await supabase
      .from('app_settings')
      .upsert(
        { key, value: JSON.stringify(value), updated_at: new Date().toISOString(), updated_by: req.user.id },
        { onConflict: 'key' }
      );

    if (error) throw error;

    log.info(`Setting updated: ${key} = ${JSON.stringify(value)} by ${req.user.id}`);
    res.json({ success: true });
  } catch (err) {
    log.error('Update setting error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
