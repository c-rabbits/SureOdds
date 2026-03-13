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
    const { email, password, display_name, role = 'user' } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: '이메일과 비밀번호는 필수입니다.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: '비밀번호는 최소 6자 이상이어야 합니다.',
      });
    }

    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: '역할은 admin 또는 user만 가능합니다.',
      });
    }

    // Supabase Admin API로 사용자 생성 (이메일 확인 건너뜀)
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: display_name || email.split('@')[0],
        role,
      },
    });

    if (error) throw error;

    // 트리거로 profiles 생성되지만, role이 admin인 경우 확실히 업데이트
    if (role === 'admin' || display_name) {
      await supabase
        .from('profiles')
        .update({
          role,
          display_name: display_name || email.split('@')[0],
        })
        .eq('id', data.user.id);
    }

    res.json({
      success: true,
      data: {
        id: data.user.id,
        email: data.user.email,
        role,
        display_name: display_name || email.split('@')[0],
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
    const { role, is_active, display_name } = req.body;
    const updates = {};

    if (role !== undefined) {
      if (!['admin', 'user'].includes(role)) {
        return res.status(400).json({
          success: false,
          error: '역할은 admin 또는 user만 가능합니다.',
        });
      }
      updates.role = role;
    }
    if (is_active !== undefined) updates.is_active = is_active;
    if (display_name !== undefined) updates.display_name = display_name;

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
      .select('*, profiles:user_id(email, display_name)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Strip encrypted passwords
    const safe = (data || []).map(({ login_pw_encrypted, ...rest }) => rest);
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
    if (data) delete data.login_pw_encrypted;

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
      .select('*, profiles:user_id(email, display_name)')
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

// DELETE /api/admin/available-sites/:id - 삭제
router.delete('/available-sites/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('available_sites')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    log.error('Delete available site error', { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
