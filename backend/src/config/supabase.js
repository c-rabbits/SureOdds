const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase;

if (supabaseUrl && supabaseServiceKey) {
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
} else {
  console.warn('⚠ Supabase credentials not set. Running in MOCK DATA mode.');

  // 재귀적 체이너블 Proxy: 어떤 프로퍼티/메서드를 호출해도 크래시하지 않음
  function createChainableProxy() {
    const handler = {
      get: (target, prop) => {
        // .then 은 Promise 호환성 위해 특별 처리
        if (prop === 'then') {
          return (resolve) =>
            resolve({ data: null, error: new Error('Supabase not configured') });
        }
        // 함수 호출도 다시 체이너블 프록시 반환
        return (...args) => createChainableProxy();
      },
      apply: (target, thisArg, args) => {
        return createChainableProxy();
      },
    };
    // Proxy 대상을 함수로 해서 호출 가능하게
    return new Proxy(function () {}, handler);
  }

  supabase = new Proxy({}, {
    get: (target, prop) => {
      // 'from', 'auth', 'storage' 등 모든 프로퍼티에 체이너블 프록시 반환
      return createChainableProxy();
    },
  });
}

module.exports = supabase;
