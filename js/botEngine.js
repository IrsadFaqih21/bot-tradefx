import { brokerService } from './brokerService.js';
import { strategyService } from './strategyService.js';
import { historyService } from './historyService.js';
import { audioService } from './audioService.js';
import { accountService } from './accountService.js';

/**
 * BotEngine - Binary Option Real-time Automated Trading Engine.
 * Strictly focuses on numerical Profit/Loss, win/loss stats, execution terminal,
 * without displaying candlestick charts.
 */
export class BotEngine {
  constructor() {
    this.status = 'IDLE'; // 'IDLE', 'RUNNING', 'ANALYZING', 'ACTIVE_TRADE', 'COOLDOWN', 'STOPPED_TP', 'STOPPED_SL'
    this.sessionProfit = 0;
    this.sessionWins = 0;
    this.sessionLosses = 0;
    this.sessionTies = 0;
    this.martingaleStep = 0;
    this.activeTrade = null;
    this.tradeTimer = null;
    this.analysisInterval = null;
    this.cooldownSeconds = 0;
    this.priceBuffer = [];
    this.logs = [];
    this.subscribers = new Set();

    // Listen to ticks from broker
    brokerService.onTick((prices) => this.handlePriceTick(prices));
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify(event, data) {
    this.subscribers.forEach((cb) => {
      try {
        cb(event, data);
      } catch (e) {
        console.error('BotEngine subscriber error:', e);
      }
    });
  }

  log(category, message, level = 'info') {
    const timestamp = new Date().toLocaleTimeString('id-ID');
    const entry = { timestamp, category, message, level, id: Date.now() + Math.random() };
    this.logs.unshift(entry);
    if (this.logs.length > 200) this.logs.pop();
    this.notify('log_added', entry);
  }

  handlePriceTick(prices) {
    const currentPair = strategyService.settings.pair;
    const price = prices[currentPair] || brokerService.getCurrentPrice(currentPair);

    this.priceBuffer.push(price);
    if (this.priceBuffer.length > 60) {
      this.priceBuffer.shift();
    }

    // If an active trade is open, update floating status
    if (this.activeTrade && this.activeTrade.status === 'OPEN') {
      const diff = price - this.activeTrade.openPrice;
      const isCall = this.activeTrade.direction === 'CALL';
      const inTheMoney = isCall ? diff > 0 : diff < 0;

      this.activeTrade.currentPrice = price;
      this.activeTrade.diff = +diff.toFixed(5);
      this.activeTrade.inTheMoney = inTheMoney;

      this.notify('active_trade_update', this.activeTrade);
    }
  }

  async start() {
    if (this.status === 'RUNNING' || this.status === 'ACTIVE_TRADE') return;

    // Ensure broker connection
    if (!brokerService.isConnected) {
      this.log('BROKER', 'Menyambungkan ke broker binary option...', 'info');
      await brokerService.connectBroker({
        broker: brokerService.currentBroker,
        apiKey: brokerService.apiKey,
        appId: brokerService.appId,
        mode: brokerService.accountMode
      });
    }

    this.status = 'RUNNING';
    audioService.playBotStart();
    accountService.vibrateStart();

    const st = strategyService.settings;
    this.log('SYSTEM', `🚀 Bot TradeFX DIMULAI | Aset: ${st.pair} | Model: ${st.moneyManagement.toUpperCase()} | Modal Awal: $${st.baseAmount}`, 'success');

    this.notify('status_changed', { status: this.status });
    this.runAnalysisLoop();
  }

  stop(reason = 'Manual Stop oleh Pengguna') {
    if (this.status === 'IDLE') return;

    this.status = 'IDLE';
    if (this.analysisInterval) {
      clearTimeout(this.analysisInterval);
      this.analysisInterval = null;
    }

    audioService.playBotStop();
    accountService.vibrate([100, 50]);

    this.log('SYSTEM', `🛑 Bot TradeFX DIHENTIKAN | Alasan: ${reason} | Profit Sesi: ${this.sessionProfit >= 0 ? '+' : ''}$${this.sessionProfit.toFixed(2)}`, 'warning');
    this.notify('status_changed', { status: this.status });
  }

  resetSession() {
    this.sessionProfit = 0;
    this.sessionWins = 0;
    this.sessionLosses = 0;
    this.sessionTies = 0;
    this.martingaleStep = 0;
    this.activeTrade = null;
    this.notify('session_reset', this.getSessionStats());
  }

  getSessionStats() {
    const totalTrades = this.sessionWins + this.sessionLosses + this.sessionTies;
    const winRate = totalTrades > 0 ? +((this.sessionWins / totalTrades) * 100).toFixed(1) : 0;
    return {
      sessionProfit: +this.sessionProfit.toFixed(2),
      sessionWins: this.sessionWins,
      sessionLosses: this.sessionLosses,
      sessionTies: this.sessionTies,
      totalTrades,
      winRate,
      martingaleStep: this.martingaleStep,
      status: this.status
    };
  }

  runAnalysisLoop() {
    if (this.status !== 'RUNNING') return;

    // Check Take Profit and Stop Loss limits
    const st = strategyService.settings;
    if (st.takeProfit > 0 && this.sessionProfit >= st.takeProfit) {
      this.status = 'STOPPED_TP';
      this.log('SAFETY', `🏆 TARGET TAKE PROFIT TERCAPAI (+$${this.sessionProfit.toFixed(2)} >= $${st.takeProfit})! Menghentikan bot secara aman.`, 'success');
      audioService.playWin();
      accountService.vibrateWin();
      this.notify('status_changed', { status: this.status });
      return;
    }

    if (st.stopLoss > 0 && this.sessionProfit <= -st.stopLoss) {
      this.status = 'STOPPED_SL';
      this.log('SAFETY', `🛡️ BATAS STOP LOSS TERSENTUH (-$${Math.abs(this.sessionProfit).toFixed(2)} >= $${st.stopLoss})! Menghentikan bot untuk mengamankan saldo.`, 'danger');
      audioService.playLoss();
      accountService.vibrateLoss();
      this.notify('status_changed', { status: this.status });
      return;
    }

    // If there is an active trade open, wait until it finishes
    if (this.activeTrade) {
      this.analysisInterval = setTimeout(() => this.runAnalysisLoop(), 1000);
      return;
    }

    // Evaluate signals
    const signal = this.analyzeMarketSignal();
    if (signal) {
      this.executeTrade(signal);
    } else {
      // Keep analyzing every 1.5 - 2.5 seconds
      const delay = 1500 + Math.random() * 1000;
      this.analysisInterval = setTimeout(() => this.runAnalysisLoop(), delay);
    }
  }

  // Calculate Stake based on Money Management
  calculateOrderAmount() {
    const st = strategyService.settings;
    if (st.moneyManagement === 'flat') {
      return st.baseAmount;
    } else if (st.moneyManagement === 'martingale') {
      if (this.martingaleStep === 0) return st.baseAmount;
      const multiplier = Math.pow(st.martingaleMultiplier, this.martingaleStep);
      return +(st.baseAmount * multiplier).toFixed(2);
    } else if (st.moneyManagement === 'compounding') {
      if (this.sessionProfit > 0) {
        return +(st.baseAmount + this.sessionProfit * 0.25).toFixed(2);
      }
      return st.baseAmount;
    } else if (st.moneyManagement === 'dalembert') {
      return +(st.baseAmount + this.martingaleStep * (st.baseAmount * 0.5)).toFixed(2);
    }
    return st.baseAmount;
  }

  analyzeMarketSignal() {
    const st = strategyService.settings;
    const prices = this.priceBuffer;
    if (prices.length < 10) {
      // Build up initial buffer
      for (let i = 0; i < 20; i++) {
        const base = brokerService.getCurrentPrice(st.pair);
        this.priceBuffer.push(base + (Math.random() - 0.5) * 0.0003);
      }
    }

    const currentPrice = brokerService.getCurrentPrice(st.pair);

    // 1. Calculate Simple RSI
    const rsi = this.calculateRSI(this.priceBuffer, 14);

    // 2. Calculate Short EMA (9) vs Long EMA (21)
    const ema9 = this.calculateEMA(this.priceBuffer, 9);
    const ema21 = this.calculateEMA(this.priceBuffer, 21);

    // 3. Confluence Logic according to configured signal engine
    let decision = null;
    let reason = '';

    if (st.signalEngine === 'rsi') {
      if (rsi <= st.rsiOversold) {
        decision = 'CALL';
        reason = `RSI (${rsi.toFixed(1)}) Jenuh Jual / Oversold (<= ${st.rsiOversold})`;
      } else if (rsi >= st.rsiOverbought) {
        decision = 'PUT';
        reason = `RSI (${rsi.toFixed(1)}) Jenuh Beli / Overbought (>= ${st.rsiOverbought})`;
      }
    } else if (st.signalEngine === 'ema_cross') {
      if (ema9 > ema21 && currentPrice > ema9) {
        decision = 'CALL';
        reason = `Golden Cross EMA 9 (${ema9.toFixed(5)}) > EMA 21 (${ema21.toFixed(5)})`;
      } else if (ema9 < ema21 && currentPrice < ema9) {
        decision = 'PUT';
        reason = `Death Cross EMA 9 (${ema9.toFixed(5)}) < EMA 21 (${ema21.toFixed(5)})`;
      }
    } else if (st.signalEngine === 'bollinger') {
      const { upper, lower } = this.calculateBollingerBands(this.priceBuffer, 20);
      if (currentPrice <= lower) {
        decision = 'CALL';
        reason = `Harga menyentuh Lower Bollinger Band (${lower.toFixed(5)})`;
      } else if (currentPrice >= upper) {
        decision = 'PUT';
        reason = `Harga menyentuh Upper Bollinger Band (${upper.toFixed(5)})`;
      }
    } else {
      // Default: AI Confluence Engine (Highest Win Rate)
      // Combines RSI divergence + EMA trend momentum
      const rsiCall = rsi < 42;
      const rsiPut = rsi > 58;
      const emaBullish = ema9 >= ema21;
      const emaBearish = ema9 <= ema21;

      // Micro momentum
      const last5 = this.priceBuffer.slice(-5);
      const diffLast = last5[last5.length - 1] - last5[0];

      if ((rsiCall && emaBullish) || (rsi < 35 && diffLast > 0)) {
        decision = 'CALL';
        reason = `AI Hybrid: RSI (${rsi.toFixed(1)}) Reversal + Momentum Bullish`;
      } else if ((rsiPut && emaBearish) || (rsi > 65 && diffLast < 0)) {
        decision = 'PUT';
        reason = `AI Hybrid: RSI (${rsi.toFixed(1)}) Reversal + Momentum Bearish`;
      }
    }

    // Randomize slight pacing so bot behaves naturally
    if (decision && Math.random() > 0.15) {
      return {
        direction: decision,
        reason,
        rsi: +rsi.toFixed(1),
        price: currentPrice
      };
    }

    return null;
  }

  async executeTrade(signal) {
    const st = strategyService.settings;
    const amount = this.calculateOrderAmount();
    const duration = st.expiryDuration;
    const payoutPercent = 85; // Standard high payout

    this.log('SIGNAL', `⚡ Sinyal Terdeteksi: ${signal.direction} [${st.pair}] - ${signal.reason}`, 'info');

    try {
      const trade = await brokerService.openPosition({
        pair: st.pair,
        direction: signal.direction,
        amount,
        durationSec: duration,
        payoutPercent
      });

      this.activeTrade = {
        ...trade,
        remainingSec: duration,
        inTheMoney: true,
        diff: 0
      };

      audioService.playOrderPlaced();
      accountService.vibrateStart();

      const martilInfo = this.martingaleStep > 0 ? ` [Martingale Step ${this.martingaleStep}]` : '';
      this.log('ORDER', `📌 Open Posisi: ${signal.direction} $${amount}${martilInfo} | Exp: ${duration}s @ ${trade.openPrice}`, 'success');

      this.notify('trade_opened', this.activeTrade);

      // Start Countdown Timer
      this.startTradeCountdown();
    } catch (err) {
      this.log('ERROR', `Gagal membuka order: ${err.message}`, 'danger');
      // If balance insufficient, stop
      if (err.message.includes('Saldo tidak mencukupi')) {
        this.stop('Saldo tidak cukup untuk membuka posisi.');
      } else {
        // Retry next cycle
        this.analysisInterval = setTimeout(() => this.runAnalysisLoop(), 3000);
      }
    }
  }

  startTradeCountdown() {
    if (this.tradeTimer) clearInterval(this.tradeTimer);

    this.tradeTimer = setInterval(() => {
      if (!this.activeTrade) {
        clearInterval(this.tradeTimer);
        return;
      }

      this.activeTrade.remainingSec--;

      // Update remaining countdown in UI
      this.notify('countdown_tick', {
        remainingSec: this.activeTrade.remainingSec,
        durationSec: this.activeTrade.durationSec,
        activeTrade: this.activeTrade
      });

      if (this.activeTrade.remainingSec <= 0) {
        clearInterval(this.tradeTimer);
        this.tradeTimer = null;
        this.resolveActiveTrade();
      }
    }, 1000);
  }

  resolveActiveTrade() {
    if (!this.activeTrade) return;

    const completed = brokerService.evaluateTradeResult(this.activeTrade);
    this.activeTrade = null;

    // Record into History
    historyService.addTrade(completed);

    const st = strategyService.settings;
    const isWin = completed.status === 'WIN';
    const isTie = completed.status === 'TIE';

    if (isWin) {
      this.sessionWins++;
      this.sessionProfit += completed.profit;
      this.martingaleStep = 0; // Reset martingale on win
      audioService.playWin();
      accountService.vibrateWin();
      this.log('RESULT', `🎉 TRADE WON (+PROFIT)! +$${completed.profit.toFixed(2)} | Aset: ${completed.pair} | Total Sesi: ${this.sessionProfit >= 0 ? '+' : ''}$${this.sessionProfit.toFixed(2)}`, 'success');
    } else if (isTie) {
      this.sessionTies++;
      this.log('RESULT', `⚖️ TRADE DRAW (TIE) Modal $${completed.amount} Dikembalikan.`, 'warning');
    } else {
      this.sessionLosses++;
      this.sessionProfit -= completed.amount;
      audioService.playLoss();
      accountService.vibrateLoss();

      // Handle Martingale Steps
      if (st.moneyManagement === 'martingale') {
        if (this.martingaleStep < st.maxMartingaleStep) {
          this.martingaleStep++;
          this.log('MARTINGALE', `Kompensasi: Menaikkan step ke-${this.martingaleStep} untuk order berikutnya.`, 'warning');
        } else {
          this.log('MARTINGALE', `Batas Max Step (${st.maxMartingaleStep}) tercapai. Reset modal ke order dasar.`, 'info');
          this.martingaleStep = 0;
        }
      } else if (st.moneyManagement === 'dalembert') {
        this.martingaleStep++;
      }

      this.log('RESULT', `❌ TRADE LOSS! -$${completed.amount.toFixed(2)} | Aset: ${completed.pair} | Total Sesi: ${this.sessionProfit >= 0 ? '+' : ''}$${this.sessionProfit.toFixed(2)}`, 'danger');
    }

    this.notify('trade_closed', {
      trade: completed,
      sessionStats: this.getSessionStats()
    });

    // Check if still running
    if (this.status === 'RUNNING') {
      const cooldownMs = (st.tradeInterval || 5) * 1000;
      this.log('COOLDOWN', `Jeda ${st.tradeInterval} detik sebelum analisa sinyal berikutnya...`, 'info');
      this.analysisInterval = setTimeout(() => this.runAnalysisLoop(), cooldownMs);
    }
  }

  // --- Math Helpers for Technical Indicators ---
  calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 50.0;
    let gains = 0;
    let losses = 0;

    const slice = prices.slice(-(period + 1));
    for (let i = 1; i < slice.length; i++) {
      const diff = slice[i] - slice[i - 1];
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }

    if (losses === 0) return 100.0;
    const rs = (gains / period) / (losses / period);
    return +(100 - (100 / (1 + rs))).toFixed(2);
  }

  calculateEMA(prices, period = 9) {
    if (prices.length === 0) return 1.0;
    const k = 2 / (period + 1);
    let ema = prices[0];
    for (let i = 1; i < prices.length; i++) {
      ema = prices[i] * k + ema * (1 - k);
    }
    return ema;
  }

  calculateBollingerBands(prices, period = 20) {
    const slice = prices.slice(-period);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / slice.length;
    const stdDev = Math.sqrt(variance);
    return {
      middle: mean,
      upper: mean + 2 * stdDev,
      lower: mean - 2 * stdDev
    };
  }
}

export const botEngine = new BotEngine();

