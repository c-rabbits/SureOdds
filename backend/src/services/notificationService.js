/**
 * Notification Service (Phase 3)
 *
 * 통합 알림 게이트웨이.
 * Telegram + Web Push 병렬 발송 + 알림 히스토리 DB 저장.
 * alert_preferences 테이블로 유저별 유형별 채널 on/off 체크.
 */

const supabase = require('../config/supabase');
const { createServiceLogger } = require('../config/logger');
const {
  sendArbitrageAlert,
  sendSessionExpiryAlert,
  sendToAllLinkedUsers,
  buildValueBetMessage,
  buildDailyDigestMessage,
} = require('./telegramBot');
const { isConfigured: isPushConfigured, sendPushToAll, sendPushToUser } = require('./webPushService');

const log = createServiceLogger('Notification');

/**
 * 알림 유형별 Push 페이로드 생성.
 */
function buildPushPayload(type, payload) {
  switch (type) {
    case 'arbitrage': {
      const { opportunity, match } = payload;
      return {
        title: `⚡ 양방 +${opportunity.profit_percent.toFixed(1)}%`,
        body: `${match.home_team} vs ${match.away_team}`,
        icon: '/icon-192.png',
        url: `/?match=${match.id}`,
        tag: `arb-${match.id}`,
      };
    }
    case 'value_bet': {
      const { valueBets, match } = payload;
      const topEdge = valueBets[0]?.edge || 0;
      return {
        title: `🎯 밸류베팅 +${(topEdge * 100).toFixed(1)}%`,
        body: `${match.home_team} vs ${match.away_team}`,
        icon: '/icon-192.png',
        url: `/ai/match/${match.id}`,
        tag: `vb-${match.id}`,
      };
    }
    case 'daily_digest': {
      return {
        title: '📋 일일 AI 요약',
        body: `오늘 ${payload.todayPredictions}경기 예측, ${payload.todayValueBets}건 밸류베팅`,
        icon: '/icon-192.png',
        url: '/ai',
        tag: 'daily-digest',
      };
    }
    case 'session_expiry': {
      return {
        title: '⚠️ 세션 만료',
        body: `${payload.siteName} 세션이 만료되었습니다.`,
        icon: '/icon-192.png',
        url: '/domestic',
        tag: `session-${payload.siteName}`,
      };
    }
    default:
      return null;
  }
}

/**
 * 알림 히스토리 제목/내용 생성.
 */
function buildNotificationRecord(type, payload) {
  const pushPayload = buildPushPayload(type, payload);
  if (!pushPayload) return null;

  return {
    type,
    title: pushPayload.title,
    body: pushPayload.body,
    data: { url: pushPayload.url },
  };
}

/**
 * 통합 알림 발송 (Telegram + Web Push 병렬 + DB 히스토리).
 */
async function sendNotification(type, payload) {
  const results = { telegram: null, push: null };

  try {
    // ── 히스토리 저장 (모든 활성 유저에게) ──
    saveNotificationHistory(type, payload).catch((err) => {
      log.error('Failed to save notification history', { error: err.message });
    });

    // ── Telegram + Web Push 병렬 발송 ──
    const [tgResult, pushResult] = await Promise.allSettled([
      sendTelegram(type, payload),
      sendPush(type, payload),
    ]);

    results.telegram = tgResult.status === 'fulfilled' ? tgResult.value : { sent: 0, failed: 1 };
    results.push = pushResult.status === 'fulfilled' ? pushResult.value : { sent: 0, failed: 1 };

    const totalSent = (results.telegram?.sent || 0) + (results.push?.sent || 0);
    if (totalSent > 0) {
      log.info(`[${type}] Sent: TG=${results.telegram?.sent || 0}, Push=${results.push?.sent || 0}`);
    }

    return results;
  } catch (err) {
    log.error(`Notification send failed [${type}]`, { error: err.message });
    return results;
  }
}

/**
 * 알림 히스토리를 DB에 저장 (모든 활성 유저).
 */
async function saveNotificationHistory(type, payload) {
  const record = buildNotificationRecord(type, payload);
  if (!record) return;

  // session_expiry는 특정 유저에게만
  if (type === 'session_expiry' && payload.userId) {
    await supabase.from('notifications').insert({
      user_id: payload.userId,
      ...record,
    });
    return;
  }

  // 나머지는 모든 활성 유저에게
  const { data: users } = await supabase
    .from('profiles')
    .select('id')
    .eq('is_active', true);

  if (!users || users.length === 0) return;

  const rows = users.map((u) => ({
    user_id: u.id,
    ...record,
  }));

  // 배치 삽입 (50건씩)
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    await supabase.from('notifications').insert(batch);
  }
}

/**
 * 유저별 알림 설정 조회.
 * 설정이 없으면 기본값(모든 채널 활성)을 반환.
 */
async function getUserPreference(userId, type) {
  try {
    const { data } = await supabase
      .from('alert_preferences')
      .select('telegram_enabled, push_enabled, min_threshold')
      .eq('user_id', userId)
      .eq('alert_type', type)
      .single();

    return data || { telegram_enabled: true, push_enabled: true, min_threshold: 0 };
  } catch {
    return { telegram_enabled: true, push_enabled: true, min_threshold: 0 };
  }
}

/**
 * Telegram 발송.
 */
async function sendTelegram(type, payload) {
  switch (type) {
    case 'arbitrage': {
      const { opportunity, match } = payload;
      await sendArbitrageAlert(opportunity, match);
      return { sent: 1, failed: 0 };
    }
    case 'value_bet': {
      const { valueBets, match, confidence } = payload;
      const message = buildValueBetMessage(valueBets, match, confidence);
      return await sendToAllLinkedUsers(message);
    }
    case 'daily_digest': {
      const message = buildDailyDigestMessage(payload);
      return await sendToAllLinkedUsers(message);
    }
    case 'session_expiry': {
      const { userId, siteName } = payload;
      await sendSessionExpiryAlert(userId, siteName);
      return { sent: 1, failed: 0 };
    }
    default:
      return { sent: 0, failed: 0 };
  }
}

/**
 * Web Push 발송 — 유저별 preference 체크.
 */
async function sendPush(type, payload) {
  if (!isPushConfigured()) return { sent: 0, failed: 0 };

  const pushPayload = buildPushPayload(type, payload);
  if (!pushPayload) return { sent: 0, failed: 0 };

  if (type === 'session_expiry' && payload.userId) {
    return await sendPushToUser(payload.userId, pushPayload);
  }

  // 양방/밸류베팅: 유저별 push_enabled + threshold 체크
  if (type === 'arbitrage' || type === 'value_bet') {
    const profitPercent = type === 'arbitrage'
      ? (payload.opportunity?.profit_percent ?? 0)
      : ((payload.valueBets?.[0]?.edge ?? 0) * 100);

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('user_id, subscription')
      .eq('is_active', true);

    if (!subs || subs.length === 0) return { sent: 0, failed: 0 };

    // 유저 ID 목록으로 preference 일괄 조회
    const userIds = [...new Set(subs.map(s => s.user_id))];
    const { data: prefs } = await supabase
      .from('alert_preferences')
      .select('user_id, push_enabled, min_threshold')
      .eq('alert_type', type)
      .in('user_id', userIds);

    const prefMap = {};
    if (prefs) for (const p of prefs) prefMap[p.user_id] = p;

    let sent = 0, failed = 0;
    for (const sub of subs) {
      const pref = prefMap[sub.user_id];
      // push 비활성화 스킵
      if (pref && pref.push_enabled === false) continue;
      // threshold 체크
      if (pref && pref.min_threshold > 0 && profitPercent < pref.min_threshold) continue;

      try {
        await sendPushToUser(sub.user_id, pushPayload);
        sent++;
      } catch { failed++; }
    }
    return { sent, failed };
  }

  return await sendPushToAll(pushPayload);
}

module.exports = { sendNotification };
