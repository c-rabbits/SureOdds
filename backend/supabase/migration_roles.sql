-- VIP 등급 시스템 마이그레이션
-- role 컬럼의 CHECK 제약 조건을 업데이트

-- 기존 CHECK 제약 삭제 후 새로 추가
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'vip1', 'vip2', 'vip3', 'vip4', 'vip5', 'test_account', 'user'));
