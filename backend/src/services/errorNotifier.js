/**
 * Error Notifier — 서버 에러/크래시 시 관리자 텔레그램 알림
 *
 * 중복 알림 방지: 같은 에러는 5분 내 1번만 발송.
 */

const { getBot } = require('./telegramBot');
const { createServiceLogger } = require('../config/logger');

const log = createServiceLogger('ErrorNotifier');
const ADMIN_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const COOLDOWN_MS = 5 * 60 * 1000; // 5분

// 중복 방지 캐시: errorKey → lastSentTime
const sentCache = new Map();

/**
 * 관리자에게 에러 알림 전송.
 * @param {'error'|'warn'|'info'} level
 * @param {string} title - 에러 제목 (예: 'API-Football 한도 초과')
 * @param {object} [detail] - 추가 정보
 */
async function notifyAdmin(level, title, detail = {}) {
  if (!ADMIN_CHAT_ID) return;

  // 중복 방지
  const key = `${level}:${title}`;
  const lastSent = sentCache.get(key);
  if (lastSent && Date.now() - lastSent < COOLDOWN_MS) return;
  sentCache.set(key, Date.now());

  const emoji = level === 'error' ? '🔴' : level === 'warn' ? '🟡' : '🔵';
  const time = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

  let message = `${emoji} *SureOdds ${level.toUpperCase()}*\n`;
  message += `${title}\n`;
  if (detail.error) message += `\`${String(detail.error).slice(0, 200)}\`\n`;
  if (detail.context) message += `${detail.context}\n`;
  message += `\n_${time}_`;

  try {
    const bot = getBot();
    if (bot) {
      await bot.sendMessage(ADMIN_CHAT_ID, message, { parse_mode: 'Markdown' });
    }
  } catch (err) {
    log.error('Failed to send admin notification', { error: err.message });
  }
}

/**
 * Express 글로벌 에러 핸들러 미들웨어.
 * app.use(errorHandler) 로 등록.
 */
function errorHandler(err, req, res, next) {
  log.error('Unhandled error', { error: err.message, path: req.originalUrl });
  notifyAdmin('error', '서버 에러 발생', {
    error: err.message,
    context: `${req.method} ${req.originalUrl}`,
  });
  res.status(500).json({ success: false, error: '서버 오류가 발생했습니다.' });
}

/**
 * process 레벨 에러 캐처 등록.
 */
function registerProcessHandlers() {
  process.on('uncaughtException', (err) => {
    log.error('Uncaught Exception', { error: err.message });
    notifyAdmin('error', '서버 크래시 (uncaughtException)', { error: err.message });
  });

  process.on('unhandledRejection', (reason) => {
    const msg = reason instanceof Error ? reason.message : String(reason);
    log.error('Unhandled Rejection', { error: msg });
    notifyAdmin('error', '처리되지 않은 Promise 에러', { error: msg });
  });
}

module.exports = { notifyAdmin, errorHandler, registerProcessHandlers };
