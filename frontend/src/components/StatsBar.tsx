interface Props {
  matchCount: number;
  arbCount: number;
  topProfit: number;
}

export default function StatsBar({ matchCount, arbCount, topProfit }: Props) {
  return (
    <div className="grid grid-cols-3 gap-4 mb-8">
      <div className="card text-center">
        <div className="text-2xl font-bold text-white">{matchCount}</div>
        <div className="text-xs text-gray-500 mt-1">Live Matches</div>
      </div>
      <div className="card text-center">
        <div className="text-2xl font-bold text-green-400">{arbCount}</div>
        <div className="text-xs text-gray-500 mt-1">Sure Bets</div>
      </div>
      <div className="card text-center">
        <div className="text-2xl font-bold text-green-400">
          {topProfit > 0 ? `+${topProfit.toFixed(2)}%` : '-'}
        </div>
        <div className="text-xs text-gray-500 mt-1">Best Profit</div>
      </div>
    </div>
  );
}
