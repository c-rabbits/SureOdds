-- 예측 정확도 추적 테이블
CREATE TABLE IF NOT EXISTS prediction_accuracy (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES matches(id),
  model_type TEXT NOT NULL,
  -- 예측 결과
  predicted_outcome TEXT NOT NULL, -- 'home_win', 'draw', 'away_win'
  predicted_prob DECIMAL(5,4) NOT NULL,
  predicted_home_goals DECIMAL(4,2),
  predicted_away_goals DECIMAL(4,2),
  -- 실제 결과
  actual_outcome TEXT NOT NULL,  -- 'home_win', 'draw', 'away_win'
  actual_home_goals INTEGER NOT NULL,
  actual_away_goals INTEGER NOT NULL,
  -- 정확도 메트릭
  correct BOOLEAN NOT NULL,
  brier_score DECIMAL(6,4), -- (predicted_prob - actual)^2, 낮을수록 좋음
  confidence DECIMAL(5,4),
  -- 밸류 베팅 추적
  had_value_bet BOOLEAN DEFAULT FALSE,
  value_bet_outcome TEXT, -- 'home', 'draw', 'away'
  value_bet_odds DECIMAL(6,2),
  value_bet_edge DECIMAL(5,4),
  value_bet_profit DECIMAL(6,4), -- 단위 배팅 기준 순이익 (1유닛 기준)
  -- 타임스탬프
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_id, model_type)
);

CREATE INDEX IF NOT EXISTS idx_pred_accuracy_model ON prediction_accuracy(model_type);
CREATE INDEX IF NOT EXISTS idx_pred_accuracy_correct ON prediction_accuracy(correct);
CREATE INDEX IF NOT EXISTS idx_pred_accuracy_time ON prediction_accuracy(calculated_at DESC);
