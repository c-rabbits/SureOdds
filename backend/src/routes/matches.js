const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// GET /api/matches
router.get('/', async (req, res) => {
  try {
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

// GET /api/matches/:id
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('matches').select('*').eq('id', req.params.id).single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(404).json({ success: false, error: err.message });
  }
});

module.exports = router;
