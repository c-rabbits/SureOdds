/**
 * SureOdds - 기본 관리자 계정 시드 스크립트
 * 사용법: npm run seed:admin
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ SUPABASE_URL과 SUPABASE_SERVICE_KEY 환경변수가 필요합니다.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin@sureodds.com';
  const password = process.env.ADMIN_PASSWORD || 'changeme123!';

  console.log(`🔧 관리자 계정 생성 중: ${email}`);

  // Supabase Admin API로 사용자 생성 (이메일 확인 건너뜀)
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: '관리자',
      role: 'admin',
    },
  });

  if (error) {
    if (error.message.includes('already been registered')) {
      console.log('ℹ️  이미 등록된 이메일입니다. 기존 계정의 역할을 admin으로 업데이트합니다.');

      // 기존 사용자의 프로필을 admin으로 업데이트
      const { data: users } = await supabase.auth.admin.listUsers();
      const existingUser = users?.users?.find((u) => u.email === email);

      if (existingUser) {
        await supabase
          .from('profiles')
          .update({ role: 'admin', display_name: '관리자' })
          .eq('id', existingUser.id);
        console.log('✅ 관리자 역할 업데이트 완료.');
      }
      return;
    }
    console.error('❌ 관리자 생성 실패:', error.message);
    process.exit(1);
  }

  // 트리거가 profiles 생성하지만, role을 확실히 admin으로 설정
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ role: 'admin', display_name: '관리자' })
    .eq('id', data.user.id);

  if (profileError) {
    console.warn('⚠️  프로필 업데이트 경고:', profileError.message);
  }

  console.log('✅ 관리자 계정 생성 완료!');
  console.log(`   이메일: ${email}`);
  console.log(`   비밀번호: ${password}`);
  console.log('   ⚠️  첫 로그인 후 반드시 비밀번호를 변경하세요!');
}

seedAdmin().catch(console.error);
