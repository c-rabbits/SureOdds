const express = require('express');
const cors = require('cors');
require('dotenv').config();

const matchesRouter = require('./routes/matches');
const oddsRouter = require('./routes/odds');
const arbitrageRouter = require('./routes/arbitrage');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/matches', matchesRouter);
app.use('/api/odds', oddsRouter);
app.use('/api/arbitrage', arbitrageRouter);

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
