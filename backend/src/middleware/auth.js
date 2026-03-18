/**
 * SureOdds - JWT 인증 미들웨어
 * Supabase Auth 토큰을 검증하고 사용자 프로필을 req.user에 할당
 */
require('dotenv').config();
const { createServiceLogger } = require('../config/logger');

const { logActivity, getRequestInfo } = require('../services/activityLogger');
const log = createServiceLogger('Auth');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

// Supabase가 설정되었는지 확인 (실제 인증에는 진짜 Supabase 필요)
const isSupabaseConfigured = !!(supabaseUrl && supabaseServiceKey);

// supabase 인스턴스는 공유 config에서 가져옴
const supabase = require('../config/supabase');

/**
 * 헬퍼: app_settings에서 설정값 읽기
 */
async function getSettingValue(sb, key, defaultValue) {
  try {
    const { data } = await sb
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .single();
    if (data) return JSON.parse(data.value);
  } catch { /* ignore */ }
  return defaultValue;
}

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
      log.error('Token verification failed', { error: error?.message, errorCode: error?.code, hasUser: !!user });
      return res.status(401).json({
        success: false,
        error: '유효하지 않은 토큰입니다.',
        debug: error?.message,
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

    // 중복 로그인 세션 유효성 체크 (관리자는 통과, /api/auth/login은 제외)
    const isLoginRoute = req.originalUrl === '/api/auth/login';
    if (profile.role !== 'admin' && !isLoginRoute) {
      try {
        const allowConcurrent = await getSettingValue(supabase, 'allow_concurrent_login', true);

        if (!allowConcurrent) {
          const tokenPrefix = token.substring(0, 50);

          // 이 유저의 유효 세션이 하나라도 있는지 확인
          const { data: allSessions } = await supabase
            .from('active_sessions')
            .select('id, session_token, is_valid')
            .eq('user_id', user.id)
            .eq('is_valid', true);

          if (allSessions && allSessions.length > 0) {
            // 유효 세션이 있지만 현재 토큰과 일치하는 게 없으면 → 다른 기기에서 로그인됨
            const mySession = allSessions.find(s => s.session_token === tokenPrefix);

            if (!mySession) {
              return res.status(401).json({
                success: false,
                error: '다른 기기에서 로그인되어 현재 세션이 종료되었습니다.',
                code: 'SESSION_EXPIRED',
              });
            }

            // last_seen_at 업데이트
            await supabase
              .from('active_sessions')
              .update({ last_seen_at: new Date().toISOString() })
              .eq('id', mySession.id);
          }
          // allSessions가 비어있으면 → 아직 세션 등록 전 (로그인 직후) → 통과
        }
      } catch {
        // active_sessions 테이블 없거나 조회 실패 시 통과
      }
    }

    // 유지보수 모드 체크 (관리자 + test_vip*는 통과)
    const bypassMaintenance = profile.role === 'admin' || profile.role.startsWith('test_');
    if (!bypassMaintenance) {
      try {
        const { data: setting } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'maintenance_mode')
          .single();

        if (setting && JSON.parse(setting.value) === true) {
          return res.status(503).json({
            success: false,
            error: '유지보수 중입니다. 잠시 후 다시 이용해 주세요.',
            maintenance: true,
          });
        }
      } catch {
        // app_settings 테이블 없거나 조회 실패 시 통과
      }
    }

    // 활동 로그 (fire-and-forget) — 빈번한 폴링 경로 제외
    const skipPaths = ['/api/auth/', '/api/notifications/unread-count', '/api/admin/settings'];
    const shouldLog = !skipPaths.some(p => req.originalUrl.startsWith(p));
    if (shouldLog) {
      const { ip, userAgent } = getRequestInfo(req);
      logActivity(user.id, 'page_view', { path: req.originalUrl, method: req.method }, ip, userAgent);
    }

    next();
  } catch (err) {
    log.error('Auth middleware error', { error: err.message });
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
