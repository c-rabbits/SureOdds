-- AI 분석 보고서 테이블
CREATE TABLE IF NOT EXISTS ai_analysis_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  report_data JSONB NOT NULL,
  model_used TEXT DEFAULT 'claude-sonnet',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(match_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_ai_analysis_match ON ai_analysis_reports(match_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_created ON ai_analysis_reports(created_at DESC);
