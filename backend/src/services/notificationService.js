/**
 * Notification Service (Phase 3 Step 1)
 *
 * 통합 알림 게이트웨이.
 * 모든 알림(양방, 밸류베팅, 일일 요약, 세션 만료)을 중앙에서 관리.
 * 현재: Telegram 채널만 지원.
 * 향후: Web Push, 알림 히스토리 DB 저장 등 확장 예정.
 */

const { createServiceLogger } = require('../config/logger');
const {
  sendArbitrageAlert,
  sendSessionExpiryAlert,
  sendToAllLinkedUsers,
  buildValueBetMessage,
  buildDailyDigestMessage,
} = require('./telegramBot');

const log = createServiceLogger('Notification');

/**
 * 통합 알림 발송.
 * @param {'arbitrage'|'value_bet'|'daily_digest'|'session_expiry'} type
 * @param {Object} payload - 알림별 데이터
 * @returns {Promise<{ sent: number, failed: number }>}
 */
async function sendNotification(type, payload) {
  try {
    switch (type) {
      case 'arbitrage': {
        const { opportunity, match } = payload;
        await sendArbitrageAlert(opportunity, match);
        log.info(`Arbitrage notification sent: ${match.home_team} vs ${match.away_team}`);
        return { sent: 1, failed: 0 };
      }

      case 'value_bet': {
        const { valueBets, match, confidence } = payload;
        const message = buildValueBetMessage(valueBets, match, confidence);
        const result = await sendToAllLinkedUsers(message);
        log.info(`Value bet notification: ${match.home_team} vs ${match.away_team} → ${result.sent} sent`);
        return result;
      }

      case 'daily_digest': {
        const message = buildDailyDigestMessage(payload);
        const result = await sendToAllLinkedUsers(message);
        log.info(`Daily digest sent → ${result.sent} sent`);
        return result;
      }

      case 'session_expiry': {
        const { userId, siteName } = payload;
        await sendSessionExpiryAlert(userId, siteName);
        log.info(`Session expiry notification: ${siteName} for user ${userId}`);
        return { sent: 1, failed: 0 };
      }

      default:
        log.warn(`Unknown notification type: ${type}`);
        return { sent: 0, failed: 0 };
    }
  } catch (err) {
    log.error(`Notification send failed [${type}]`, { error: err.message });
    return { sent: 0, failed: 1 };
  }
}

module.exports = { sendNotification };
