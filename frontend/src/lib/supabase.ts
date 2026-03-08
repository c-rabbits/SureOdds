import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 빌드 시 환경변수 없어도 크래시하지 않도록 플레이스홀더 사용
// 실제 런타임에서는 반드시 환경변수를 설정해야 함
let supabase: SupabaseClient;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  // 빌드 타임 또는 미설정 시 더미 URL로 생성 (실제 API 호출은 실패함)
  supabase = createClient(
    'https://placeholder.supabase.co',
    'placeholder-anon-key'
  );
}

export { supabase };
