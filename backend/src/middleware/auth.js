/**
 * SureOdds - JWT 인증 미들웨어
 * Supabase Auth 토큰을 검증하고 사용자 프로필을 req.user에 할당
 */
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Supabase가 설정되었는지 확인 (실제 인증에는 진짜 Supabase 필요)
const isSupabaseConfigured = !!(supabaseUrl && supabaseServiceKey);

// supabase 인스턴스는 공유 config에서 가져옴
const supabase = require('../config/supabase');

/**
 * JWT 토큰 검증 + 프로필 조회 미들웨어
 * Authorization: Bearer <token> 헤더 필요
 */
async function requireAuth(req, res, next) {
  // Supabase가 설정되지 않으면 인증 불가
  if (!isSupabaseConfigured) {
    return res.status(503).json({
      success: false,
      error: 'Supabase가 설정되지 않았습니다. 인증 기능을 사용하려면 Supabase를 설정하세요.',
    });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: '인증이 필요합니다.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Supabase 서버사이드 토큰 검증
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        success: false,
        error: '유효하지 않은 토큰입니다.',
      });
    }

    // profiles 테이블에서 역할/활성 상태 조회
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(401).json({
        success: false,
        error: '프로필을 찾을 수 없습니다.',
      });
    }

    // 비활성 계정 차단
    if (!profile.is_active) {
      return res.status(403).json({
        success: false,
        error: '비활성화된 계정입니다. 관리자에게 문의하세요.',
      });
    }

    // req.user에 사용자 정보 할당
    req.user = {
      id: user.id,
      email: user.email,
      profile,
    };

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(401).json({
      success: false,
      error: '인증 오류가 발생했습니다.',
    });
  }
}

/**
 * 관리자 역할 확인 미들웨어
 * requireAuth 이후에 사용해야 함
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.profile.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: '관리자 권한이 필요합니다.',
    });
  }
  next();
}

module.exports = { requireAuth, requireAdmin };
