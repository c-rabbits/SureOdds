'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // 로그인 상태면 대시보드로
  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-transparent to-blue-500/10" />
        <div className="relative max-w-4xl mx-auto px-6 pt-16 pb-20 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <svg viewBox="0 0 32 32" className="w-10 h-10">
              <rect width="32" height="32" rx="6" fill="#0f172a" stroke="#10b981" strokeWidth="1.5"/>
              <text x="50%" y="48%" textAnchor="middle" dominantBaseline="central" fontFamily="Arial" fontWeight="900" fontSize="14" fill="#10b981">S</text>
              <circle cx="25" cy="7" r="2" fill="#fbbf24"/>
            </svg>
            <span className="text-2xl font-bold tracking-tight">SureOdds</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4 leading-tight">
            스포츠 양방 탐지
            <br />
            <span className="text-green-400">+ AI 경기 예측</span>
          </h1>

          <p className="text-gray-400 text-base sm:text-lg max-w-xl mx-auto mb-10">
            멀티 북메이커 실시간 배당 비교, 양방 기회 자동 탐지,
            AI 기반 경기 결과 예측을 한곳에서
          </p>

          <div className="flex items-center justify-center gap-3">
            <Link
              href="/login"
              className="px-8 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold text-sm transition-colors"
            >
              로그인
            </Link>
            <a
              href="#features"
              className="px-8 py-3 rounded-xl border border-gray-700 hover:border-gray-500 text-gray-300 font-medium text-sm transition-colors"
            >
              더 알아보기
            </a>
          </div>
        </div>
      </div>

      {/* Features */}
      <section id="features" className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-center text-xl font-bold mb-12 text-gray-300">주요 기능</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            icon={
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            }
            title="실시간 양방 탐지"
            desc="피나클, 스보벳, 맥스벳 등 주요 북메이커의 배당을 실시간 비교하여 양방 기회를 자동 탐지합니다."
          />
          <FeatureCard
            icon={
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
            }
            title="AI 경기 예측"
            desc="Poisson 분포 모델과 ELO 레이팅 기반으로 승무패, 스코어, 오버/언더, 핸디캡 확률을 예측합니다."
          />
          <FeatureCard
            icon={
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
            }
            title="실시간 알림"
            desc="텔레그램, Web Push로 양방 기회와 배당 변동을 즉시 알려드립니다. 유형별 알림 설정이 가능합니다."
          />
          <FeatureCard
            icon={
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
              </svg>
            }
            title="배당 변동 추적"
            desc="시간별 배당 변동 그래프와 변동률 기반 정렬로 시장 움직임을 한눈에 파악합니다."
          />
          <FeatureCard
            icon={
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V13.5zm0 2.25h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V18zm2.498-6.75h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V13.5zm0 2.25h.007v.008h-.007v-.008zm0 2.25h.007v.008h-.007V18zm2.504-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zm0 2.25h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V18zm2.498-6.75h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V13.5zM8.25 6h7.5v2.25h-7.5V6zM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0012 2.25z" />
              </svg>
            }
            title="양방 계산기"
            desc="투자 금액 대비 각 북메이커별 베팅 금액과 보장 수익을 자동 계산합니다."
          />
          <FeatureCard
            icon={
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
              </svg>
            }
            title="모바일 앱"
            desc="PWA 지원으로 홈 화면에 추가하면 네이티브 앱처럼 사용할 수 있습니다."
          />
        </div>
      </section>

      {/* Sports */}
      <section className="max-w-4xl mx-auto px-6 py-12">
        <h2 className="text-center text-xl font-bold mb-8 text-gray-300">지원 종목</h2>
        <div className="flex items-center justify-center gap-8 flex-wrap">
          {[
            { emoji: '\u26BD', name: '축구' },
            { emoji: '\uD83C\uDFC0', name: '농구' },
            { emoji: '\u26BE', name: '야구' },
            { emoji: '\uD83C\uDFD2', name: '하키' },
          ].map((s) => (
            <div key={s.name} className="flex flex-col items-center gap-2">
              <span className="text-3xl">{s.emoji}</span>
              <span className="text-sm text-gray-400">{s.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h2 className="text-2xl font-bold mb-4">지금 시작하세요</h2>
        <p className="text-gray-400 mb-8">실시간 양방 기회를 놓치지 마세요</p>
        <Link
          href="/login"
          className="inline-block px-10 py-3.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold text-sm transition-colors"
        >
          로그인
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800/50 py-8 text-center">
        <div className="flex items-center justify-center gap-4 text-xs text-gray-600">
          <Link href="/terms" className="hover:text-gray-400 transition-colors">이용약관</Link>
          <span>|</span>
          <Link href="/privacy" className="hover:text-gray-400 transition-colors">개인정보처리방침</Link>
        </div>
        <p className="text-xs text-gray-700 mt-3">SureOdds</p>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-5 hover:border-gray-700/50 transition-colors">
      <div className="text-green-400 mb-3">{icon}</div>
      <h3 className="text-sm font-bold text-white mb-1.5">{title}</h3>
      <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
    </div>
  );
}
