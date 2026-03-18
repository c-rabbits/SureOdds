-- ============================================================
-- 사용자 활동 로그 + 프로필 확장
-- ============================================================

-- 1. 활동 로그 테이블
CREATE TABLE IF NOT EXISTS user_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL,
  detail JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_user_id ON user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON user_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_user_action ON user_activity_logs(user_id, action);

-- RLS
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_activity_all" ON user_activity_logs;
CREATE POLICY "service_role_activity_all" ON user_activity_logs
  FOR ALL USING (true) WITH CHECK (true);

-- 2. 프로필 테이블 확장
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS vip_expires_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS admin_memo TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspended_reason TEXT;
