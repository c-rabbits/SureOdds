/**
 * SureOdds - 국내 사이트 어댑터 베이스 클래스
 * 각 국내 사이트별로 이 클래스를 상속하여 구현
 */

class BaseSiteAdapter {
  /**
   * @param {Object} siteConfig - available_sites 테이블의 설정 정보
   * @param {string} siteConfig.site_url - 사이트 URL
   * @param {string} siteConfig.site_name - 사이트 이름
   * @param {number} siteConfig.session_ttl_minutes - 세션 유효시간 (분)
   */
  constructor(siteConfig) {
    this.siteConfig = siteConfig;
    this.siteName = siteConfig.site_name || 'Unknown';
    this.siteUrl = siteConfig.site_url || '';
    this.sessionTtl = siteConfig.session_ttl_minutes || 120;
  }

  /**
   * 사이트에 로그인하여 세션 토큰을 획득
   * @param {string} loginId - 로그인 ID
   * @param {string} loginPw - 로그인 비밀번호 (사용 후 즉시 폐기됨)
   * @returns {Promise<{sessionToken: string, expiresAt: Date}>}
   * @throws {Error} 로그인 실패 시
   */
  async login(loginId, loginPw) {
    throw new Error(`login() not implemented for ${this.siteName}`);
  }

  /**
   * 세션 토큰이 아직 유효한지 확인
   * @param {string} sessionToken - 저장된 세션 토큰
   * @returns {Promise<{valid: boolean, expiresAt?: Date}>}
   */
  async validateSession(sessionToken) {
    throw new Error(`validateSession() not implemented for ${this.siteName}`);
  }

  /**
   * 세션 토큰을 사용하여 배당률 데이터를 크롤링
   * @param {string} sessionToken - 유효한 세션 토큰
   * @param {Object} options - 크롤링 옵션 (마켓 타입 등)
   * @returns {Promise<{matches: Array, odds: Array}>}
   */
  async crawlOdds(sessionToken, options = {}) {
    throw new Error(`crawlOdds() not implemented for ${this.siteName}`);
  }

  /**
   * 어댑터 키 반환
   * @returns {string}
   */
  getAdapterKey() {
    throw new Error('getAdapterKey() not implemented');
  }

  /**
   * 세션 만료 예상 시간 계산
   * @returns {Date}
   */
  calculateExpiresAt() {
    return new Date(Date.now() + this.sessionTtl * 60 * 1000);
  }
}

module.exports = BaseSiteAdapter;
