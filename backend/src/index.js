const express = require('express');
const cors = require('cors');
require('dotenv').config();

const matchesRouter = require('./routes/matches');
const oddsRouter = require('./routes/odds');
const arbitrageRouter = require('./routes/arbitrage');
const collectorRouter = require('./routes/collector');
const domesticRouter = require('./routes/domestic');
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const telegramRouter = require('./routes/telegram');
const aiRouter = require('./routes/ai');
const { requireAuth } = require('./middleware/auth');
const { logger, createServiceLogger, requestLogger } = require('./config/logger');
const { startOddsApiIoScheduler } = require('./collector/index');
const { startDailyScheduler: startTeamStatsScheduler } = require('./collector/teamStatsCollector');
const { getBot } = require('./services/telegramBot');
const { startSessionMonitor } = require('./services/sessionMonitor');
const { startScheduler: startDailyDigestScheduler } = require('./services/dailyDigestService');
const pushRouter = require('./routes/push');
const webPushService = require('./services/webPushService');

const app = express();
const PORT = process.env.PORT || 4000;
const log = createServiceLogger('Server');

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json({ limit: '5mb' }));

// 요청 로깅 미들웨어
app.use(requestLogger);

// Health check
app.get('/health', async (req, res) => {
  const info = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    node: process.version,
    hasFetch: typeof globalThis.fetch === 'function',
  };
  // Supabase 연결 테스트
  try {
    const supabase = require('./config/supabase');
    const { data, error } = await supabase.from('profiles').select('id').limit(1);
    info.supabase = error ? `error: ${error.message}` : 'connected';
  } catch (e) {
    info.supabase = `exception: ${e.message}`;
  }
  res.json(info);
});

// Auth routes (인증 불필요)
app.use('/api/auth', authRouter);

// Admin routes (내부에서 requireAuth + requireAdmin 적용)
app.use('/api/admin', adminRouter);

// Telegram routes (웹훅은 인증 없음, link/status는 내부에서 requireAuth)
app.use('/api/telegram', telegramRouter);

// Push routes (vapid-key는 인증 없음, subscribe는 내부에서 requireAuth)
app.use('/api/push', pushRouter);

// API routes (인증 필요)
app.use('/api/matches', requireAuth, matchesRouter);
app.use('/api/odds', requireAuth, oddsRouter);
app.use('/api/arbitrage', requireAuth, arbitrageRouter);
app.use('/api/collector', requireAuth, collectorRouter);
app.use('/api/domestic', requireAuth, domesticRouter);
app.use('/api/ai', requireAuth, aiRouter);

// 404 handler
app.use((req, res) => {
  log.warn(`Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  log.error(`Unhandled error: ${err.message}`, {
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
  });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, async () => {
  log.info(`SureOdds API running on port ${PORT}`);

  // Start Odds-API.io independent scheduler (every 20 min)
  startOddsApiIoScheduler();

  // Start session monitor (every 5 min)
  startSessionMonitor();

  // Start team stats collector (daily at 06:00 + startup)
  startTeamStatsScheduler();

  // Start daily digest scheduler (daily at 08:00)
  startDailyDigestScheduler();

  // Initialize Web Push
  webPushService.init();

  // Register Telegram webhook
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const railwayUrl = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : process.env.BACKEND_URL;

  if (webhookSecret && railwayUrl) {
    try {
      const bot = getBot();
      if (bot) {
        const webhookUrl = `${railwayUrl}/api/telegram/webhook/${webhookSecret}`;
        await bot.setWebHook(webhookUrl);
        log.info(`Telegram webhook registered: ${webhookUrl.replace(webhookSecret, '***')}`);
      }
    } catch (err) {
      log.error('Failed to register Telegram webhook', { error: err.message });
    }
  }
});

module.exports = app;
