/**
 * SureOdds - AI 예측 라우트
 * /api/ai
 */
const express = require('express');
const router = express.Router();
const { createServiceLogger } = require('../config/logger');
const { getMatchesWithPredictions, getPrediction, getValueBets } = require('../services/aiPredictionService');
const { getOddsHistory, getOddsMovement } = require('../services/oddsHistoryService');

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

    res.json({
      success: true,
      data: {
        match: matchResult.data,
        odds: oddsResult.data || [],
        prediction,
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

module.exports = router;
