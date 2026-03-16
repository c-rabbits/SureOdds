/**
 * Web Push Service (Phase 3 Step 2)
 *
 * VAPID 기반 Web Push 알림 발송.
 * push_subscriptions 테이블에서 구독 정보를 조회하여 발송.
 * 410 Gone 응답 시 stale 구독 자동 삭제.
 */

const webpush = require('web-push');
const supabase = require('../config/supabase');
const { createServiceLogger } = require('../config/logger');

const log = createServiceLogger('WebPush');

let initialized = false;

/**
 * VAPID 키로 web-push 초기화.
 */
function init() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@sureodds.com';

  if (!publicKey || !privateKey) {
    log.warn('VAPID keys not configured. Web Push disabled. Run: node scripts/generateVapidKeys.js');
    return;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  initialized = true;
  log.info('Web Push initialized with VAPID keys');
}

/**
 * Web Push가 사용 가능한지 확인.
 */
function isConfigured() {
  return initialized;
}

/**
 * 특정 유저의 모든 구독에 푸시 발송.
 * @param {string} userId
 * @param {Object} payload - { title, body, icon, url, data }
 * @returns {{ sent: number, failed: number, cleaned: number }}
 */
async function sendPushToUser(userId, payload) {
  if (!initialized) return { sent: 0, failed: 0, cleaned: 0 };

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, keys_p256dh, keys_auth')
    .eq('user_id', userId);

  if (error || !subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0, cleaned: 0 };
  }

  return sendToSubscriptions(subscriptions, payload);
}

/**
 * 모든 구독자에게 푸시 발송.
 * @param {Object} payload - { title, body, icon, url, data }
 * @returns {{ sent: number, failed: number, cleaned: number }}
 */
async function sendPushToAll(payload) {
  if (!initialized) return { sent: 0, failed: 0, cleaned: 0 };

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, keys_p256dh, keys_auth');

  if (error || !subscriptions || subscriptions.length === 0) {
    return { sent: 0, failed: 0, cleaned: 0 };
  }

  return sendToSubscriptions(subscriptions, payload);
}

/**
 * 구독 목록에 실제 푸시 발송.
 */
async function sendToSubscriptions(subscriptions, payload) {
  const payloadStr = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  let cleaned = 0;

  const results = await Promise.allSettled(
    subscriptions.map((sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.keys_p256dh,
          auth: sub.keys_auth,
        },
      };
      return webpush.sendNotification(pushSubscription, payloadStr);
    })
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const sub = subscriptions[i];

    if (result.status === 'fulfilled') {
      sent++;
    } else {
      failed++;
      const statusCode = result.reason?.statusCode;

      // 410 Gone 또는 404 = 구독 만료 → 자동 삭제
      if (statusCode === 410 || statusCode === 404) {
        try {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('id', sub.id);
          cleaned++;
          log.info(`Cleaned stale push subscription: ${sub.id}`);
        } catch (delErr) {
          log.error('Failed to clean stale subscription', { error: delErr.message });
        }
      } else {
        log.error(`Push send failed for ${sub.id}`, {
          statusCode,
          error: result.reason?.message,
        });
      }
    }
  }

  if (sent > 0 || cleaned > 0) {
    log.info(`Push sent: ${sent}, failed: ${failed}, cleaned: ${cleaned}`);
  }

  return { sent, failed, cleaned };
}

module.exports = { init, isConfigured, sendPushToUser, sendPushToAll };
