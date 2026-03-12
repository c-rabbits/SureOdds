/**
 * Arbitrage (Sure Bet) Detection Engine v2
 *
 * Supports h2h, spreads, and totals markets.
 *
 * For a 2-way market (spreads, totals, or h2h without draw):
 *   arb = 1/odds1 + 1/odds2
 *   if arb < 1  →  arbitrage opportunity exists
 *
 * For a 3-way market (h2h with draw):
 *   arb = 1/oddsHome + 1/oddsDraw + 1/oddsAway
 */

/**
 * Calculate the arbitrage percentage and profit for given odds.
 */
function calculateArbitrage(oddsArray) {
  if (!oddsArray || oddsArray.length < 2) return null;
  if (oddsArray.some((o) => !o || o <= 1)) return null;

  const arb = oddsArray.reduce((sum, odd) => sum + 1 / odd, 0);
  const profit = (1 - arb) * 100;
  const isArbitrage = arb < 1;

  return { arb: parseFloat(arb.toFixed(6)), profit: parseFloat(profit.toFixed(4)), isArbitrage };
}

/**
 * Find the best odds for each outcome in a 2-way market (spreads, totals).
 */
function findBestOdds2Way(oddsRecords) {
  const best1 = { odds: 0, bookmaker: null };
  const best2 = { odds: 0, bookmaker: null };

  for (const record of oddsRecords) {
    if (record.outcome_1_odds && record.outcome_1_odds > best1.odds) {
      best1.odds = record.outcome_1_odds;
      best1.bookmaker = record.bookmaker;
    }
    if (record.outcome_2_odds && record.outcome_2_odds > best2.odds) {
      best2.odds = record.outcome_2_odds;
      best2.bookmaker = record.bookmaker;
    }
  }

  return { bestOutcome1: best1, bestOutcome2: best2 };
}

/**
 * Find the best odds for each outcome in a 3-way h2h market.
 */
function findBestOddsH2H(oddsRecords) {
  const bestHome = { odds: 0, bookmaker: null };
  const bestDraw = { odds: 0, bookmaker: null };
  const bestAway = { odds: 0, bookmaker: null };

  for (const record of oddsRecords) {
    if (record.outcome_1_odds && record.outcome_1_odds > bestHome.odds) {
      bestHome.odds = record.outcome_1_odds;
      bestHome.bookmaker = record.bookmaker;
    }
    if (record.outcome_draw_odds && record.outcome_draw_odds > bestDraw.odds) {
      bestDraw.odds = record.outcome_draw_odds;
      bestDraw.bookmaker = record.bookmaker;
    }
    if (record.outcome_2_odds && record.outcome_2_odds > bestAway.odds) {
      bestAway.odds = record.outcome_2_odds;
      bestAway.bookmaker = record.bookmaker;
    }
  }

  return { bestHome, bestDraw, bestAway };
}

/**
 * Check if at least 2 different bookmakers are involved.
 * Same-bookmaker "arbitrage" is not exploitable in practice.
 */
function hasMultipleBookmakers(...bookmakers) {
  const unique = new Set(bookmakers.filter(Boolean));
  return unique.size >= 2;
}

/**
 * Detect h2h arbitrage (2-way and 3-way).
 * Skips if all best odds come from the same bookmaker.
 */
function detectH2hArbitrage(match, oddsRecords) {
  const { bestHome, bestDraw, bestAway } = findBestOddsH2H(oddsRecords);

  // Try 3-way first if draw odds exist
  if (bestDraw.odds > 0 && bestHome.odds > 0 && bestAway.odds > 0) {
    // Skip if all best odds are from the same bookmaker
    if (!hasMultipleBookmakers(bestHome.bookmaker, bestDraw.bookmaker, bestAway.bookmaker)) {
      return null;
    }
    const arb3 = calculateArbitrage([bestHome.odds, bestDraw.odds, bestAway.odds]);
    if (arb3 && arb3.isArbitrage) {
      return {
        match_id: match.id,
        market_type: 'h2h',
        handicap_point: null,
        bookmaker_a: bestHome.bookmaker,
        bookmaker_b: bestAway.bookmaker,
        bookmaker_draw: bestDraw.bookmaker,
        odds_a: bestHome.odds,
        odds_b: bestAway.odds,
        odds_draw: bestDraw.odds,
        profit_percent: arb3.profit,
        arb_factor: arb3.arb,
      };
    }
  }

  // Try 2-way (home vs away)
  if (bestHome.odds > 0 && bestAway.odds > 0) {
    // Skip if both best odds are from the same bookmaker
    if (!hasMultipleBookmakers(bestHome.bookmaker, bestAway.bookmaker)) {
      return null;
    }
    const arb2 = calculateArbitrage([bestHome.odds, bestAway.odds]);
    if (arb2 && arb2.isArbitrage) {
      return {
        match_id: match.id,
        market_type: 'h2h',
        handicap_point: null,
        bookmaker_a: bestHome.bookmaker,
        bookmaker_b: bestAway.bookmaker,
        bookmaker_draw: null,
        odds_a: bestHome.odds,
        odds_b: bestAway.odds,
        odds_draw: null,
        profit_percent: arb2.profit,
        arb_factor: arb2.arb,
      };
    }
  }

  return null;
}

/**
 * Detect arbitrage for a 2-way market (spreads or totals).
 */
function detect2WayArbitrage(match, oddsRecords, marketType, handicapPoint) {
  const { bestOutcome1, bestOutcome2 } = findBestOdds2Way(oddsRecords);

  if (bestOutcome1.odds > 0 && bestOutcome2.odds > 0) {
    // Skip if both best odds are from the same bookmaker
    if (!hasMultipleBookmakers(bestOutcome1.bookmaker, bestOutcome2.bookmaker)) {
      return null;
    }
    const arb = calculateArbitrage([bestOutcome1.odds, bestOutcome2.odds]);
    if (arb && arb.isArbitrage) {
      return {
        match_id: match.id,
        market_type: marketType,
        handicap_point: handicapPoint,
        bookmaker_a: bestOutcome1.bookmaker,
        bookmaker_b: bestOutcome2.bookmaker,
        bookmaker_draw: null,
        odds_a: bestOutcome1.odds,
        odds_b: bestOutcome2.odds,
        odds_draw: null,
        profit_percent: arb.profit,
        arb_factor: arb.arb,
      };
    }
  }

  return null;
}

/**
 * Detect arbitrage across all market types for a match.
 * Groups odds by (market_type, handicap_point) and checks each.
 */
function detectAllArbitrageForMatch(match, allOddsRecords) {
  const opportunities = [];

  // Group by market_type + handicap_point
  const groups = {};
  for (const record of allOddsRecords) {
    const key = `${record.market_type}|${record.handicap_point ?? 'null'}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(record);
  }

  for (const [key, records] of Object.entries(groups)) {
    if (records.length < 2) continue;

    const [marketType, pointStr] = key.split('|');
    const handicapPoint = pointStr === 'null' ? null : parseFloat(pointStr);

    if (marketType === 'h2h') {
      const opp = detectH2hArbitrage(match, records);
      if (opp) opportunities.push(opp);
    } else {
      // spreads or totals: 2-way
      const opp = detect2WayArbitrage(match, records, marketType, handicapPoint);
      if (opp) opportunities.push(opp);
    }
  }

  return opportunities;
}

/**
 * Calculate optimal stake distribution for guaranteed profit.
 */
function distributeStake(totalStake, oddsArray) {
  if (!oddsArray || oddsArray.length < 2) return null;
  if (oddsArray.some((o) => !o || o <= 1)) return null;

  const arb = oddsArray.reduce((sum, odd) => sum + 1 / odd, 0);
  const stakes = oddsArray.map((odd) => parseFloat(((totalStake / arb) * (1 / odd)).toFixed(2)));
  const returns = oddsArray.map((odd, i) => parseFloat((stakes[i] * odd).toFixed(2)));
  const minReturn = Math.min(...returns);
  const profit = parseFloat((minReturn - totalStake).toFixed(2));
  const profitPercent = parseFloat(((profit / totalStake) * 100).toFixed(4));

  return {
    totalStake,
    stakes,
    returns,
    profit,
    profitPercent,
    isArbitrage: arb < 1,
  };
}

module.exports = {
  calculateArbitrage,
  hasMultipleBookmakers,
  findBestOdds2Way,
  findBestOddsH2H,
  detectH2hArbitrage,
  detect2WayArbitrage,
  detectAllArbitrageForMatch,
  distributeStake,
};
