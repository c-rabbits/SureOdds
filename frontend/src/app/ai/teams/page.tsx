'use client';

export default function TeamsPage() {
  return (
    <div className="p-4 pb-8 max-w-4xl mx-auto">
      <div className="mb-4">
        <h1 className="text-lg font-bold text-white">📊 팀 분석</h1>
        <p className="text-xs text-gray-500 mt-0.5">팀별 통계 및 폼 분석</p>
      </div>

      <div className="text-center py-20">
        <div className="text-5xl mb-4">🚧</div>
        <h2 className="text-lg font-bold text-white mb-2">준비 중입니다</h2>
        <p className="text-sm text-gray-400 mb-1">
          팀 통계, ELO 레이팅, 최근 폼 분석 기능이
        </p>
        <p className="text-sm text-gray-400 mb-6">
          Phase 2에서 추가될 예정입니다.
        </p>
        <div className="inline-flex flex-col gap-2 text-left text-xs text-gray-500 bg-gray-800/50 rounded-lg p-4">
          <p>📈 팀별 공격력 / 수비력 레이팅</p>
          <p>⚡ ELO 레이팅 기반 팀 순위</p>
          <p>🔥 최근 5경기 폼 분석</p>
          <p>⚽ 평균 득실점 통계</p>
          <p>📊 리그별 팀 비교</p>
        </div>
      </div>
    </div>
  );
}
