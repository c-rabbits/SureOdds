-- VIP 등급 시스템 마이그레이션
-- role 컬럼의 CHECK 제약 조건 + 기본값 업데이트

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'vip1', 'vip2', 'vip3', 'vip4', 'vip5', 'test_vip1', 'test_vip2', 'test_vip3', 'test_vip4', 'test_vip5'));

-- 기본값을 vip1로 변경
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'vip1';

-- 기존 'user' 역할을 vip1로 변환
UPDATE public.profiles SET role = 'vip1' WHERE role = 'user';
-- 기존 'test_account' 역할을 test_vip1로 변환
UPDATE public.profiles SET role = 'test_vip1' WHERE role = 'test_account';
