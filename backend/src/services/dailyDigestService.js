/**
 * Daily Digest Service (Phase 3 Step 1)
 *
 * 매일 08:00에 AI 예측 요약을 텔레그램으로 발송.
 * - 오늘 예측 경기 수 + 밸류베팅 건수
 * - 어제 결과 (적중률, Brier Score, ROI)
 * - 오늘 Top 밸류베팅 목록
 */

const cron = require('node-cron');
const supabase = require('../config/supabase');
const { createServiceLogger } = require('../config/logger');
const { sendNotification } = require('./notificationService');

const log = createServiceLogger('DailyDigest');

/**
 * 일일 요약 데이터 수집 및 발송.
 */
async function sendDailyDigest() {
  log.info('=== Daily Digest Started ===');

  try {
    const now = new Date();

    // ── 1. 오늘 예측 경기 수 ──
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    // +1일까지 포함 (시차 고려)
    const extendedEnd = new Date(todayEnd.getTime() + 24 * 3600 * 1000);

    const { count: todayPredictions } = await supabase
      .from('ai_predictions')
      .select('id', { count: 'exact', head: true })
      .gte('computed_at', todayStart.toISOString())
      .lte('computed_at', extendedEnd.toISOString());

    // ── 2. 오늘 밸류베팅 건수 ──
    const { data: valueBetPredictions } = await supabase
      .from('ai_predictions')
      .select('value_bets')
      .not('value_bets', 'is', null)
      .gte('computed_at', todayStart.toISOString())
      .lte('computed_at', extendedEnd.toISOString());

    const todayValueBets = (valueBetPredictions || [])
      .reduce((sum, p) => sum + (p.value_bets?.length || 0), 0);

    // ── 3. 어제 결과 (prediction_accuracy) ──
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 3600 * 1000);
    const yesterdayEnd = new Date(todayStart);

    const { data: yesterdayRecords } = await supabase
      .from('prediction_accuracy')
      .select('correct, brier_score, had_value_bet, value_bet_profit')
      .gte('calculated_at', yesterdayStart.toISOString())
      .lt('calculated_at', yesterdayEnd.toISOString());

    let yesterday = null;
    if (yesterdayRecords && yesterdayRecords.length > 0) {
      const total = yesterdayRecords.length;
      const correct = yesterdayRecords.filter((r) => r.correct).length;
      const accuracy = total > 0 ? correct / total : 0;
      const avgBrier = yesterdayRecords.reduce((s, r) => s + (r.brier_score || 0), 0) / total;

      const vbRecords = yesterdayRecords.filter((r) => r.had_value_bet);
      let valueBetROI = null;
      if (vbRecords.length > 0) {
        const totalProfit = vbRecords.reduce((s, r) => s + (r.value_bet_profit || 0), 0);
        valueBetROI = totalProfit / vbRecords.length;
      }

      yesterday = { total, correct, accuracy, avgBrier, valueBetROI };
    }

    // ── 4. 오늘 Top 5 밸류베팅 ──
    const { data: upcomingPreds } = await supabase
      .from('ai_predictions')
      .select(`
        value_bets, confidence,
        matches (home_team, away_team, start_time)
      `)
      .not('value_bets', 'is', null)
      .gte('matches.start_time', now.toISOString());

    const topValueBets = (upcomingPreds || [])
      .filter((p) => p.matches && p.value_bets?.length > 0)
      .flatMap((p) =>
        p.value_bets.map((vb) => ({
          home_team: p.matches.home_team,
          away_team: p.matches.away_team,
          outcome: vb.outcome,
          edge: vb.edge,
        }))
      )
      .sort((a, b) => b.edge - a.edge)
      .slice(0, 5);

    // ── 5. 발송 ──
    const summary = {
      todayPredictions: todayPredictions || 0,
      todayValueBets,
      yesterday,
      topValueBets,
    };

    // 예측이 하나도 없고 어제 결과도 없으면 발송 skip
    if (summary.todayPredictions === 0 && !summary.yesterday && summary.topValueBets.length === 0) {
      log.info('No data for daily digest, skipping');
      return;
    }

    await sendNotification('daily_digest', summary);
    log.info('=== Daily Digest Complete ===');
  } catch (err) {
    log.error(`Daily digest failed: ${err.message}`);
  }
}

/**
 * 일일 요약 스케줄러 시작 (매일 08:00).
 */
function startScheduler() {
  cron.schedule('0 8 * * *', () => {
    log.info('Daily digest cron triggered');
    sendDailyDigest().catch((err) => {
      log.error(`Scheduled digest failed: ${err.message}`);
    });
  });

  log.info('Daily digest scheduler started (daily at 08:00)');
}

module.exports = { sendDailyDigest, startScheduler };
