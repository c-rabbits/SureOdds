/**
 * User Activity Logger
 *
 * Fire-and-forget 방식으로 사용자 활동을 user_activity_logs 테이블에 기록.
 * 응답 지연 없이 비동기로 처리.
 */

const supabase = require('../config/supabase');
const { createServiceLogger } = require('../config/logger');

const log = createServiceLogger('ActivityLogger');

/**
 * 활동 로그 기록 (fire-and-forget).
 * @param {string} userId - 유저 UUID
 * @param {string} action - 액션 타입 (login, logout, page_view, match_click, setting_change, telegram_link, telegram_unlink)
 * @param {object} [detail={}] - 추가 정보 (path, matchId, setting 등)
 * @param {string} [ip] - IP 주소
 * @param {string} [userAgent] - User-Agent 문자열
 */
function logActivity(userId, action, detail = {}, ip = null, userAgent = null) {
  if (!userId || !action) return;

  supabase
    .from('user_activity_logs')
    .insert({
      user_id: userId,
      action,
      detail,
      ip_address: ip,
      user_agent: userAgent,
    })
    .then(({ error }) => {
      if (error) {
        log.error('Failed to log activity', { userId, action, error: error.message });
      }
    })
    .catch((err) => {
      log.error('Activity log error', { userId, action, error: err.message });
    });
}

/**
 * Express 요청에서 IP와 User-Agent를 추출.
 */
function getRequestInfo(req) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.headers['x-real-ip']
    || req.socket?.remoteAddress
    || null;
  const userAgent = req.headers['user-agent'] || null;
  return { ip, userAgent };
}

module.exports = { logActivity, getRequestInfo };
