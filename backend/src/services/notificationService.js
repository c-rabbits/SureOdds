/**
 * Notification Service (Phase 3)
 *
 * 통합 알림 게이트웨이.
 * 모든 알림(양방, 밸류베팅, 일일 요약, 세션 만료)을 중앙에서 관리.
 * Telegram + Web Push 병렬 발송.
 */

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
        url: '/',
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
 * 통합 알림 발송 (Telegram + Web Push 병렬).
 * @param {'arbitrage'|'value_bet'|'daily_digest'|'session_expiry'} type
 * @param {Object} payload - 알림별 데이터
 */
async function sendNotification(type, payload) {
  const results = { telegram: null, push: null };

  try {
    // ── Telegram 발송 ──
    const telegramPromise = sendTelegram(type, payload);

    // ── Web Push 발송 ──
    const pushPromise = sendPush(type, payload);

    // 병렬 실행
    const [tgResult, pushResult] = await Promise.allSettled([telegramPromise, pushPromise]);

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
 * Telegram 발송 (기존 로직).
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
 * Web Push 발송.
 */
async function sendPush(type, payload) {
  if (!isPushConfigured()) return { sent: 0, failed: 0 };

  const pushPayload = buildPushPayload(type, payload);
  if (!pushPayload) return { sent: 0, failed: 0 };

  // session_expiry는 특정 유저에게만 발송
  if (type === 'session_expiry' && payload.userId) {
    return await sendPushToUser(payload.userId, pushPayload);
  }

  // 나머지는 전체 구독자에게 발송
  return await sendPushToAll(pushPayload);
}

module.exports = { sendNotification };
