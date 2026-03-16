const TelegramBot = require('node-telegram-bot-api');
const { createServiceLogger } = require('../config/logger');
require('dotenv').config();

const log = createServiceLogger('Telegram');

let bot = null;

function getBot() {
  if (!bot && process.env.TELEGRAM_BOT_TOKEN) {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
  }
  return bot;
}

/**
 * 알림 메시지 포맷 생성 (재사용 가능)
 */
function buildAlertMessage(opportunity, match) {
  const profit = opportunity.profit_percent.toFixed(2);

  let marketLabel;
  let oddsText;

  if (opportunity.market_type === 'h2h') {
    const is3way = !!opportunity.odds_draw;
    marketLabel = is3way ? '승무패 (1X2)' : '승패 (12)';
    oddsText = `🏠 홈  (${opportunity.bookmaker_a}): ${opportunity.odds_a}\n`;
    if (is3way) {
      oddsText += `🤝 무승부  (${opportunity.bookmaker_draw}): ${opportunity.odds_draw}\n`;
    }
    oddsText += `✈️ 원정  (${opportunity.bookmaker_b}): ${opportunity.odds_b}`;
  } else if (opportunity.market_type === 'spreads') {
    marketLabel = `핸디캡 ${opportunity.handicap_point > 0 ? '+' : ''}${opportunity.handicap_point}`;
    oddsText = `🏠 홈 ${opportunity.handicap_point}  (${opportunity.bookmaker_a}): ${opportunity.odds_a}\n`;
    oddsText += `✈️ 원정 ${-opportunity.handicap_point}  (${opportunity.bookmaker_b}): ${opportunity.odds_b}`;
  } else if (opportunity.market_type === 'totals') {
    marketLabel = `오버/언더 ${opportunity.handicap_point}`;
    oddsText = `⬆️ 오버 ${opportunity.handicap_point}  (${opportunity.bookmaker_a}): ${opportunity.odds_a}\n`;
    oddsText += `⬇️ 언더 ${opportunity.handicap_point}  (${opportunity.bookmaker_b}): ${opportunity.odds_b}`;
  } else {
    marketLabel = opportunity.market_type;
    oddsText = `A (${opportunity.bookmaker_a}): ${opportunity.odds_a}\nB (${opportunity.bookmaker_b}): ${opportunity.odds_b}`;
  }

  return `
⚡ *양방 기회 발견!*

🏆 *${match.league}*
⚽ ${match.home_team} vs ${match.away_team}
🕐 ${new Date(match.start_time).toLocaleString('ko-KR')}

📊 마켓: ${marketLabel}
${oddsText}

💰 *수익률: +${profit}%*

_${new Date().toLocaleString('ko-KR')} 탐지_
  `.trim();
}

/**
 * 모든 연동된 유저 + 관리자 채널에 양방 알림 발송
 */
async function sendArbitrageAlert(opportunity, match) {
  const b = getBot();
  if (!b) {
    log.info('Telegram bot not configured. Skipping notification.');
    return;
  }

  const message = buildAlertMessage(opportunity, match);

  // 1) 관리자 채널 (기존 환경변수)
  const adminChatId = process.env.TELEGRAM_CHAT_ID;
  const chatIds = [];

  if (adminChatId) {
    chatIds.push({ chatId: adminChatId, userId: null, isAdmin: true });
  }

  // 2) 연동된 유저들 조회
  try {
    const supabase = require('../config/supabase');
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, telegram_chat_id')
      .not('telegram_chat_id', 'is', null)
      .eq('is_active', true);

    if (!error && users) {
      for (const user of users) {
        // 관리자 채널과 중복 방지
        if (user.telegram_chat_id !== adminChatId) {
          chatIds.push({ chatId: user.telegram_chat_id, userId: user.id, isAdmin: false });
        }
      }
    }
  } catch (err) {
    log.error('Failed to fetch telegram users', { error: err.message });
  }

  if (chatIds.length === 0) {
    log.info('No telegram recipients. Skipping notification.');
    return;
  }

  // 3) 병렬 발송
  const results = await Promise.allSettled(
    chatIds.map(({ chatId }) =>
      b.sendMessage(chatId, message, { parse_mode: 'Markdown' })
    )
  );

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const { chatId, userId } = chatIds[i];

    if (result.status === 'fulfilled') {
      sent++;
    } else {
      failed++;
      const errMsg = result.reason?.message || '';
      log.error(`Failed to send to chatId=${chatId}`, { error: errMsg });

      // 403 = 봇 차단됨 → 자동 연동 해제
      if (errMsg.includes('403') && userId) {
        try {
          const supabase = require('../config/supabase');
          await supabase
            .from('profiles')
            .update({ telegram_chat_id: null, telegram_linked_at: null })
            .eq('id', userId);
          log.info(`Auto-unlinked blocked user: ${userId}`);
        } catch (unlinkErr) {
          log.error('Failed to auto-unlink', { error: unlinkErr.message });
        }
      }
    }
  }

  log.info(`Alert sent: ${match.home_team} vs ${match.away_team} → ${sent} ok, ${failed} failed`);
}

/**
 * 세션 만료 알림을 특정 유저에게 발송
 * @param {string} userId - 유저 UUID
 * @param {string} siteName - 만료된 사이트 이름
 */
async function sendSessionExpiryAlert(userId, siteName) {
  const b = getBot();
  if (!b) return;

  try {
    const supabase = require('../config/supabase');
    const { data: profile } = await supabase
      .from('profiles')
      .select('telegram_chat_id')
      .eq('id', userId)
      .single();

    if (!profile?.telegram_chat_id) {
      log.info(`Session expiry alert skipped: user ${userId} has no telegram`);
      return;
    }

    const message = `⚠️ *세션 만료 알림*\n\n`
      + `📌 *${siteName}* 사이트의 세션이 만료되었습니다.\n`
      + `크롤링이 중단된 상태입니다.\n\n`
      + `SureOdds에서 재로그인해주세요.`;

    await b.sendMessage(profile.telegram_chat_id, message, { parse_mode: 'Markdown' });
    log.info(`Session expiry alert sent to user ${userId} for ${siteName}`);
  } catch (err) {
    log.error('Failed to send session expiry alert', { userId, siteName, error: err.message });
  }
}

/**
 * 밸류 베팅 알림 메시지 포맷 생성
 * @param {Array} valueBets - 밸류 베팅 목록
 * @param {Object} match - 경기 정보
 * @param {number} confidence - AI 신뢰도
 */
function buildValueBetMessage(valueBets, match, confidence) {
  const topBet = valueBets[0];
  const outcomeLabel = topBet.outcome === 'home_win' ? '홈승' :
    topBet.outcome === 'away_win' ? '원정승' : '무승부';

  let lines = [
    `🎯 *밸류 베팅 발견!*`,
    ``,
    `🏆 *${match.league}*`,
    `⚽ ${match.home_team} vs ${match.away_team}`,
    `🕐 ${new Date(match.start_time).toLocaleString('ko-KR')}`,
    ``,
  ];

  for (const vb of valueBets.slice(0, 3)) {
    const ol = vb.outcome === 'home_win' ? '홈승' :
      vb.outcome === 'away_win' ? '원정승' : '무승부';
    lines.push(`📊 ${ol}: AI ${(vb.model_prob * 100).toFixed(0)}% vs 시장 ${(vb.implied_prob * 100).toFixed(0)}%`);
    lines.push(`💎 엣지: +${(vb.edge * 100).toFixed(1)}% | ${vb.bookmaker} @${vb.odds}`);
  }

  lines.push(``);
  if (confidence) {
    lines.push(`🎚 신뢰도: ${(confidence * 100).toFixed(0)}%`);
  }
  lines.push(`_${new Date().toLocaleString('ko-KR')} 탐지_`);

  return lines.join('\n');
}

/**
 * 일일 요약 메시지 포맷 생성
 * @param {Object} summary - 일일 요약 데이터
 */
function buildDailyDigestMessage(summary) {
  let lines = [
    `📋 *일일 AI 요약*`,
    ``,
    `📊 오늘 예측: ${summary.todayPredictions}경기`,
    `🎯 밸류베팅: ${summary.todayValueBets}건 발견`,
  ];

  if (summary.yesterday) {
    const y = summary.yesterday;
    lines.push(``);
    lines.push(`📈 *어제 결과:*`);
    lines.push(`✅ 적중: ${y.correct}/${y.total} (${(y.accuracy * 100).toFixed(1)}%)`);
    if (y.valueBetROI !== null) {
      lines.push(`💰 밸류벳 ROI: ${y.valueBetROI > 0 ? '+' : ''}${(y.valueBetROI * 100).toFixed(1)}%`);
    }
    lines.push(`📉 Brier Score: ${y.avgBrier.toFixed(4)}`);
  }

  if (summary.topValueBets && summary.topValueBets.length > 0) {
    lines.push(``);
    lines.push(`🔥 *오늘 Top 밸류:*`);
    summary.topValueBets.forEach((vb, i) => {
      const ol = vb.outcome === 'home_win' ? '홈승' :
        vb.outcome === 'away_win' ? '원정승' : '무';
      lines.push(`${i + 1}. ${vb.home_team} vs ${vb.away_team} | ${ol} +${(vb.edge * 100).toFixed(1)}%`);
    });
  }

  lines.push(``);
  lines.push(`_${new Date().toLocaleString('ko-KR')}_`);

  return lines.join('\n');
}

/**
 * 연동된 모든 유저에게 텔레그램 메시지 발송 (재사용 가능)
 * @param {string} message - 마크다운 메시지
 * @returns {{ sent: number, failed: number }}
 */
async function sendToAllLinkedUsers(message) {
  const b = getBot();
  if (!b) {
    log.info('Telegram bot not configured. Skipping notification.');
    return { sent: 0, failed: 0 };
  }

  const adminChatId = process.env.TELEGRAM_CHAT_ID;
  const chatIds = [];

  if (adminChatId) {
    chatIds.push({ chatId: adminChatId, userId: null, isAdmin: true });
  }

  try {
    const supabase = require('../config/supabase');
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, telegram_chat_id')
      .not('telegram_chat_id', 'is', null)
      .eq('is_active', true);

    if (!error && users) {
      for (const user of users) {
        if (user.telegram_chat_id !== adminChatId) {
          chatIds.push({ chatId: user.telegram_chat_id, userId: user.id, isAdmin: false });
        }
      }
    }
  } catch (err) {
    log.error('Failed to fetch telegram users', { error: err.message });
  }

  if (chatIds.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const results = await Promise.allSettled(
    chatIds.map(({ chatId }) =>
      b.sendMessage(chatId, message, { parse_mode: 'Markdown' })
    )
  );

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const { chatId, userId } = chatIds[i];

    if (result.status === 'fulfilled') {
      sent++;
    } else {
      failed++;
      const errMsg = result.reason?.message || '';
      log.error(`Failed to send to chatId=${chatId}`, { error: errMsg });

      if (errMsg.includes('403') && userId) {
        try {
          const supabase = require('../config/supabase');
          await supabase
            .from('profiles')
            .update({ telegram_chat_id: null, telegram_linked_at: null })
            .eq('id', userId);
          log.info(`Auto-unlinked blocked user: ${userId}`);
        } catch (unlinkErr) {
          log.error('Failed to auto-unlink', { error: unlinkErr.message });
        }
      }
    }
  }

  return { sent, failed };
}

module.exports = {
  getBot,
  sendArbitrageAlert,
  sendSessionExpiryAlert,
  sendToAllLinkedUsers,
  buildValueBetMessage,
  buildDailyDigestMessage,
  buildAlertMessage,
};
