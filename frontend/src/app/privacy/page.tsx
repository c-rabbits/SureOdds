'use client';

import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-300">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link href="/" className="text-sm text-gray-500 hover:text-gray-300 mb-6 inline-block">
          &larr; 홈으로
        </Link>

        <h1 className="text-2xl font-bold text-white mb-8">개인정보처리방침</h1>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. 수집하는 개인정보 항목</h2>
            <p>서비스는 다음의 개인정보를 수집합니다:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li><strong className="text-gray-300">필수 항목:</strong> 아이디(이메일), 비밀번호</li>
              <li><strong className="text-gray-300">선택 항목:</strong> 닉네임, 텔레그램 Chat ID</li>
              <li><strong className="text-gray-300">자동 수집:</strong> 접속 IP, 브라우저 정보(User-Agent), 접속 시간, 서비스 이용 기록</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. 개인정보의 수집 및 이용 목적</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li><strong className="text-gray-300">회원 관리:</strong> 본인 확인, 계정 관리, 부정 이용 방지</li>
              <li><strong className="text-gray-300">서비스 제공:</strong> 알림 발송(텔레그램, 웹 푸시), 개인화 설정 저장</li>
              <li><strong className="text-gray-300">서비스 개선:</strong> 접속 통계, 이용 패턴 분석</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. 개인정보의 보유 및 이용 기간</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li>회원 탈퇴 시 지체 없이 파기합니다.</li>
              <li>관련 법령에 의해 보존이 필요한 경우 해당 기간 동안 보관합니다.</li>
              <li>접속 로그: 3개월 보관 후 자동 삭제</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. 개인정보의 제3자 제공</h2>
            <p>서비스는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 단, 법령에 의한 요구가 있는 경우는 예외로 합니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. 개인정보 처리 위탁</h2>
            <p>서비스 운영을 위해 다음의 외부 서비스를 이용합니다:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
              <li><strong className="text-gray-300">Supabase:</strong> 데이터베이스 및 인증 (미국)</li>
              <li><strong className="text-gray-300">Vercel:</strong> 웹 호스팅 (미국)</li>
              <li><strong className="text-gray-300">Railway:</strong> 백엔드 서버 호스팅 (미국)</li>
              <li><strong className="text-gray-300">Telegram:</strong> 알림 발송</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. 이용자의 권리</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li>개인정보 열람, 수정, 삭제를 요청할 수 있습니다.</li>
              <li>프로필 페이지에서 닉네임 변경, 텔레그램 연동 해제가 가능합니다.</li>
              <li>계정 삭제를 원하시면 관리자에게 문의하세요.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. 개인정보의 안전성 확보 조치</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-400">
              <li>비밀번호는 단방향 암호화하여 저장합니다 (Supabase Auth).</li>
              <li>모든 통신은 HTTPS(SSL/TLS)로 암호화됩니다.</li>
              <li>관리자 접근 권한을 최소화하고, 접근 기록을 관리합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. 쿠키(Cookie) 사용</h2>
            <p>서비스는 인증 토큰 저장을 위해 쿠키를 사용합니다. 이용자는 브라우저 설정에서 쿠키 사용을 거부할 수 있으나, 이 경우 서비스 이용이 제한될 수 있습니다.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. 개인정보 보호책임자</h2>
            <p className="text-gray-400">문의: 서비스 내 관리자에게 연락</p>
          </section>

          <p className="text-gray-600 mt-8">시행일: 2026년 3월 19일</p>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-800">
          <Link href="/terms" className="text-sm text-green-400 hover:text-green-300">
            이용약관 보기 &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
