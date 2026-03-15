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
    marketLabel = is3way ? 'H2H 3-way (1X2)' : 'H2H 2-way';
    oddsText = `🏠 Home  (${opportunity.bookmaker_a}): ${opportunity.odds_a}\n`;
    if (is3way) {
      oddsText += `🤝 Draw  (${opportunity.bookmaker_draw}): ${opportunity.odds_draw}\n`;
    }
    oddsText += `✈️ Away  (${opportunity.bookmaker_b}): ${opportunity.odds_b}`;
  } else if (opportunity.market_type === 'spreads') {
    marketLabel = `Spread ${opportunity.handicap_point > 0 ? '+' : ''}${opportunity.handicap_point}`;
    oddsText = `🏠 Home ${opportunity.handicap_point}  (${opportunity.bookmaker_a}): ${opportunity.odds_a}\n`;
    oddsText += `✈️ Away ${-opportunity.handicap_point}  (${opportunity.bookmaker_b}): ${opportunity.odds_b}`;
  } else if (opportunity.market_type === 'totals') {
    marketLabel = `Over/Under ${opportunity.handicap_point}`;
    oddsText = `⬆️ Over ${opportunity.handicap_point}  (${opportunity.bookmaker_a}): ${opportunity.odds_a}\n`;
    oddsText += `⬇️ Under ${opportunity.handicap_point}  (${opportunity.bookmaker_b}): ${opportunity.odds_b}`;
  } else {
    marketLabel = opportunity.market_type;
    oddsText = `A (${opportunity.bookmaker_a}): ${opportunity.odds_a}\nB (${opportunity.bookmaker_b}): ${opportunity.odds_b}`;
  }

  return `
⚡ *Sure Bet Found!*

🏆 *${match.league}*
⚽ ${match.home_team} vs ${match.away_team}
🕐 ${new Date(match.start_time).toLocaleString()}

📊 Market: ${marketLabel}
${oddsText}

💰 *Profit: ${profit}%*

_Detected at ${new Date().toLocaleString()}_
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

module.exports = { getBot, sendArbitrageAlert };
