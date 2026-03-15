/**
 * SureOdds - 샘플 사이트 어댑터
 * 실제 국내 사이트 연동 시 이 파일을 참고하여 구현
 *
 * 구현 예시: 일반적인 국내 배팅 사이트 로그인 패턴
 * - POST로 ID/PW 전송 → Set-Cookie 헤더에서 세션 추출
 * - 인증된 페이지 접근으로 세션 유효성 검증
 */

const axios = require('axios');
const BaseSiteAdapter = require('./BaseSiteAdapter');
const { createServiceLogger } = require('../config/logger');

const log = createServiceLogger('SampleAdapter');

class SampleSiteAdapter extends BaseSiteAdapter {
  getAdapterKey() {
    return 'sample';
  }

  /**
   * 로그인 → 세션 쿠키 획득
   */
  async login(loginId, loginPw) {
    try {
      log.info(`Logging in to ${this.siteName}`, { loginId });

      // 실제 구현 시 사이트별 로그인 엔드포인트와 파라미터로 교체
      const response = await axios.post(
        `${this.siteUrl}/api/login`,
        {
          userId: loginId,
          userPw: loginPw, // 이 값은 이 함수 스코프 내에서만 존재
        },
        {
          maxRedirects: 0,
          validateStatus: (status) => status < 400 || status === 302,
          timeout: 15000,
        }
      );

      // Set-Cookie 헤더에서 세션 토큰 추출
      const cookies = response.headers['set-cookie'];
      if (!cookies || cookies.length === 0) {
        throw new Error('로그인 응답에서 세션 쿠키를 찾을 수 없습니다');
      }

      // 세션 쿠키 파싱 (사이트별로 쿠키 이름이 다름)
      const sessionCookie = cookies
        .map((c) => c.split(';')[0])
        .join('; ');

      const expiresAt = this.calculateExpiresAt();

      log.info(`Login successful for ${this.siteName}`, { loginId, expiresAt });

      return {
        sessionToken: sessionCookie,
        expiresAt,
      };
    } catch (err) {
      log.error(`Login failed for ${this.siteName}`, {
        loginId,
        error: err.message,
      });
      throw new Error(`로그인 실패: ${err.message}`);
    }
    // loginPw는 이 함수가 반환되면 가비지 컬렉션 대상
  }

  /**
   * 세션 유효성 검증 — 인증 필요한 경량 엔드포인트 접근
   */
  async validateSession(sessionToken) {
    try {
      const response = await axios.get(`${this.siteUrl}/api/mypage`, {
        headers: {
          Cookie: sessionToken,
        },
        timeout: 10000,
        validateStatus: () => true,
      });

      const valid = response.status === 200;

      return {
        valid,
        expiresAt: valid ? this.calculateExpiresAt() : undefined,
      };
    } catch (err) {
      log.warn(`Session validation failed for ${this.siteName}`, {
        error: err.message,
      });
      return { valid: false };
    }
  }

  /**
   * 배당률 크롤링 (사이트별 구현)
   */
  async crawlOdds(sessionToken, options = {}) {
    // TODO: 사이트별 배당 페이지 크롤링 로직 구현
    log.info(`Crawling odds from ${this.siteName}`);
    return { matches: [], odds: [] };
  }
}

module.exports = SampleSiteAdapter;
