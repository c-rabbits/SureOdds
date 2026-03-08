const express = require('express');
const cors = require('cors');
require('dotenv').config();

const matchesRouter = require('./routes/matches');
const oddsRouter = require('./routes/odds');
const arbitrageRouter = require('./routes/arbitrage');
const collectorRouter = require('./routes/collector');
const authRouter = require('./routes/auth');
const adminRouter = require('./routes/admin');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes (인증 불필요)
app.use('/api/auth', authRouter);

// Admin routes (내부에서 requireAuth + requireAdmin 적용)
app.use('/api/admin', adminRouter);

// API routes (인증 필요)
app.use('/api/matches', requireAuth, matchesRouter);
app.use('/api/odds', requireAuth, oddsRouter);
app.use('/api/arbitrage', requireAuth, arbitrageRouter);
app.use('/api/collector', requireAuth, collectorRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`SureOdds API running on port ${PORT}`);
});

module.exports = app;
