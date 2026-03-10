/**
 * SureOdds - 재시도 로직이 내장된 HTTP 클라이언트
 *
 * 외부 API (The Odds API, Betman 등) 호출 시 사용
 * - 네트워크 장애 시 지수 백오프로 최대 3회 재시도
 * - 5xx / 429 에러 시 자동 재시도
 * - 타임아웃 에러 시 재시도
 */
const axios = require('axios');
const axiosRetry = require('axios-retry').default;
const { createServiceLogger } = require('./logger');

const log = createServiceLogger('HTTP');

/**
 * 재시도 로직이 적용된 Axios 인스턴스 생성
 * @param {string} serviceName - 로깅용 서비스명
 * @param {object} options - Axios 설정 오버라이드
 * @returns {import('axios').AxiosInstance}
 */
function createHttpClient(serviceName, options = {}) {
  const client = axios.create({
    timeout: 20000,
    ...options,
  });

  axiosRetry(client, {
    retries: 3,
    retryDelay: (retryCount) => {
      const delay = axiosRetry.exponentialDelay(retryCount);
      log.warn(`[${serviceName}] Retry #${retryCount} after ${delay}ms`);
      return delay;
    },
    retryCondition: (error) => {
      // 네트워크 에러 또는 타임아웃
      if (axiosRetry.isNetworkOrIdempotentRequestError(error)) return true;
      // 5xx 서버 에러
      if (error.response && error.response.status >= 500) return true;
      // 429 Rate Limit
      if (error.response && error.response.status === 429) return true;
      return false;
    },
    onRetry: (retryCount, error, requestConfig) => {
      log.warn(`[${serviceName}] Request failed, retry #${retryCount}`, {
        url: requestConfig.url,
        error: error.message,
        status: error.response?.status,
      });
    },
  });

  return client;
}

module.exports = { createHttpClient };
