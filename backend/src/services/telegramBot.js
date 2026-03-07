const TelegramBot = require('node-telegram-bot-api');
require('dotenv').config();

let bot = null;

function getBot() {
  if (!bot && process.env.TELEGRAM_BOT_TOKEN) {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
  }
  return bot;
}

/**
 * Send a Sure Bet alert to the configured Telegram chat.
 */
async function sendArbitrageAlert(opportunity, match) {
  const b = getBot();
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!b || !chatId) {
    console.log('Telegram not configured. Skipping notification.');
    return;
  }

  const profit = opportunity.profit_percent.toFixed(2);
  const market = opportunity.market_type === '3way' ? '3-way (1X2)' : '2-way (1X2)';

  let oddsText = `🏠 Home  (${opportunity.bookmaker_home}): ${opportunity.odds_home}\n`;
  if (opportunity.market_type === '3way') {
    oddsText += `🤝 Draw  (${opportunity.bookmaker_draw}): ${opportunity.odds_draw}\n`;
  }
  oddsText += `✈️ Away  (${opportunity.bookmaker_away}): ${opportunity.odds_away}`;

  const message = `
⚡ *Sure Bet Found!*

🏆 *${match.league}*
⚽ ${match.home_team} vs ${match.away_team}
🕐 ${new Date(match.start_time).toLocaleString()}

📊 Market: ${market}
${oddsText}

💰 *Profit: ${profit}%*

_Detected at ${new Date().toLocaleString()}_
  `.trim();

  try {
    await b.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    console.log(`Telegram alert sent for ${match.home_team} vs ${match.away_team}`);
  } catch (err) {
    console.error('Failed to send Telegram alert:', err.message);
  }
}

module.exports = { sendArbitrageAlert };
