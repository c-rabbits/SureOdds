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
 * Send a Sure Bet alert to the configured Telegram chat.
 * Supports h2h, spreads, and totals market types.
 */
async function sendArbitrageAlert(opportunity, match) {
  const b = getBot();
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!b || !chatId) {
    log.info('Telegram not configured. Skipping notification.');
    return;
  }

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

  const message = `
⚡ *Sure Bet Found!*

🏆 *${match.league}*
⚽ ${match.home_team} vs ${match.away_team}
🕐 ${new Date(match.start_time).toLocaleString()}

📊 Market: ${marketLabel}
${oddsText}

💰 *Profit: ${profit}%*

_Detected at ${new Date().toLocaleString()}_
  `.trim();

  try {
    await b.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    log.info(`Alert sent for ${match.home_team} vs ${match.away_team}`);
  } catch (err) {
    log.error('Failed to send alert', { error: err.message });
  }
}

module.exports = { sendArbitrageAlert };
