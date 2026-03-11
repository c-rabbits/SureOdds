import { ArbitrageOpportunity } from '@/types';

export interface AlertConfig {
  enabled: boolean;
  soundEnabled: boolean;
  browserNotifications: boolean;
  thresholds: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

const DEFAULT_CONFIG: AlertConfig = {
  enabled: true,
  soundEnabled: true,
  browserNotifications: false,
  thresholds: {
    low: 0,
    medium: 1,
    high: 3,
    critical: 5,
  },
};

const STORAGE_KEY = 'sureodds-alerts';

class AlertService {
  private config: AlertConfig;
  private alertedIds: Set<string> = new Set();
  private audioCtx: AudioContext | null = null;

  constructor() {
    this.config = DEFAULT_CONFIG;
    this.loadConfig();
  }

  private loadConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) this.config = { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    } catch {
      // ignore
    }
  }

  saveConfig(config: Partial<AlertConfig>) {
    this.config = { ...this.config, ...config };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch {
      // ignore
    }
  }

  getConfig(): AlertConfig {
    return { ...this.config };
  }

  async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  checkNewOpportunities(opportunities: ArbitrageOpportunity[]) {
    if (!this.config.enabled) return;

    for (const opp of opportunities) {
      if (this.alertedIds.has(opp.id)) continue;
      this.alertedIds.add(opp.id);

      const profit = Number(opp.profit_percent);
      let level: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (profit >= this.config.thresholds.critical) level = 'critical';
      else if (profit >= this.config.thresholds.high) level = 'high';
      else if (profit >= this.config.thresholds.medium) level = 'medium';

      if (level !== 'low') {
        this.fireAlert(level, opp);
      }
    }

    // Clean up old IDs to prevent memory leak
    if (this.alertedIds.size > 1000) {
      const ids = Array.from(this.alertedIds);
      this.alertedIds = new Set(ids.slice(-500));
    }
  }

  private fireAlert(level: string, opp: ArbitrageOpportunity) {
    if (this.config.soundEnabled) this.playSound(level);
    if (this.config.browserNotifications) this.showNotification(opp);
  }

  playSound(level: string) {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new AudioContext();
      }
      const ctx = this.audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      // Different frequencies for different levels
      const freqs: Record<string, number> = {
        low: 440,
        medium: 660,
        high: 880,
        critical: 1100,
      };

      osc.frequency.value = freqs[level] || 660;
      osc.type = 'sine';
      gain.gain.value = 0.1;
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);

      // Double beep for critical
      if (level === 'critical') {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 1100;
        osc2.type = 'sine';
        gain2.gain.value = 0.1;
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.7);
        osc2.start(ctx.currentTime + 0.35);
        osc2.stop(ctx.currentTime + 0.65);
      }
    } catch {
      // Web Audio not supported
    }
  }

  private showNotification(opp: ArbitrageOpportunity) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const match = opp.matches;
    const title = `Sure Bet: +${Number(opp.profit_percent).toFixed(2)}%`;
    const body = match
      ? `${match.home_team} vs ${match.away_team} | ${opp.market_type.toUpperCase()}`
      : `${opp.bookmaker_a} vs ${opp.bookmaker_b}`;

    new Notification(title, { body, tag: opp.id });
  }

  // Clear tracked IDs (useful when refreshing data)
  reset() {
    this.alertedIds.clear();
  }
}

// Singleton
let instance: AlertService | null = null;

export function getAlertService(): AlertService {
  if (!instance) {
    instance = new AlertService();
  }
  return instance;
}
