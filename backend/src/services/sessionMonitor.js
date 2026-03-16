/**
 * SureOdds - 세션 모니터링 서비스
 * 주기적으로 국내 사이트 세션 유효성을 검사하고 만료 시 알림 발송
 */

const supabase = require('../config/supabase');
const { getAdapter } = require('../adapters');
const { sendNotification } = require('./notificationService');
const { createServiceLogger } = require('../config/logger');

const log = createServiceLogger('SessionMonitor');

const CHECK_INTERVAL = 5 * 60 * 1000; // 5분
const EXPIRY_WARNING_MINUTES = 10; // 만료 10분 전 경고

let intervalId = null;

/**
 * 활성 세션들의 유효성 검사
 */
async function checkSessions() {
  try {
    // 활성 세션 조회 (어댑터가 설정된 사이트만)
    const { data: registrations, error } = await supabase
      .from('site_registrations')
      .select('*, available_sites(*)')
      .eq('is_active', true)
      .eq('session_status', 'active');

    if (error) {
      log.error('Failed to fetch active sessions', { error: error.message });
      return;
    }

    if (!registrations || registrations.length === 0) {
      return; // 검사할 세션 없음
    }

    log.info(`Checking ${registrations.length} active sessions`);

    for (const reg of registrations) {
      const avSite = reg.available_sites;
      if (!avSite?.adapter_key) continue;

      try {
        const adapter = getAdapter(avSite.adapter_key, avSite);
        const result = await adapter.validateSession(reg.session_token);

        if (result.valid) {
          // 세션 유효 → last_checked 업데이트
          await supabase
            .from('site_registrations')
            .update({
              session_last_checked_at: new Date().toISOString(),
              ...(result.expiresAt && { session_expires_at: result.expiresAt }),
            })
            .eq('id', reg.id);
        } else {
          // 세션 만료 → 상태 변경 + 알림
          await supabase
            .from('site_registrations')
            .update({
              session_status: 'expired',
              session_error: '세션이 만료되었습니다.',
              session_last_checked_at: new Date().toISOString(),
            })
            .eq('id', reg.id);

          // 텔레그램 알림 (상태 전환 시 1회)
          await sendNotification('session_expiry', { userId: reg.user_id, siteName: reg.site_name });
          log.info(`Session expired: ${reg.site_name} for user ${reg.user_id}`);
        }
      } catch (err) {
        log.error(`Session check error for ${reg.site_name}`, { error: err.message });
      }
    }

    // 시간 기반 만료 경고 (expires_at이 설정된 경우)
    await checkExpiringSessionsByTime();
  } catch (err) {
    log.error('Session monitor error', { error: err.message });
  }
}

/**
 * 시간 기반 세션 만료 체크 (어댑터 없이도 동작)
 */
async function checkExpiringSessionsByTime() {
  const warningTime = new Date(Date.now() + EXPIRY_WARNING_MINUTES * 60 * 1000).toISOString();

  const { data: expiring, error } = await supabase
    .from('site_registrations')
    .select('*')
    .eq('is_active', true)
    .eq('session_status', 'active')
    .not('session_expires_at', 'is', null)
    .lt('session_expires_at', warningTime);

  if (error || !expiring) return;

  for (const reg of expiring) {
    const now = new Date();
    const expiresAt = new Date(reg.session_expires_at);

    if (expiresAt <= now) {
      // 이미 만료됨
      await supabase
        .from('site_registrations')
        .update({
          session_status: 'expired',
          session_error: '세션 유효시간이 초과되었습니다.',
          session_last_checked_at: now.toISOString(),
        })
        .eq('id', reg.id);

      await sendNotification('session_expiry', { userId: reg.user_id, siteName: reg.site_name });
      log.info(`Session time-expired: ${reg.site_name} for user ${reg.user_id}`);
    }
  }
}

/**
 * 세션 모니터 시작
 */
function startSessionMonitor() {
  if (intervalId) {
    log.warn('Session monitor already running');
    return;
  }

  log.info(`Session monitor started (interval: ${CHECK_INTERVAL / 1000}s)`);
  intervalId = setInterval(checkSessions, CHECK_INTERVAL);

  // 시작 후 1분 뒤 첫 체크
  setTimeout(checkSessions, 60 * 1000);
}

/**
 * 세션 모니터 중지
 */
function stopSessionMonitor() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    log.info('Session monitor stopped');
  }
}

module.exports = { startSessionMonitor, stopSessionMonitor, checkSessions };
