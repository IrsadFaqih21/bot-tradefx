/**
 * StrategyService - Manages binary options strategy settings, money management, and presets.
 */
export class StrategyService {
  constructor() {
    this.defaultSettings = {
      pair: 'EUR/USD',
      baseAmount: 10,
      minPayout: 80,
      expiryDuration: 60, // in seconds (1 Minute)
      moneyManagement: 'martingale', // 'flat', 'martingale', 'compounding', 'dalembert'
      martingaleMultiplier: 2.2,
      maxMartingaleStep: 3,
      takeProfit: 50, // Dollar target to stop
      stopLoss: 30, // Dollar max loss to stop
      signalEngine: 'ai_hybrid', // 'ai_hybrid', 'rsi', 'ema_cross', 'bollinger', 'stochastic'
      rsiPeriod: 14,
      rsiOverbought: 70,
      rsiOversold: 30,
      tradeInterval: 10, // Seconds delay between trades
      consecutiveLossLimit: 4
    };

    this.settings = this.loadSettings();
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem('tradefx_strategy_settings');
      if (saved) {
        return { ...this.defaultSettings, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
    return { ...this.defaultSettings };
  }

  saveSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    localStorage.setItem('tradefx_strategy_settings', JSON.stringify(this.settings));
    return this.settings;
  }

  resetToDefault() {
    this.settings = { ...this.defaultSettings };
    localStorage.setItem('tradefx_strategy_settings', JSON.stringify(this.settings));
    return this.settings;
  }

  // Predefined strategy presets
  getPresets() {
    return {
      ai_hybrid: {
        name: 'AI Confluence Engine (Akurasi Tinggi)',
        desc: 'Menggabungkan konfirmasi multi-indikator RSI, EMA cross, dan momentum dengan AI probabilitas.',
        settings: {
          signalEngine: 'ai_hybrid',
          expiryDuration: 60,
          moneyManagement: 'martingale',
          martingaleMultiplier: 2.2,
          maxMartingaleStep: 3,
          tradeInterval: 10
        }
      },
      scalper_1m: {
        name: 'Scalper Turbo 1 Menit',
        desc: 'Eksekusi cepat pada volatilitas tinggi dengan timeframe 60 detik.',
        settings: {
          signalEngine: 'rsi',
          expiryDuration: 60,
          moneyManagement: 'martingale',
          martingaleMultiplier: 2.0,
          maxMartingaleStep: 2,
          tradeInterval: 5
        }
      },
      trend_follower: {
        name: 'Trend Follower EMA 9/21',
        desc: 'Mengikuti arah pergerakan tren besar dengan konfirmasi EMA crossover.',
        settings: {
          signalEngine: 'ema_cross',
          expiryDuration: 120,
          moneyManagement: 'flat',
          martingaleMultiplier: 2.0,
          maxMartingaleStep: 1,
          tradeInterval: 15
        }
      },
      bollinger_reversal: {
        name: 'Mean Reversion Bollinger Bands',
        desc: 'Open posisi berlawanan saat harga menyentuh Upper atau Lower Band.',
        settings: {
          signalEngine: 'bollinger',
          expiryDuration: 60,
          moneyManagement: 'martingale',
          martingaleMultiplier: 2.2,
          maxMartingaleStep: 3,
          tradeInterval: 10
        }
      },
      safe_conservative: {
        name: 'Konservatif Safe (Tanpa Martingale)',
        desc: 'Fixed flat trade amount tanpa penggandaan martil, aman untuk modal kecil.',
        settings: {
          signalEngine: 'ai_hybrid',
          expiryDuration: 60,
          moneyManagement: 'flat',
          martingaleMultiplier: 1.0,
          maxMartingaleStep: 1,
          tradeInterval: 20
        }
      }
    };
  }

  applyPreset(presetKey) {
    const presets = this.getPresets();
    if (presets[presetKey]) {
      this.saveSettings(presets[presetKey].settings);
      return this.settings;
    }
    return null;
  }
}

export const strategyService = new StrategyService();

