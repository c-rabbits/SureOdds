'use client';

import Link from 'next/link';

const sections = [
  {
    id: 'overview',
    title: '서비스 소개',
    content: `SureOdds는 여러 북메이커의 배당을 실시간으로 비교하여 **양방 베팅 기회**를 자동으로 탐지하고, **AI 기반 경기 예측**을 제공하는 스포츠 분석 플랫폼입니다.

주요 기능:
- 실시간 양방 기회 탐지 (축구, 농구, 야구, 하키)
- AI 경기 예측 (승무패, 핸디캡, 오버/언더)
- 배당 변동 추적
- 팀 분석 (ELO 레이팅, 공격력/수비력)
- 텔레그램/웹 푸시 알림`,
  },
  {
    id: 'dashboard',
    title: '대시보드 사용법',
    content: `대시보드는 SureOdds의 메인 화면입니다.

**상단 요약**
경기 수, 양방 수, 최고 수익률이 표시됩니다.

**필터**
- **종목**: 축구, 농구, 야구, 하키 중 선택
- **마켓**: 승무패, 핸디캡, 오버/언더
- **소스**: 전체, 해외, 국내, 혼합
- **북메이커**: 피나클, 스보벳, 맥스벳 등
- **최소 수익률**: 0.5%+, 1%+, 2%+
- **양방만**: 양방 기회만 필터링
- **리그**: 특정 리그만 선택

**경기 카드 클릭**
경기를 클릭하면 상세 팝업이 열립니다:
- 각 북메이커별 배당 비교
- 양방인 경우 스테이크 계산기 (투자금 입력 → 각 사이트별 베팅 금액 자동 계산)
- 배당 변동 히스토리`,
  },
  {
    id: 'arbitrage',
    title: '양방 베팅이란?',
    content: `양방 베팅(Arbitrage Betting)은 서로 다른 북메이커 간의 배당 차이를 이용하여 **결과에 관계없이 확정 수익**을 얻는 전략입니다.

**예시**
A 사이트: 홈 승리 배당 2.10
B 사이트: 원정 승리 배당 2.05

양방계수가 1.0 미만이면 양방 기회가 존재합니다.
100만원 투자 시:
- A 사이트에 494,000원 베팅 (홈 승리)
- B 사이트에 506,000원 베팅 (원정 승리)
- 어떤 결과든 약 +1.8% 수익 (약 18,000원)

**주의사항**
- 양방 기회는 보통 수 분 내 사라집니다
- 빠른 베팅이 중요합니다
- 수익률이 높을수록 리스크도 고려하세요`,
  },
  {
    id: 'ai',
    title: 'AI 예측',
    content: `AI 예측 메뉴에서는 다양한 경기 분석을 제공합니다.

**오늘 경기**
당일 예정된 경기 목록과 AI 승률 예측을 확인할 수 있습니다.

**경기 상세 (경기 클릭)**
- 승무패 확률
- 예상 스코어 (Poisson 모델)
- 스코어 매트릭스 (히트맵)
- 오버/언더 확률 (1.5, 2.5, 3.5)
- 양팀 모두 득점(BTTS) 확률
- 핸디캡 커버 확률
- 배당 비교 + 배당 변동 차트

**배당 변동**
시간대별 배당 변화를 추적합니다. 급격한 변동은 중요한 정보(부상, 라인업 등)를 반영할 수 있습니다.

**팀 분석**
5대 리그 96팀의 ELO 레이팅, 공격력, 수비력, 최근 폼을 확인할 수 있습니다.

**정확도**
AI 예측의 과거 적중률과 Brier Score를 확인할 수 있습니다.`,
  },
  {
    id: 'alerts',
    title: '알림 설정',
    content: `프로필 페이지에서 알림을 설정할 수 있습니다.

**알림 채널**
- **텔레그램**: 프로필에서 "텔레그램 연동" 버튼 클릭 → 봇과 연결
- **웹 푸시**: 브라우저 알림 허용

**유형별 알림**
- **양방 기회**: 양방 감지 시 알림 (최소 수익률 설정 가능)
- **밸류 베팅**: 고가치 베팅 감지 시 알림
- **일일 요약**: 매일 아침 예측/결과 요약
- **세션 만료**: 사이트 세션 만료 임박 알림

각 유형별로 텔레그램/푸시 on/off와 최소 기준값을 설정할 수 있습니다.`,
  },
  {
    id: 'calculator',
    title: '양방 계산기',
    content: `상단 계산기 아이콘을 클릭하면 양방 계산기를 사용할 수 있습니다.

**사용법**
1. 마켓 유형 선택 (승무패, 핸디캡, 오버/언더)
2. 각 선택지의 배당 입력
3. 총 투자금 입력
4. 자동으로 최적 배분 금액과 보장 수익 계산

**대시보드에서 바로 계산**
경기 카드 클릭 → 상세 팝업에서 양방 기회의 배당이 자동으로 채워진 계산기를 바로 사용할 수 있습니다.`,
  },
  {
    id: 'sites',
    title: '사이트 관리',
    content: `사이트 메뉴에서 베팅 사이트를 등록하고 관리할 수 있습니다.

**사이트 등록**
등록된 사이트 목록에서 사용하는 사이트를 선택하여 추가합니다.

**사이트 요청**
목록에 없는 사이트는 "사이트 요청"으로 관리자에게 추가를 요청할 수 있습니다.`,
  },
  {
    id: 'faq',
    title: '자주 묻는 질문',
    content: `**Q. 양방이 안 보여요**
→ 양방 기회는 항상 존재하는 것이 아닙니다. 필터를 "전체"로 설정하고, "양방만" 필터를 해제해 보세요.

**Q. 알림이 안 와요**
→ 프로필 > 알림 설정에서 텔레그램 또는 웹 푸시가 활성화되어 있는지 확인하세요. 최소 수익률이 너무 높으면 알림이 발생하지 않을 수 있습니다.

**Q. AI 예측은 얼마나 정확한가요?**
→ AI 예측 > 정확도 메뉴에서 과거 적중률을 확인할 수 있습니다. 예측은 참고용이며, 베팅 결과를 보장하지 않습니다.

**Q. 모바일에서도 사용할 수 있나요?**
→ 네. 모바일 브라우저에서 접속하면 모바일에 최적화된 화면으로 표시됩니다. "홈 화면에 추가"로 앱처럼 사용할 수도 있습니다.

**Q. 데이터는 얼마나 자주 업데이트되나요?**
→ 배당 데이터는 자동으로 갱신됩니다. 대시보드는 30초마다 자동 새로고침됩니다.`,
  },
];

function MarkdownText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        if (line.startsWith('**Q.')) {
          return <p key={i} className="text-sm font-semibold text-white mt-3">{line.replace(/\*\*/g, '')}</p>;
        }
        if (line.startsWith('→')) {
          return <p key={i} className="text-sm text-gray-400 ml-2">{line}</p>;
        }
        if (line.startsWith('- ')) {
          return <p key={i} className="text-sm text-gray-300 ml-3">• {line.slice(2).replace(/\*\*/g, '')}</p>;
        }
        if (line.match(/^\d+\./)) {
          return <p key={i} className="text-sm text-gray-300 ml-3">{line.replace(/\*\*/g, '')}</p>;
        }
        if (line.trim() === '') return <div key={i} className="h-1" />;
        // Bold 처리
        const parts = line.split(/\*\*(.*?)\*\*/g);
        return (
          <p key={i} className="text-sm text-gray-300">
            {parts.map((part, j) =>
              j % 2 === 1 ? <span key={j} className="font-semibold text-white">{part}</span> : part
            )}
          </p>
        );
      })}
    </div>
  );
}

export default function GuidePage() {
  return (
    <div className="p-4 pb-8 max-w-2xl mx-auto pt-6">
      <h1 className="text-lg font-bold text-white mb-1">사용 가이드</h1>
      <p className="text-sm text-gray-500 mb-6">SureOdds 서비스 이용 방법을 안내합니다.</p>

      {/* 목차 */}
      <div className="card p-4 mb-6">
        <h2 className="text-sm font-semibold text-gray-400 mb-2">목차</h2>
        <div className="flex flex-wrap gap-2">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="text-xs px-2.5 py-1 rounded-full bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
            >
              {s.title}
            </a>
          ))}
        </div>
      </div>

      {/* 섹션들 */}
      <div className="space-y-4">
        {sections.map((s) => (
          <div key={s.id} id={s.id} className="card p-4 scroll-mt-16">
            <h2 className="text-sm font-bold text-green-400 mb-3">{s.title}</h2>
            <MarkdownText text={s.content} />
          </div>
        ))}
      </div>

      {/* 하단 */}
      <div className="text-center mt-6">
        <p className="text-xs text-gray-600 mb-2">더 궁금한 점이 있으면 고객 지원으로 문의해주세요.</p>
        <Link href="/profile" className="text-xs text-blue-400 hover:text-blue-300">
          ← 프로필로 돌아가기
        </Link>
      </div>
    </div>
  );
}
