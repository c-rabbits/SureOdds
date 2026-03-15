const express = require('express');
const router = express.Router();
const { refreshMockData } = require('../mockData');

const USE_MOCK = !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY;

let collect, getLastResult, collectOddsApiIoAndSave, getLastOddsApiIoResult, getQuotaInfo, SPORTS, MARKETS, DEFAULT_SPORTS, getPinnacleStatus, getOddsApiIoStatus, getStakeStatus;

try {
  const collector = require('../collector/index');
  const oddsApi = require('../collector/oddsApi');
  const pinnacleApi = require('../collector/pinnacleApi');
  const oddsApiIo = require('../collector/oddsApiIo');
  const stakeScraper = require('../collector/stakeScraper');
  collect = collector.collect;
  getLastResult = collector.getLastResult;
  collectOddsApiIoAndSave = collector.collectOddsApiIoAndSave;
  getLastOddsApiIoResult = collector.getLastOddsApiIoResult;
  getQuotaInfo = oddsApi.getQuotaInfo;
  SPORTS = oddsApi.SPORTS;
  MARKETS = oddsApi.MARKETS;
  DEFAULT_SPORTS = oddsApi.DEFAULT_SPORTS;
  getPinnacleStatus = pinnacleApi.getPinnacleStatus;
  getOddsApiIoStatus = oddsApiIo.getOddsApiIoStatus;
  getStakeStatus = stakeScraper.getLastScrapeResult;
} catch (e) {
  // Collector modules may not exist yet
  collect = async () => ({ success: true, mock: true });
  getLastResult = () => null;
  collectOddsApiIoAndSave = async () => ({ success: true, mock: true });
  getLastOddsApiIoResult = () => null;
  getQuotaInfo = () => ({ used: null, remaining: null, updatedAt: null });
  SPORTS = [];
  MARKETS = ['h2h', 'spreads', 'totals'];
  DEFAULT_SPORTS = [];
  getPinnacleStatus = () => ({ configured: false });
  getOddsApiIoStatus = () => ({ configured: false });
  getStakeStatus = () => null;
}

// POST /api/collector/trigger
// Manually trigger a data collection cycle
router.post('/trigger', async (req, res) => {
  try {
    if (USE_MOCK) {
      // Refresh mock data to simulate new collection
      refreshMockData();
      return res.json({
        success: true,
        data: {
          success: true,
          timestamp: new Date().toISOString(),
          matchesUpdated: 12,
          oddsRows: 240,
          arbitrageFound: 3,
          creditsUsed: 0,
          mock: true,
        },
      });
    }

    const { sports, markets } = req.body;
    const result = await collect(
      sports || undefined,
      markets || undefined,
    );
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/collector/trigger-oddsapiio
// Manually trigger an Odds-API.io collection cycle
router.post('/trigger-oddsapiio', async (req, res) => {
  try {
    const result = await collectOddsApiIoAndSave();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/collector/status
// Returns the last collection result and current status
router.get('/status', (req, res) => {
  if (USE_MOCK) {
    return res.json({
      success: true,
      data: {
        lastResult: {
          success: true,
          timestamp: new Date().toISOString(),
          duration: 1200,
          matchesUpdated: 12,
          oddsRows: 240,
          arbitrageFound: 3,
          mock: true,
        },
        quota: { used: 0, remaining: 500, updatedAt: new Date().toISOString() },
        config: { sports: [], markets: ['h2h', 'spreads', 'totals'], defaultSports: [] },
      },
    });
  }

  const lastResult = getLastResult();
  const quota = getQuotaInfo();

  res.json({
    success: true,
    data: {
      lastResult,
      quota,
      config: {
        sports: SPORTS,
        markets: MARKETS,
        defaultSports: DEFAULT_SPORTS,
      },
      pinnacle: getPinnacleStatus(),
      stake: getStakeStatus(),
      oddsApiIo: {
        ...getOddsApiIoStatus(),
        schedulerInterval: `${process.env.ODDS_API_IO_INTERVAL || '20'}min`,
        lastResult: getLastOddsApiIoResult(),
      },
    },
  });
});

// GET /api/collector/quota
// Returns API quota information
router.get('/quota', async (req, res) => {
  try {
    if (USE_MOCK) {
      return res.json({
        success: true,
        data: {
          used: 0,
          remaining: 500,
          updatedAt: new Date().toISOString(),
          monthlyUsed: 0,
          monthlyLimit: 500,
          monthlyRemaining: 500,
        },
      });
    }

    const supabase = require('../config/supabase');
    const quota = getQuotaInfo();

    // Also fetch monthly usage from DB
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: usageData } = await supabase
      .from('api_usage')
      .select('credits_used')
      .gte('request_time', startOfMonth.toISOString());

    const monthlyUsed = (usageData || []).reduce((sum, row) => sum + row.credits_used, 0);

    res.json({
      success: true,
      data: {
        ...quota,
        monthlyUsed,
        monthlyLimit: 500,
        monthlyRemaining: Math.max(0, 500 - monthlyUsed),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
