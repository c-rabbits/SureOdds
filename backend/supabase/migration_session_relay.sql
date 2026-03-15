-- =========================================
-- SureOdds: 세션 릴레이 마이그레이션
-- 비밀번호 저장 → 세션 토큰 저장 방식 전환
-- =========================================

-- 1) site_registrations 테이블에 세션 관련 컬럼 추가
ALTER TABLE site_registrations
  ADD COLUMN IF NOT EXISTS session_token TEXT,
  ADD COLUMN IF NOT EXISTS session_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS session_status TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS session_last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS session_error TEXT;

-- session_status 값: 'none' (미설정), 'active' (활성), 'expired' (만료), 'error' (오류)

-- 2) available_sites 테이블에 어댑터 설정 추가
ALTER TABLE available_sites
  ADD COLUMN IF NOT EXISTS adapter_key TEXT,
  ADD COLUMN IF NOT EXISTS session_ttl_minutes INTEGER DEFAULT 120;

-- 3) 인덱스 추가 (세션 모니터링 쿼리 최적화)
CREATE INDEX IF NOT EXISTS idx_site_reg_session_status
  ON site_registrations(session_status)
  WHERE is_active = true;

-- 4) login_pw_encrypted 컬럼은 안전하게 nullable로 유지 (추후 삭제)
-- ALTER TABLE site_registrations DROP COLUMN login_pw_encrypted;
-- ^ 검증 완료 후 주석 해제하여 실행

COMMENT ON COLUMN site_registrations.session_token IS '프록시 로그인으로 획득한 세션 쿠키/토큰';
COMMENT ON COLUMN site_registrations.session_status IS 'none=미설정, active=활성, expired=만료, error=오류';
COMMENT ON COLUMN available_sites.adapter_key IS '사이트별 로그인 어댑터 식별자 (예: betman, bet365kr)';
COMMENT ON COLUMN available_sites.session_ttl_minutes IS '세션 기본 유효시간 (분)';
