const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { getMockData } = require('../mockData');

const USE_MOCK = !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY;

// GET /api/matches
router.get('/', async (req, res) => {
  try {
    if (USE_MOCK) {
      const { matches } = getMockData();
      return res.json({ success: true, data: matches, count: matches.length });
    }

    const { sport, league, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('matches')
      .select('*')
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (sport) query = query.eq('sport', sport);
    if (league) query = query.ilike('league', `%${league}%`);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data, count: data.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/matches/with-odds
// Returns matches with all odds and arbitrage opportunities joined
router.get('/with-odds', async (req, res) => {
  try {
    if (USE_MOCK) {
      const { matchesWithOdds } = getMockData();
      return res.json({ success: true, data: matchesWithOdds, count: matchesWithOdds.length });
    }

    const { sport, limit = 100 } = req.query;

    let query = supabase
      .from('matches')
      .select(`
        *,
        odds (*),
        arbitrage_opportunities (*)
      `)
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(parseInt(limit));

    if (sport) query = query.eq('sport', sport);

    const { data, error } = await query;
    if (error) throw error;

    // Filter arbitrage to only active ones
    const result = (data || []).map((match) => ({
      ...match,
      arbitrage_opportunities: (match.arbitrage_opportunities || []).filter((a) => a.is_active),
    }));

    res.json({ success: true, data: result, count: result.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/matches/:id
router.get('/:id', async (req, res) => {
  try {
    if (USE_MOCK) {
      const { matches } = getMockData();
      const match = matches.find((m) => m.id === req.params.id);
      if (!match) return res.status(404).json({ success: false, error: 'Not found' });
      return res.json({ success: true, data: match });
    }

    const { data, error } = await supabase.from('matches').select('*').eq('id', req.params.id).single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

module.exports = router;
