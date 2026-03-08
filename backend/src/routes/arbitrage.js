const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { distributeStake } = require('../services/arbitrageEngine');
const { getMockData } = require('../mockData');

const USE_MOCK = !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY;

// GET /api/arbitrage
router.get('/', async (req, res) => {
  try {
    if (USE_MOCK) {
      const { arbitrage, matches } = getMockData();
      const { min_profit = 0, market_type } = req.query;
      let filtered = arbitrage.filter((a) => a.profit_percent >= parseFloat(min_profit));
      if (market_type) filtered = filtered.filter((a) => a.market_type === market_type);
      // Attach match data
      filtered = filtered.map((a) => ({
        ...a,
        matches: matches.find((m) => m.id === a.match_id) || null,
      }));
      filtered.sort((a, b) => b.profit_percent - a.profit_percent);
      return res.json({ success: true, data: filtered, count: filtered.length });
    }

    const { limit = 50, min_profit = 0, market_type } = req.query;

    let query = supabase
      .from('arbitrage_opportunities')
      .select(`
        *,
        matches (
          id, league, sport, home_team, away_team, start_time
        )
      `)
      .eq('is_active', true)
      .gte('profit_percent', parseFloat(min_profit))
      .order('profit_percent', { ascending: false })
      .order('detected_at', { ascending: false })
      .limit(parseInt(limit));

    if (market_type) query = query.eq('market_type', market_type);

    const { data, error } = await query;
    if (error) throw error;

    // Filter out past matches
    const now = new Date().toISOString();
    const activeOpps = (data || []).filter((opp) => opp.matches && opp.matches.start_time > now);

    res.json({ success: true, data: activeOpps, count: activeOpps.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/arbitrage/calculate
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
    if (oddsArray.some((o) => isNaN(o) || o <= 1)) {
      return res.status(400).json({ success: false, error: 'All odds must be > 1' });
    }

    const result = distributeStake(stake, oddsArray);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/arbitrage/calculate-batch
router.post('/calculate-batch', (req, res) => {
  try {
    const { totalBankroll, opportunities } = req.body;

    if (!totalBankroll || !opportunities || !Array.isArray(opportunities) || opportunities.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'totalBankroll and opportunities array are required',
      });
    }

    const bankroll = parseFloat(totalBankroll);

    // Distribute bankroll proportionally to profit margin
    const totalProfitWeight = opportunities.reduce((sum, opp) => sum + (opp.profit_percent || 1), 0);

    const results = opportunities.map((opp) => {
      const weight = (opp.profit_percent || 1) / totalProfitWeight;
      const allocatedStake = parseFloat((bankroll * weight).toFixed(2));
      const result = distributeStake(allocatedStake, opp.odds.map(Number));
      return {
        ...result,
        matchId: opp.matchId || null,
        marketType: opp.marketType || null,
        allocatedStake,
      };
    });

    const totalProfit = results.reduce((sum, r) => sum + (r ? r.profit : 0), 0);

    res.json({
      success: true,
      data: {
        totalBankroll: bankroll,
        results,
        totalProfit: parseFloat(totalProfit.toFixed(2)),
        totalProfitPercent: parseFloat(((totalProfit / bankroll) * 100).toFixed(4)),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
