const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { getMockData } = require('../mockData');

const USE_MOCK = !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY;

// GET /api/odds/:matchId
router.get('/:matchId', async (req, res) => {
  try {
    if (USE_MOCK) {
      const { odds } = getMockData();
      const { market_type } = req.query;
      let filtered = odds.filter((o) => o.match_id === req.params.matchId);
      if (market_type) filtered = filtered.filter((o) => o.market_type === market_type);
      return res.json({ success: true, data: filtered });
    }

    const { market_type } = req.query;

    let query = supabase
      .from('odds')
      .select('*')
      .eq('match_id', req.params.matchId)
      .order('bookmaker', { ascending: true });

    if (market_type) query = query.eq('market_type', market_type);

    const { data, error } = await query;
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
