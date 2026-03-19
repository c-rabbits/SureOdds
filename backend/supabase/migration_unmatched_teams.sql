-- 매칭 실패 팀명 기록 (관리자 확인 + 수동 매핑 추가용)
CREATE TABLE IF NOT EXISTS unmatched_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  korean_name TEXT NOT NULL UNIQUE,
  english_name TEXT,              -- 관리자가 수동 입력
  resolved BOOLEAN DEFAULT FALSE,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unmatched_resolved ON unmatched_teams(resolved);

-- RLS
ALTER TABLE unmatched_teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_unmatched_all" ON unmatched_teams;
CREATE POLICY "service_role_unmatched_all" ON unmatched_teams
  FOR ALL USING (true) WITH CHECK (true);
