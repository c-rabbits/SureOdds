/**
 * Team Logo API Routes
 * /api/logos
 */
const express = require('express');
const router = express.Router();
const { getTeamLogos } = require('../services/teamLogoService');

/**
 * POST /api/logos/batch
 * Body: { teams: ["Arsenal", "Liverpool", ...] }
 * Returns: { logos: { "Arsenal": "https://...", "Liverpool": "https://..." } }
 */
router.post('/batch', async (req, res) => {
  try {
    const { teams } = req.body;
    if (!Array.isArray(teams) || teams.length === 0) {
      return res.status(400).json({ success: false, error: 'teams 배열이 필요합니다.' });
    }

    // Limit to 50 teams per request
    const limited = teams.slice(0, 50);
    const logos = await getTeamLogos(limited);

    res.json({ success: true, logos });
  } catch (err) {
    res.status(500).json({ success: false, error: '로고 조회 실패' });
  }
});

module.exports = router;
