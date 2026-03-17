-- App Settings Table (관리자 설정)
-- key-value 방식의 앱 전역 설정 저장

CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL DEFAULT 'null',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- 기본 설정값 삽입
INSERT INTO app_settings (key, value) VALUES
  ('allow_concurrent_login', 'true'),
  ('force_logout_on_new_login', 'true'),
  ('limit_max_sessions', 'false'),
  ('enable_web_push', 'true'),
  ('enable_telegram', 'true'),
  ('maintenance_mode', 'false'),
  ('allow_signup', 'false')
ON CONFLICT (key) DO NOTHING;
