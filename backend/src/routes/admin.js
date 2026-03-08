/**
 * SureOdds - 관리자 라우트
 * /api/admin
 * 모든 라우트에 requireAuth + requireAdmin 적용
 */
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { requireAuth, requireAdmin } = require('../middleware/auth');

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
    console.error('List users error:', err);
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
    console.error('Create user error:', err);
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
    console.error('Update user error:', err);
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
    console.error('Delete user error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
