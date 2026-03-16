export type NotificationType = 'arbitrage' | 'value_bet' | 'daily_digest' | 'session_expiry';

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: { url?: string; [key: string]: unknown };
  read: boolean;
  created_at: string;
}

export interface AlertPreference {
  alert_type: NotificationType;
  telegram_enabled: boolean;
  push_enabled: boolean;
  min_threshold: number;
}
