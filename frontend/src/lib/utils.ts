/**
 * Format a date/time string for display.
 */
export function formatMatchTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get sport emoji.
 */
export function getSportEmoji(sport: string): string {
  const map: Record<string, string> = {
    soccer: '⚽',
    soccer_epl: '⚽',
    soccer_spain_la_liga: '⚽',
    soccer_germany_bundesliga: '⚽',
    soccer_italy_serie_a: '⚽',
    soccer_france_ligue_one: '⚽',
    basketball: '🏀',
    tennis: '🎾',
    americanfootball: '🏈',
    baseball: '⚾',
  };
  return map[sport] || '🏆';
}

/**
 * Get bookmaker display name.
 */
export function getBookmakerName(key: string): string {
  const map: Record<string, string> = {
    bet365: 'Bet365',
    pinnacle: 'Pinnacle',
    stake: 'Stake',
    unibet: 'Unibet',
    betfair: 'Betfair',
    '1xbet': '1xBet',
    williamhill: 'William Hill',
    bwin: 'bwin',
    draftkings: 'DraftKings',
    fanduel: 'FanDuel',
  };
  return map[key] || key;
}

/**
 * Format odds as a decimal with 2 decimals.
 */
export function formatOdds(odds: number | null | undefined): string {
  if (!odds) return '-';
  return odds.toFixed(2);
}

/**
 * Get profit color class based on profit percentage.
 */
export function getProfitColorClass(profit: number): string {
  if (profit >= 3) return 'text-green-400';
  if (profit >= 1) return 'text-green-300';
  if (profit >= 0.5) return 'text-yellow-400';
  return 'text-orange-400';
}
