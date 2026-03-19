'use client';

import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-300">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-300 mb-6 inline-block">
          &larr; 홈으로
        </Link>

        <h1 className="text-2xl font-bold text-white mb-8">이용약관</h1>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">제1조 (목적)</h2>
            <p>이 약관은 SureOdds(이하 &quot;서비스&quot;)가 제공하는 스포츠 데이터 분석 서비스의 이용조건 및 절차에 관한 사항을 규정함을 목적으로 합니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">제2조 (서비스의 내용)</h2>
            <p>서비스는 다음의 기능을 제공합니다:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li>스포츠 경기 배당률 비교 및 분석</li>
              <li>AI 기반 경기 결과 예측</li>
              <li>양방 베팅 기회 탐지</li>
              <li>텔레그램/웹 푸시 알림</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">제3조 (면책조항)</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li>서비스는 정보 제공 목적이며, 베팅을 권유하거나 보장하지 않습니다.</li>
              <li>AI 예측 및 양방 분석 결과는 참고용이며, 이를 기반으로 한 베팅의 결과에 대해 서비스는 책임을 지지 않습니다.</li>
              <li>배당률 데이터는 제3자 API를 통해 수집되며, 실시간 정확성을 보장하지 않습니다.</li>
              <li>서비스 이용으로 인한 직접적, 간접적 손해에 대해 책임을 지지 않습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">제4조 (이용자의 의무)</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li>이용자는 관련 법률을 준수하여야 합니다.</li>
              <li>타인의 계정을 무단으로 사용하거나 서비스를 악용해서는 안 됩니다.</li>
              <li>서비스의 데이터를 무단 복제, 배포, 상업적 이용해서는 안 됩니다.</li>
              <li>계정 정보의 관리 책임은 이용자에게 있습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">제5조 (서비스 변경 및 중단)</h2>
            <p>서비스는 운영상, 기술상의 필요에 의해 서비스의 전부 또는 일부를 변경하거나 중단할 수 있습니다. 이 경우 사전에 공지하되, 불가피한 사유가 있는 경우 사후에 공지할 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">제6조 (계정 관리)</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li>서비스는 이용약관 위반, 부정 이용 등의 사유가 있는 경우 이용자의 계정을 정지하거나 삭제할 수 있습니다.</li>
              <li>VIP 등급 및 유효기간은 서비스 정책에 따라 변경될 수 있습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">제7조 (준거법)</h2>
            <p>이 약관의 해석 및 적용에 관하여는 대한민국 법률을 준거법으로 합니다.</p>
          </section>

          <p className="text-gray-600 mt-8">시행일: 2026년 3월 19일</p>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-800">
          <Link href="/privacy" className="text-sm text-green-400 hover:text-green-300">
            개인정보처리방침 보기 &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
