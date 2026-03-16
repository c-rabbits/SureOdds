/**
 * SureOdds - AI 예측 라우트
 * /api/ai
 */
const express = require('express');
const router = express.Router();
const { createServiceLogger } = require('../config/logger');
const { getMatchesWithPredictions, getPrediction, getValueBets } = require('../services/aiPredictionService');
const { getOddsHistory, getOddsMovement } = require('../services/oddsHistoryService');
const { getTeamStatsForMatch } = require('../services/teamStrengthModel');

const log = createServiceLogger('AiRoute');

// GET /api/ai/predictions - 오늘 경기 + 예측 목록
router.get('/predictions', async (req, res) => {
  try {
    const { sport, date, limit } = req.query;
    const data = await getMatchesWithPredictions({
      sport,
      date,
      limit: limit ? parseInt(limit, 10) : 100,
    });
    res.json({ success: true, data, count: data.length });
  } catch (err) {
    log.error('Error in GET /predictions', { error: err.message });
    res.status(500).json({ success: false, error: '예측 데이터를 불러오지 못했습니다.' });
  }
});

// GET /api/ai/predictions/:matchId - 단건 경기 예측 상세
router.get('/predictions/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const supabase = require('../config/supabase');

    // 경기 정보 + 현재 배당 + 예측
    const [matchResult, oddsResult, prediction] = await Promise.all([
      supabase.from('matches').select('*').eq('id', matchId).single(),
      supabase.from('odds').select('*').eq('match_id', matchId),
      getPrediction(matchId),
    ]);

    if (matchResult.error || !matchResult.data) {
      return res.status(404).json({ success: false, error: '경기를 찾을 수 없습니다.' });
    }

    // 양 팀 통계 조회
    const match = matchResult.data;
    const teamStats = await getTeamStatsForMatch(match.home_team, match.away_team);

    res.json({
      success: true,
      data: {
        match,
        odds: oddsResult.data || [],
        prediction,
        homeTeamStats: teamStats.home,
        awayTeamStats: teamStats.away,
      },
    });
  } catch (err) {
    log.error('Error in GET /predictions/:matchId', { error: err.message });
    res.status(500).json({ success: false, error: '예측 상세를 불러오지 못했습니다.' });
  }
});

// GET /api/ai/odds-history/:matchId - 배당 히스토리 시계열
router.get('/odds-history/:matchId', async (req, res) => {
  try {
    const { matchId } = req.params;
    const { bookmaker, market_type } = req.query;
    const data = await getOddsHistory(matchId, {
      bookmaker,
      marketType: market_type,
    });
    res.json({ success: true, data });
  } catch (err) {
    log.error('Error in GET /odds-history/:matchId', { error: err.message });
    res.status(500).json({ success: false, error: '배당 히스토리를 불러오지 못했습니다.' });
  }
});

// GET /api/ai/odds-movement - 배당 변동 대시보드
router.get('/odds-movement', async (req, res) => {
  try {
    const { hours, sport, limit } = req.query;
    const data = await getOddsMovement(
      hours ? parseInt(hours, 10) : 24,
      sport || null,
      limit ? parseInt(limit, 10) : 30,
    );
    res.json({ success: true, data, count: data.length });
  } catch (err) {
    log.error('Error in GET /odds-movement', { error: err.message });
    res.status(500).json({ success: false, error: '배당 변동 데이터를 불러오지 못했습니다.' });
  }
});

// GET /api/ai/value-bets - 현재 밸류 베팅 기회
router.get('/value-bets', async (req, res) => {
  try {
    const { limit } = req.query;
    const data = await getValueBets({ limit: limit ? parseInt(limit, 10) : 50 });
    res.json({ success: true, data, count: data.length });
  } catch (err) {
    log.error('Error in GET /value-bets', { error: err.message });
    res.status(500).json({ success: false, error: '밸류 베팅 데이터를 불러오지 못했습니다.' });
  }
});

// ─── Team Stats ───

// GET /api/ai/team-stats - 팀 통계 목록
router.get('/team-stats', async (req, res) => {
  try {
    const supabase = require('../config/supabase');
    const { league, sort, order, limit } = req.query;

    let query = supabase
      .from('team_stats')
      .select('*');

    if (league) {
      query = query.eq('league', league);
    }

    const sortField = sort || 'elo_rating';
    const sortOrder = order === 'asc' ? true : false;
    query = query.order(sortField, { ascending: sortOrder });

    if (limit) {
      query = query.limit(parseInt(limit, 10));
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ success: true, data, count: data.length });
  } catch (err) {
    log.error('Error in GET /team-stats', { error: err.message });
    res.status(500).json({ success: false, error: '팀 통계를 불러오지 못했습니다.' });
  }
});

// GET /api/ai/team-stats/:teamName - 팀 상세 통계
router.get('/team-stats/:teamName', async (req, res) => {
  try {
    const supabase = require('../config/supabase');
    const { teamName } = req.params;

    const { data: stats, error } = await supabase
      .from('team_stats')
      .select('*')
      .eq('team_name', decodeURIComponent(teamName))
      .single();

    if (error || !stats) {
      return res.status(404).json({ success: false, error: '팀을 찾을 수 없습니다.' });
    }

    // ELO history for this team
    const { data: eloHistory } = await supabase
      .from('elo_history')
      .select('elo_before, elo_after, elo_change, recorded_at')
      .eq('team_name', decodeURIComponent(teamName))
      .order('recorded_at', { ascending: true })
      .limit(20);

    res.json({
      success: true,
      data: {
        stats,
        eloHistory: eloHistory || [],
      },
    });
  } catch (err) {
    log.error('Error in GET /team-stats/:teamName', { error: err.message });
    res.status(500).json({ success: false, error: '팀 상세를 불러오지 못했습니다.' });
  }
});

// GET /api/ai/leagues - 리그 목록 (통계 요약)
router.get('/leagues', async (req, res) => {
  try {
    const supabase = require('../config/supabase');

    const { data, error } = await supabase
      .from('team_stats')
      .select('league, sport');

    if (error) throw error;

    // Group by league
    const leagueMap = {};
    for (const row of (data || [])) {
      if (!leagueMap[row.league]) {
        leagueMap[row.league] = { league: row.league, sport: row.sport, teamCount: 0 };
      }
      leagueMap[row.league].teamCount++;
    }

    res.json({ success: true, data: Object.values(leagueMap) });
  } catch (err) {
    log.error('Error in GET /leagues', { error: err.message });
    res.status(500).json({ success: false, error: '리그 정보를 불러오지 못했습니다.' });
  }
});

module.exports = router;
