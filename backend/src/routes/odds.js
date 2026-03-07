const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// GET /api/odds/:matchId
router.get('/:matchId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('odds')
      .select('*')
      .eq('match_id', req.params.matchId)
      .order('bookmaker', { ascending: true });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
