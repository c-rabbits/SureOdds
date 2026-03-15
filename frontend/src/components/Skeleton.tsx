'use client';

function SkeletonPulse({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-800 rounded animate-pulse ${className}`} />;
}

/** 대시보드 테이블/카드 스켈레톤 */
export function DashboardSkeleton() {
  return (
    <div className="h-full overflow-hidden">
      {/* 모바일: 카드 스켈레톤 */}
      <div className="md:hidden flex flex-col gap-2 p-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
            <div className="flex items-center justify-between mb-2">
              <SkeletonPulse className="h-3 w-28" />
              <SkeletonPulse className="h-3 w-20" />
            </div>
            <div className="flex items-center justify-between mb-2">
              <SkeletonPulse className="h-4 w-24" />
              <SkeletonPulse className="h-4 w-24" />
            </div>
            <div className="flex items-center justify-between">
              <SkeletonPulse className="h-5 w-16" />
              <SkeletonPulse className="h-5 w-14" />
            </div>
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-800">
              <SkeletonPulse className="h-6 w-12" />
              <SkeletonPulse className="h-6 w-12" />
            </div>
          </div>
        ))}
      </div>

      {/* PC: 테이블 스켈레톤 */}
      <div className="hidden md:block">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-6" />
              <th className="w-[140px]">시간</th>
              <th className="w-[180px]">리그</th>
              <th className="w-[140px]">홈</th>
              <th className="w-[140px]">원정</th>
              <th className="w-[100px]">마켓</th>
              <th className="w-[60px]">배당1</th>
              <th className="w-[48px]">북메이커</th>
              <th className="w-[50px]">무승부</th>
              <th className="w-[60px]">배당2</th>
              <th className="w-[48px]">북메이커</th>
              <th className="w-[70px]">양방계수</th>
              <th className="w-[70px]">수익률</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 10 }).map((_, i) => (
              <tr key={i} className="border-b border-gray-800/30">
                <td><SkeletonPulse className="h-4 w-4 mx-auto" /></td>
                <td><SkeletonPulse className="h-3 w-28" /></td>
                <td><SkeletonPulse className="h-3 w-32" /></td>
                <td><SkeletonPulse className="h-3 w-24" /></td>
                <td><SkeletonPulse className="h-3 w-24" /></td>
                <td><SkeletonPulse className="h-5 w-14" /></td>
                <td><SkeletonPulse className="h-3 w-10 mx-auto" /></td>
                <td><SkeletonPulse className="h-3 w-8" /></td>
                <td><SkeletonPulse className="h-3 w-8 mx-auto" /></td>
                <td><SkeletonPulse className="h-3 w-10 mx-auto" /></td>
                <td><SkeletonPulse className="h-3 w-8" /></td>
                <td><SkeletonPulse className="h-3 w-12 mx-auto" /></td>
                <td><SkeletonPulse className="h-3 w-12 mx-auto" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** 국내 배당관리 스켈레톤 */
export function DomesticSkeleton() {
  return (
    <div className="h-full p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <SkeletonPulse className="h-7 w-48 mb-2" />
          <SkeletonPulse className="h-4 w-72" />
        </div>

        {/* 사이트 추가 카드 */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <SkeletonPulse className="h-5 w-32 mb-4" />
          <div className="space-y-3">
            <SkeletonPulse className="h-10 w-full" />
            <div className="grid grid-cols-2 gap-3">
              <SkeletonPulse className="h-10 w-full" />
              <SkeletonPulse className="h-10 w-full" />
            </div>
            <div className="flex gap-4">
              <SkeletonPulse className="h-5 w-16" />
              <SkeletonPulse className="h-5 w-16" />
              <SkeletonPulse className="h-5 w-16" />
            </div>
          </div>
        </div>

        {/* 사이트 목록 카드 */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <SkeletonPulse className="h-5 w-40 mb-4" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-800/30">
              <SkeletonPulse className="h-3 w-3 rounded-full" />
              <SkeletonPulse className="h-4 w-16" />
              <SkeletonPulse className="h-4 w-32" />
              <SkeletonPulse className="h-4 w-20" />
              <div className="flex-1" />
              <SkeletonPulse className="h-6 w-12" />
              <SkeletonPulse className="h-6 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
