/**
 * SureOdds - 사이트 어댑터 레지스트리
 * adapter_key → AdapterClass 매핑
 */

const SampleSiteAdapter = require('./SampleSiteAdapter');

// 어댑터 등록 (새 사이트 추가 시 여기에 등록)
const adapters = {
  sample: SampleSiteAdapter,
  // 예시: 'bet365kr': Bet365KrAdapter,
  // 예시: 'pinnacle_kr': PinnacleKrAdapter,
};

/**
 * adapter_key로 어댑터 인스턴스 생성
 * @param {string} adapterKey - available_sites.adapter_key
 * @param {Object} siteConfig - 사이트 설정 (url, name, ttl 등)
 * @returns {BaseSiteAdapter}
 * @throws {Error} 알 수 없는 adapter_key
 */
function getAdapter(adapterKey, siteConfig) {
  const AdapterClass = adapters[adapterKey];
  if (!AdapterClass) {
    throw new Error(`알 수 없는 어댑터: ${adapterKey}. 등록된 어댑터: ${Object.keys(adapters).join(', ')}`);
  }
  return new AdapterClass(siteConfig);
}

/**
 * 등록된 어댑터 목록 반환
 * @returns {string[]}
 */
function getAvailableAdapters() {
  return Object.keys(adapters);
}

module.exports = { getAdapter, getAvailableAdapters };
