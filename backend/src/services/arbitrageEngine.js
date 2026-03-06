/**
 * Arbitrage (Sure Bet) Detection Engine
 *
 * For a 2-way market (e.g. home/away):
 *   arb = 1/oddsA + 1/oddsB
 *   if arb < 1  →  arbitrage opportunity exists
 *   profit% = (1 - arb) * 100
 *
 * For a 3-way market (home/draw/away):
 *   arb = 1/oddsHome + 1/oddsDraw + 1/oddsAway
 */

/**
 * Calculate the arbitrage percentage and profit for given odds.
 * @param {number[]} oddsArray - Array of best odds for each outcome
 * @returns {{ arb: number, profit: number, isArbitrage: boolean }}
 */
function calculateArbitrage(oddsArray) {
  if (!oddsArray || oddsArray.length < 2) return null;

  const arb = oddsArray.reduce((sum, odd) => sum + 1 / odd, 0);
  const profit = (1 - arb) * 100;
  const isArbitrage = arb < 1;

  return { arb: parseFloat(arb.toFixed(6)), profit: parseFloat(profit.toFixed(4)), isArbitrage };
}

/**
 * Find the best odds for each outcome across all bookmakers.
 * @param {Array} oddsRecords - Array of odds rows from DB for a single match
 * @returns {{ bestOdds: object, opportunities: Array }}
 */
function findBestOdds(oddsRecords) {
  const bestHome = { odds: 0, bookmaker: null };
  const bestDraw = { odds: 0, bookmaker: null };
  const bestAway = { odds: 0, bookmaker: null };

  for (const record of oddsRecords) {
    if (record.home_odds && record.home_odds > bestHome.odds) {
      bestHome.odds = record.home_odds;
      bestHome.bookmaker = record.bookmaker;
    }
    if (record.draw_odds && record.draw_odds > bestDraw.odds) {
      bestDraw.odds = record.draw_odds;
      bestDraw.bookmaker = record.bookmaker;
    }
    if (record.away_odds && record.away_odds > bestAway.odds) {
      bestAway.odds = record.away_odds;
      bestAway.bookmaker = record.bookmaker;
    }
  }

  return { bestHome, bestDraw, bestAway };
}

/**
 * Calculate how to distribute stake across outcomes for guaranteed profit.
 * @param {number} totalStake - Total amount to bet
 * @param {number[]} oddsArray - Best odds for each outcome
 * @returns {number[]} - Stakes for each outcome
 */
function calculateStakes(totalStake, oddsArray) {
  const arb = oddsArray.reduce((sum, odd) => sum + 1 / odd, 0);
  return oddsArray.map((odd) => parseFloat(((totalStake / odd / arb) * (1 / odd) * arb).toFixed(2)));
}

/**
 * Simpler stake calculator: each stake = (totalStake / arb) * (1/odd)
 */
function distributeStake(totalStake, oddsArray) {
  const arb = oddsArray.reduce((sum, odd) => sum + 1 / odd, 0);
  const stakes = oddsArray.map((odd) => parseFloat(((totalStake / arb) * (1 / odd)).toFixed(2)));
  // Compute expected return from any winning outcome
  const returns = oddsArray.map((odd, i) => parseFloat((stakes[i] * odd).toFixed(2)));
  const minReturn = Math.min(...returns);
  const profit = parseFloat((minReturn - totalStake).toFixed(2));

  return { stakes, returns, profit };
}

/**
 * Detect arbitrage for a single match given its odds records.
 */
function detectArbitrageForMatch(match, oddsRecords) {
  if (!oddsRecords || oddsRecords.length < 2) return null;

  const { bestHome, bestDraw, bestAway } = findBestOdds(oddsRecords);

  // Try 3-way if draw odds exist
  let result3way = null;
  if (bestDraw.odds > 0 && bestHome.odds > 0 && bestAway.odds > 0) {
    const arb3 = calculateArbitrage([bestHome.odds, bestDraw.odds, bestAway.odds]);
    if (arb3 && arb3.isArbitrage) {
      result3way = {
        match_id: match.id,
        market_type: '3way',
        bookmaker_home: bestHome.bookmaker,
        bookmaker_draw: bestDraw.bookmaker,
        bookmaker_away: bestAway.bookmaker,
        odds_home: bestHome.odds,
        odds_draw: bestDraw.odds,
        odds_away: bestAway.odds,
        profit_percent: arb3.profit,
        arb_factor: arb3.arb,
      };
    }
  }

  // Try 2-way (home vs away)
  let result2way = null;
  if (bestHome.odds > 0 && bestAway.odds > 0) {
    const arb2 = calculateArbitrage([bestHome.odds, bestAway.odds]);
    if (arb2 && arb2.isArbitrage) {
      result2way = {
        match_id: match.id,
        market_type: '2way',
        bookmaker_home: bestHome.bookmaker,
        bookmaker_away: bestAway.bookmaker,
        odds_home: bestHome.odds,
        odds_away: bestAway.odds,
        profit_percent: arb2.profit,
        arb_factor: arb2.arb,
      };
    }
  }

  return result3way || result2way;
}

module.exports = {
  calculateArbitrage,
  findBestOdds,
  distributeStake,
  detectArbitrageForMatch,
};
