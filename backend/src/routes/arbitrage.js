const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { distributeStake } = require('../services/arbitrageEngine');

// GET /api/arbitrage
// Returns all active arbitrage opportunities with match details
router.get('/', async (req, res) => {
  try {
    const { limit = 20, min_profit = 0 } = req.query;

    const { data, error } = await supabase
      .from('arbitrage_opportunities')
      .select(
        `
        *,
        matches (
          id, league, sport, home_team, away_team, start_time
        )
      `
      )
      .gte('profit_percent', parseFloat(min_profit))
      .order('profit_percent', { ascending: false })
      .order('detected_at', { ascending: false })
      .limit(parseInt(limit));

    if (error) throw error;

    // Filter out past matches
    const now = new Date().toISOString();
    const activeOpps = data.filter((opp) => opp.matches && opp.matches.start_time > now);

    res.json({ success: true, data: activeOpps, count: activeOpps.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/arbitrage/calculate
// Calculate stake distribution for given odds and total stake
router.post('/calculate', (req, res) => {
  try {
    const { totalStake, odds } = req.body;

    if (!totalStake || !odds || !Array.isArray(odds) || odds.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'totalStake and odds (array of at least 2) are required',
      });
    }

    const stake = parseFloat(totalStake);
    const oddsArray = odds.map(Number);

    if (isNaN(stake) || stake <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid totalStake' });
    }

    const result = distributeStake(stake, oddsArray);
    const arb = oddsArray.reduce((sum, odd) => sum + 1 / odd, 0);

    res.json({
      success: true,
      data: {
        totalStake: stake,
        stakes: result.stakes,
        returns: result.returns,
        profit: result.profit,
        profitPercent: parseFloat(((result.profit / stake) * 100).toFixed(4)),
        isArbitrage: arb < 1,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
