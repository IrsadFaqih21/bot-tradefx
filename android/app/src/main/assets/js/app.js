import { botEngine } from './botEngine.js';
import { brokerService } from './brokerService.js';
import { strategyService } from './strategyService.js';
import { historyService } from './historyService.js';
import { audioService } from './audioService.js';
import { accountService } from './accountService.js';
import { updaterService } from './updaterService.js';

/**
 * App - Main UI Controller for Bot TradeFX Android App
 */
class App {
  constructor() {
    this.currentTab = 'terminal'; // default to main terminal dashboard
    this.historyFilter = 'ALL';
  }

  init() {
    this.bindEvents();
    this.setupSubscribers();
    this.renderActiveTab(this.currentTab);
    this.updateAllUI();

    // Auto-connect default broker silently on load
    brokerService.connectBroker({
      broker: brokerService.currentBroker,
      apiKey: brokerService.apiKey,
      appId: brokerService.appId,
      mode: brokerService.accountMode
    });

    // Auto-check for OTA updates silently if configured
    if (updaterService.autoCheck && updaterService.githubRepo) {
      setTimeout(() => updaterService.checkForUpdates(true), 2500);
    }

    console.log('Bot TradeFX Android Initialized Successfully.');
  }

  // Handle Tab Switch
  switchTab(tabId) {
    audioService.playTap();
    accountService.vibrate([20]);
    this.currentTab = tabId;

    // Update bottom nav active classes
    document.querySelectorAll('.bottom-nav-item').forEach((btn) => {
      if (btn.dataset.tab === tabId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Update view panels
    document.querySelectorAll('.tab-view').forEach((view) => {
      if (view.id === `view-${tabId}`) {
        view.classList.remove('hidden');
      } else {
        view.classList.add('hidden');
      }
    });

    // Refresh contents when tab opens
    if (tabId === 'history') {
      this.renderHistoryList();
    } else if (tabId === 'strategy') {
      this.populateStrategyForm();
    } else if (tabId === 'broker') {
      this.updateBrokerTabUI();
    } else if (tabId === 'account') {
      this.updateAccountTabUI();
    }
  }

  renderActiveTab(tabId) {
    this.switchTab(tabId);
  }

  bindEvents() {
    // Bottom Navigation Bar Clicks
    document.querySelectorAll('.bottom-nav-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab) this.switchTab(tab);
      });
    });

    // Terminal Start / Stop Big Button
    const btnStartStop = document.getElementById('btn-start-stop');
    if (btnStartStop) {
      btnStartStop.addEventListener('click', () => {
        if (botEngine.status === 'RUNNING' || botEngine.status === 'ACTIVE_TRADE') {
          botEngine.stop('Dihentikan pengguna');
        } else {
          botEngine.start();
        }
      });
    }

    // Terminal Reset Session Button
    const btnResetSession = document.getElementById('btn-reset-session');
    if (btnResetSession) {
      btnResetSession.addEventListener('click', () => {
        if (confirm('Reset laba/rugi sesi trading hari ini?')) {
          botEngine.resetSession();
          this.showToast('Sesi trading telah di-reset ke 0', 'info');
        }
      });
    }

    // Quick Account Mode Toggle (Demo / Real) in Header
    const btnToggleAccountMode = document.getElementById('btn-toggle-account-mode');
    if (btnToggleAccountMode) {
      btnToggleAccountMode.addEventListener('click', () => {
        const nextMode = brokerService.accountMode === 'demo' ? 'real' : 'demo';
        brokerService.setAccountMode(nextMode);
        audioService.playTap();
        this.showToast(`Beralih ke Akun ${nextMode.toUpperCase()}`, 'info');
      });
    }

    // Audio Mute/Unmute in Header
    const btnToggleSound = document.getElementById('btn-toggle-sound');
    if (btnToggleSound) {
      btnToggleSound.addEventListener('click', () => {
        const isEnabled = audioService.toggleSound();
        this.updateAudioButtonState(isEnabled);
        this.showToast(isEnabled ? 'Suara Diaktifkan' : 'Suara Dimatikan', 'info');
      });
    }

    // History Filters
    document.querySelectorAll('.history-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.history-filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        this.historyFilter = btn.dataset.filter || 'ALL';
        this.renderHistoryList();
      });
    });

    // History Export CSV
    const btnExportHistory = document.getElementById('btn-export-history');
    if (btnExportHistory) {
      btnExportHistory.addEventListener('click', () => {
        const success = historyService.exportToCSV();
        if (success) {
          this.showToast('Riwayat trading berhasil diunduh (CSV)', 'success');
        } else {
          this.showToast('Belum ada riwayat untuk diunduh', 'warning');
        }
      });
    }

    // Clear History Button
    const btnClearHistory = document.getElementById('btn-clear-history');
    if (btnClearHistory) {
      btnClearHistory.addEventListener('click', () => {
        if (confirm('Yakin ingin menghapus semua catatan riwayat trading?')) {
          historyService.clearHistory();
          this.renderHistoryList();
          this.showToast('Riwayat trading telah dibersihkan', 'info');
        }
      });
    }

    // Broker Connect Form Submit
    const brokerForm = document.getElementById('broker-connect-form');
    if (brokerForm) {
      brokerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const broker = document.getElementById('select-broker-type').value;
        const apiKey = document.getElementById('input-broker-token').value.trim();
        const appId = document.getElementById('input-broker-appid').value.trim() || '1089';
        const mode = document.getElementById('select-broker-mode').value;

        const btnConnect = document.getElementById('btn-connect-broker');
        btnConnect.disabled = true;
        btnConnect.innerHTML = '<span class="spinner"></span> Menyambungkan...';

        try {
          const res = await brokerService.connectBroker({ broker, apiKey, appId, mode });
          this.showToast(`Berhasil terhubung ke ${res.broker} (Ping: ${res.latency}ms)`, 'success');
          audioService.playTap();
        } catch (err) {
          this.showToast(`Koneksi Gagal: ${err.message}`, 'danger');
        } finally {
          btnConnect.disabled = false;
          btnConnect.innerHTML = '🔌 Sambungkan Broker';
          this.updateBrokerTabUI();
        }
      });
    }

    // Broker Disconnect Button
    const btnDisconnectBroker = document.getElementById('btn-disconnect-broker');
    if (btnDisconnectBroker) {
      btnDisconnectBroker.addEventListener('click', () => {
        brokerService.disconnectBroker();
        this.showToast('Koneksi broker telah diputus', 'warning');
        this.updateBrokerTabUI();
      });
    }

    // Strategy Form Save
    const strategyForm = document.getElementById('strategy-form');
    if (strategyForm) {
      strategyForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const settings = {
          pair: document.getElementById('strat-pair').value,
          baseAmount: parseFloat(document.getElementById('strat-base-amount').value) || 10,
          expiryDuration: parseInt(document.getElementById('strat-expiry').value, 10) || 60,
          moneyManagement: document.getElementById('strat-mm-type').value,
          martingaleMultiplier: parseFloat(document.getElementById('strat-martil-mult').value) || 2.2,
          maxMartingaleStep: parseInt(document.getElementById('strat-martil-step').value, 10) || 3,
          takeProfit: parseFloat(document.getElementById('strat-tp').value) || 50,
          stopLoss: parseFloat(document.getElementById('strat-sl').value) || 30,
          signalEngine: document.getElementById('strat-engine').value,
          tradeInterval: parseInt(document.getElementById('strat-delay').value, 10) || 10
        };

        strategyService.saveSettings(settings);
        this.showToast('✅ Pengaturan strategi berhasil disimpan!', 'success');
        audioService.playTap();
        this.updateTerminalPairBadge();
      });
    }

    // Strategy Preset Buttons
    document.querySelectorAll('.preset-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const presetKey = btn.dataset.preset;
        if (presetKey) {
          strategyService.applyPreset(presetKey);
          this.populateStrategyForm();
          this.showToast(`Preset "${btn.innerText.trim()}" diterapkan!`, 'info');
          audioService.playTap();
        }
      });
    });

    // Reset Strategy Default
    const btnResetStrat = document.getElementById('btn-reset-strategy');
    if (btnResetStrat) {
      btnResetStrat.addEventListener('click', () => {
        strategyService.resetToDefault();
        this.populateStrategyForm();
        this.showToast('Strategi dikembalikan ke setelan default pabrik', 'info');
      });
    }

    // Account Tab: Reset Demo Balance Button
    const btnRechargeDemo = document.getElementById('btn-recharge-demo');
    if (btnRechargeDemo) {
      btnRechargeDemo.addEventListener('click', () => {
        brokerService.resetDemoBalance();
        this.showToast('Saldo Demo diisi ulang menjadi $10,000.00', 'success');
        this.updateAccountTabUI();
      });
    }

    // Account Tab: Sound & Haptic toggles
    const chkSound = document.getElementById('chk-account-sound');
    if (chkSound) {
      chkSound.addEventListener('change', () => {
        audioService.toggleSound(chkSound.checked);
        this.updateAudioButtonState(chkSound.checked);
      });
    }

    const chkHaptic = document.getElementById('chk-account-haptic');
    if (chkHaptic) {
      chkHaptic.addEventListener('change', () => {
        accountService.saveProfile({ hapticEnabled: chkHaptic.checked });
        if (chkHaptic.checked) accountService.vibrate([40, 40]);
      });
    }

    // Account Tab: GitHub Repo & OTA Update Listeners
    const inputGithubRepo = document.getElementById('input-github-repo');
    if (inputGithubRepo) {
      inputGithubRepo.addEventListener('change', () => {
        updaterService.setRepo(inputGithubRepo.value);
        this.showToast('Repository GitHub berhasil disimpan!', 'success');
      });
    }

    const chkAutoUpdate = document.getElementById('chk-auto-update');
    if (chkAutoUpdate) {
      chkAutoUpdate.addEventListener('change', () => {
        updaterService.setAutoCheck(chkAutoUpdate.checked);
      });
    }

    const btnCheckUpdate = document.getElementById('btn-check-update');
    if (btnCheckUpdate) {
      btnCheckUpdate.addEventListener('click', async () => {
        btnCheckUpdate.disabled = true;
        btnCheckUpdate.innerHTML = '<span class="spinner"></span> Memeriksa GitHub...';
        await updaterService.checkForUpdates(false);
        btnCheckUpdate.disabled = false;
        btnCheckUpdate.innerHTML = '🔄 Cek Pembaruan Sekarang';
      });
    }

    // Update Modal Buttons
    const btnCancelUpdate = document.getElementById('btn-cancel-update');
    if (btnCancelUpdate) {
      btnCancelUpdate.addEventListener('click', () => {
        this.hideUpdateModal();
      });
    }

    const btnApplyUpdate = document.getElementById('btn-apply-update');
    if (btnApplyUpdate) {
      btnApplyUpdate.addEventListener('click', () => {
        this.handleApplyOTAUpdate();
      });
    }
  }

  setupSubscribers() {
    // 1. Bot Engine Subscriber
    botEngine.subscribe((event, data) => {
      switch (event) {
        case 'status_changed':
          this.updateTerminalStatus(data.status);
          break;
        case 'log_added':
          this.appendLogEntry(data);
          break;
        case 'trade_opened':
          this.renderActiveTradeCard(data);
          this.updateProfitDisplay();
          break;
        case 'countdown_tick':
          this.updateCountdownDisplay(data);
          break;
        case 'active_trade_update':
          this.updateFloatingStatus(data);
          break;
        case 'trade_closed':
          this.handleTradeClosed(data);
          break;
        case 'session_reset':
          this.updateProfitDisplay();
          break;
      }
    });

    // 2. Broker Service Subscriber
    brokerService.subscribe((event, data) => {
      this.updateHeaderAccount();
      this.updateBrokerTabUI();
    });

    // 3. History Service Subscriber
    historyService.subscribe((trades, stats) => {
      this.updateHistoryStatsCards(stats);
      if (this.currentTab === 'history') {
        this.renderHistoryList();
      }
    });

    // 4. Updater Service Subscriber (OTA Update)
    updaterService.subscribe((event, data) => {
      switch (event) {
        case 'check_complete':
          if (data.hasUpdate) {
            this.showUpdateModal(data);
          } else if (!data.isSilent) {
            this.showToast(`Aplikasi sudah versi terbaru (${data.currentVersion})`, 'success');
          }
          break;
        case 'no_repo_configured':
          this.showToast('Silakan isi repository GitHub di menu Akun terlebih dahulu', 'warning');
          break;
        case 'check_error':
          if (!data.isSilent) {
            this.showToast(`Cek update gagal: ${data.message}`, 'danger');
          }
          break;
      }
    });
  }

  updateAllUI() {
    this.updateHeaderAccount();
    this.updateTerminalStatus(botEngine.status);
    this.updateProfitDisplay();
    this.updateTerminalPairBadge();
    this.updateAudioButtonState(audioService.enabled);
    this.populateStrategyForm();
    this.updateBrokerTabUI();
    this.updateAccountTabUI();
    this.renderHistoryList();
  }

  // --- Header & Global Badges ---
  updateHeaderAccount() {
    const mode = brokerService.accountMode;
    const balance = brokerService.getActiveBalance();

    const elMode = document.getElementById('header-account-mode');
    const elBal = document.getElementById('header-account-balance');

    if (elMode) {
      elMode.innerText = mode.toUpperCase();
      elMode.className = `mode-pill ${mode === 'real' ? 'mode-real' : 'mode-demo'}`;
    }

    if (elBal) {
      elBal.innerText = `$${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // Broker status indicator dot
    const elBrokerDot = document.getElementById('header-broker-dot');
    const elBrokerName = document.getElementById('header-broker-name');
    if (elBrokerDot) {
      elBrokerDot.className = `status-dot ${brokerService.isConnected ? 'dot-online' : 'dot-offline'}`;
    }
    if (elBrokerName) {
      elBrokerName.innerText = brokerService.isConnected
        ? `${brokerService.getBrokerDisplayName(brokerService.currentBroker)} (${brokerService.latencyMs}ms)`
        : 'Broker Terputus';
    }
  }

  updateAudioButtonState(isEnabled) {
    const btn = document.getElementById('btn-toggle-sound');
    if (btn) {
      btn.innerHTML = isEnabled ? '🔔' : '🔕';
      btn.title = isEnabled ? 'Suara Aktif' : 'Suara Bisu';
    }
    const chk = document.getElementById('chk-account-sound');
    if (chk) chk.checked = isEnabled;
  }

  updateTerminalPairBadge() {
    const elPair = document.getElementById('terminal-active-pair');
    const elStrategy = document.getElementById('terminal-active-strategy');
    const st = strategyService.settings;

    if (elPair) elPair.innerText = st.pair;
    if (elStrategy) {
      const engineNames = {
        ai_hybrid: 'AI Confluence Engine',
        rsi: 'RSI Scalper (70/30)',
        ema_cross: 'EMA 9/21 Trend',
        bollinger: 'Bollinger Reversal'
      };
      elStrategy.innerText = engineNames[st.signalEngine] || st.signalEngine;
    }
  }

  // --- Terminal Tab ---
  updateTerminalStatus(status) {
    const btn = document.getElementById('btn-start-stop');
    const pill = document.getElementById('terminal-bot-status-pill');

    if (!btn || !pill) return;

    if (status === 'RUNNING' || status === 'ACTIVE_TRADE') {
      btn.className = 'btn-hero btn-hero-stop pulse-glow';
      btn.innerHTML = `
        <div class="hero-btn-content">
          <span class="hero-icon">🛑</span>
          <div class="hero-btn-text">
            <span class="title">STOP AUTO BOT</span>
            <span class="sub">Klik untuk menghentikan bot trading</span>
          </div>
        </div>
      `;
      pill.innerText = 'BOT RUNNING (AKTIF)';
      pill.className = 'status-pill pill-running';
    } else if (status === 'STOPPED_TP') {
      btn.className = 'btn-hero btn-hero-start';
      btn.innerHTML = `
        <div class="hero-btn-content">
          <span class="hero-icon">🏆</span>
          <div class="hero-btn-text">
            <span class="title">TAKE PROFIT TERCAPAI</span>
            <span class="sub">Klik untuk mulai sesi trading baru</span>
          </div>
        </div>
      `;
      pill.innerText = 'TARGET TP SELESAI';
      pill.className = 'status-pill pill-tp';
    } else if (status === 'STOPPED_SL') {
      btn.className = 'btn-hero btn-hero-start';
      btn.innerHTML = `
        <div class="hero-btn-content">
          <span class="hero-icon">🛡️</span>
          <div class="hero-btn-text">
            <span class="title">STOP LOSS TERSENTUH</span>
            <span class="sub">Klik untuk restart analisa bot</span>
          </div>
        </div>
      `;
      pill.innerText = 'STOP LOSS AKTIF';
      pill.className = 'status-pill pill-sl';
    } else {
      btn.className = 'btn-hero btn-hero-start';
      btn.innerHTML = `
        <div class="hero-btn-content">
          <span class="hero-icon">🚀</span>
          <div class="hero-btn-text">
            <span class="title">MULAI AUTO BOT</span>
            <span class="sub">Buka posisi otomatis sesuai strategi</span>
          </div>
        </div>
      `;
      pill.innerText = 'BOT STANDBY (IDLE)';
      pill.className = 'status-pill pill-idle';
    }
  }

  updateProfitDisplay() {
    const profit = botEngine.sessionProfit;
    const stats = botEngine.getSessionStats();

    const elProfitHero = document.getElementById('terminal-profit-val');
    const elProfitBadge = document.getElementById('terminal-profit-badge');
    const elWins = document.getElementById('terminal-stat-wins');
    const elLosses = document.getElementById('terminal-stat-losses');
    const elWinRate = document.getElementById('terminal-stat-winrate');
    const elMartil = document.getElementById('terminal-stat-martil');

    if (elProfitHero) {
      const sign = profit > 0 ? '+' : profit < 0 ? '-' : '';
      const absVal = Math.abs(profit).toFixed(2);
      elProfitHero.innerText = `${sign}$${absVal}`;

      // Color coding
      if (profit > 0) {
        elProfitHero.className = 'profit-number text-profit';
      } else if (profit < 0) {
        elProfitHero.className = 'profit-number text-loss';
      } else {
        elProfitHero.className = 'profit-number text-neutral';
      }
    }

    if (elProfitBadge) {
      if (profit > 0) {
        elProfitBadge.innerText = 'PROFIT SESI INI';
        elProfitBadge.className = 'profit-badge badge-profit';
      } else if (profit < 0) {
        elProfitBadge.innerText = 'RUGI SESI INI';
        elProfitBadge.className = 'profit-badge badge-loss';
      } else {
        elProfitBadge.innerText = 'LABA / RUGI NET';
        elProfitBadge.className = 'profit-badge badge-neutral';
      }
    }

    if (elWins) elWins.innerText = stats.sessionWins;
    if (elLosses) elLosses.innerText = stats.sessionLosses;
    if (elWinRate) elWinRate.innerText = `${stats.winRate}%`;
    if (elMartil) elMartil.innerText = `Step ${stats.martingaleStep}`;
  }

  renderActiveTradeCard(trade) {
    const container = document.getElementById('active-trade-container');
    if (!container) return;

    container.classList.remove('hidden');
    const isCall = trade.direction === 'CALL';

    container.innerHTML = `
      <div class="active-trade-card ${isCall ? 'border-call' : 'border-put'}">
        <div class="trade-card-header">
          <div class="trade-pair-info">
            <span class="pair-symbol">${trade.pair}</span>
            <span class="order-dir-tag ${isCall ? 'tag-call' : 'tag-put'}">
              ${isCall ? 'CALL / NAIK ↗' : 'PUT / TURUN ↘'}
            </span>
          </div>
          <div class="trade-countdown">
            <span class="timer-digits" id="live-timer-digits">00:${trade.durationSec.toString().padStart(2, '0')}</span>
          </div>
        </div>

        <div class="trade-progress-track">
          <div class="trade-progress-bar" id="live-trade-progress" style="width: 100%;"></div>
        </div>

        <div class="trade-stats-grid">
          <div class="stat-col">
            <span class="stat-label">Harga Buka</span>
            <span class="stat-num">${trade.openPrice}</span>
          </div>
          <div class="stat-col">
            <span class="stat-label">Harga Saat Ini</span>
            <span class="stat-num text-highlight" id="live-current-price">${trade.openPrice}</span>
          </div>
          <div class="stat-col">
            <span class="stat-label">Investasi</span>
            <span class="stat-num">$${trade.amount.toFixed(2)}</span>
          </div>
          <div class="stat-col">
            <span class="stat-label">Estimasi Payout</span>
            <span class="stat-num text-profit">+$${(trade.amount * (trade.payoutPercent / 100)).toFixed(2)}</span>
          </div>
        </div>

        <div class="trade-live-status-bar" id="live-floating-badge">
          <span class="status-indicator-dot pulse-dot"></span>
          <span class="status-text" id="live-floating-text">Menganalisa Pergerakan Kontrak...</span>
        </div>
      </div>
    `;
  }

  updateCountdownDisplay({ remainingSec, durationSec }) {
    const elDigits = document.getElementById('live-timer-digits');
    const elBar = document.getElementById('live-trade-progress');

    if (elDigits) {
      const mins = Math.floor(remainingSec / 60);
      const secs = remainingSec % 60;
      elDigits.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    if (elBar && durationSec > 0) {
      const pct = Math.max(0, (remainingSec / durationSec) * 100);
      elBar.style.width = `${pct}%`;
    }
  }

  updateFloatingStatus(trade) {
    const elPrice = document.getElementById('live-current-price');
    const elBadge = document.getElementById('live-floating-badge');
    const elText = document.getElementById('live-floating-text');

    if (elPrice && trade.currentPrice) {
      elPrice.innerText = trade.currentPrice;
    }

    if (elBadge && elText) {
      if (trade.inTheMoney) {
        elBadge.className = 'trade-live-status-bar bar-in-money';
        elText.innerText = `IN THE MONEY (+WIN) | Selisih: ${trade.diff > 0 ? '+' : ''}${trade.diff}`;
      } else {
        elBadge.className = 'trade-live-status-bar bar-out-money';
        elText.innerText = `OUT OF THE MONEY (-LOSS) | Selisih: ${trade.diff > 0 ? '+' : ''}${trade.diff}`;
      }
    }
  }

  handleTradeClosed({ trade }) {
    const container = document.getElementById('active-trade-container');
    if (container) {
      container.classList.add('hidden');
    }

    this.updateProfitDisplay();
    this.updateHeaderAccount();

    const isWin = trade.status === 'WIN';
    const isTie = trade.status === 'TIE';

    if (isWin) {
      this.showToast(`🎉 PROFIT! +$${trade.profit.toFixed(2)} [${trade.pair}]`, 'success');
    } else if (isTie) {
      this.showToast(`⚖️ DRAW (Tie). Modal dikembalikan.`, 'warning');
    } else {
      this.showToast(`❌ LOSS -$${Math.abs(trade.profit).toFixed(2)} [${trade.pair}]`, 'danger');
    }
  }

  appendLogEntry(log) {
    const container = document.getElementById('terminal-console-body');
    if (!container) return;

    const row = document.createElement('div');
    row.className = `console-row log-${log.level}`;
    row.innerHTML = `
      <span class="log-time">[${log.timestamp}]</span>
      <span class="log-cat">[${log.category}]</span>
      <span class="log-msg">${log.message}</span>
    `;

    container.insertBefore(row, container.firstChild);
    // Keep max 80 rows in DOM
    if (container.children.length > 80) {
      container.removeChild(container.lastChild);
    }
  }

  // --- Riwayat Trading Tab ---
  renderHistoryList() {
    const container = document.getElementById('history-records-list');
    if (!container) return;

    const trades = historyService.getFilteredTrades({ status: this.historyFilter });
    const stats = historyService.getStatistics(trades);
    this.updateHistoryStatsCards(stats);

    if (trades.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <h3>Belum Ada Riwayat Trading</h3>
          <p>Mulai jalankan bot trading di tab Terminal untuk melihat hasil open posisi Anda di sini.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = trades
      .map((t) => {
        const isWin = t.status === 'WIN';
        const isTie = t.status === 'TIE';
        const isCall = t.direction === 'CALL';
        const dateStr = new Date(t.openedAt).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });

        return `
        <div class="history-item-card ${isWin ? 'card-win' : isTie ? 'card-tie' : 'card-loss'}">
          <div class="hist-card-top">
            <div class="hist-pair-tag">
              <span class="hist-asset">${t.pair}</span>
              <span class="hist-dir-pill ${isCall ? 'pill-call' : 'pill-put'}">
                ${isCall ? 'CALL ↗' : 'PUT ↘'}
              </span>
            </div>
            <div class="hist-result-badge ${isWin ? 'res-win' : isTie ? 'res-tie' : 'res-loss'}">
              ${isWin ? `+$${t.profit.toFixed(2)} WIN` : isTie ? '$0.00 TIE' : `-$${Math.abs(t.profit).toFixed(2)} LOSS`}
            </div>
          </div>
          <div class="hist-card-details">
            <div class="hist-cell">
              <span class="h-lbl">Harga Buka</span>
              <span class="h-val">${t.openPrice}</span>
            </div>
            <div class="hist-cell">
              <span class="h-lbl">Harga Tutup</span>
              <span class="h-val">${t.closePrice || '-'}</span>
            </div>
            <div class="hist-cell">
              <span class="h-lbl">Investasi</span>
              <span class="h-val">$${t.amount.toFixed(2)}</span>
            </div>
            <div class="hist-cell">
              <span class="h-lbl">Waktu</span>
              <span class="h-val">${dateStr}</span>
            </div>
          </div>
        </div>
      `;
      })
      .join('');
  }

  updateHistoryStatsCards(stats) {
    const elTot = document.getElementById('hist-stat-total');
    const elWins = document.getElementById('hist-stat-wins');
    const elLosses = document.getElementById('hist-stat-losses');
    const elWinrate = document.getElementById('hist-stat-winrate');
    const elNet = document.getElementById('hist-stat-net');

    if (elTot) elTot.innerText = stats.totalTrades;
    if (elWins) elWins.innerText = stats.wins;
    if (elLosses) elLosses.innerText = stats.losses;
    if (elWinrate) elWinrate.innerText = `${stats.winRate}%`;
    if (elNet) {
      const sign = stats.netProfit > 0 ? '+' : stats.netProfit < 0 ? '-' : '';
      elNet.innerText = `${sign}$${Math.abs(stats.netProfit).toFixed(2)}`;
      elNet.className = stats.netProfit >= 0 ? 'text-profit' : 'text-loss';
    }
  }

  // --- Broker Tab ---
  updateBrokerTabUI() {
    const isConn = brokerService.isConnected;
    const elStatusCard = document.getElementById('broker-status-card');
    const elCurrentName = document.getElementById('broker-card-name');
    const elCurrentLatency = document.getElementById('broker-card-latency');
    const elCurrentBal = document.getElementById('broker-card-balance');

    if (elStatusCard) {
      elStatusCard.className = `broker-info-card ${isConn ? 'connected' : 'disconnected'}`;
    }
    if (elCurrentName) {
      elCurrentName.innerText = brokerService.getBrokerDisplayName(brokerService.currentBroker);
    }
    if (elCurrentLatency) {
      elCurrentLatency.innerText = isConn ? `${brokerService.latencyMs} ms (Stabil)` : 'Terputus';
    }
    if (elCurrentBal) {
      elCurrentBal.innerText = `$${brokerService.getActiveBalance().toFixed(2)} (${brokerService.accountMode.toUpperCase()})`;
    }

    // Update form default values
    const selBroker = document.getElementById('select-broker-type');
    const selMode = document.getElementById('select-broker-mode');
    const txtToken = document.getElementById('input-broker-token');
    const txtAppId = document.getElementById('input-broker-appid');

    if (selBroker) selBroker.value = brokerService.currentBroker;
    if (selMode) selMode.value = brokerService.accountMode;
    if (txtToken && !txtToken.value) txtToken.value = brokerService.apiKey;
    if (txtAppId && !txtAppId.value) txtAppId.value = brokerService.appId;
  }

  // --- Strategi Tab ---
  populateStrategyForm() {
    const st = strategyService.settings;
    const pair = document.getElementById('strat-pair');
    const baseAmount = document.getElementById('strat-base-amount');
    const expiry = document.getElementById('strat-expiry');
    const mmType = document.getElementById('strat-mm-type');
    const martilMult = document.getElementById('strat-martil-mult');
    const martilStep = document.getElementById('strat-martil-step');
    const tp = document.getElementById('strat-tp');
    const sl = document.getElementById('strat-sl');
    const engine = document.getElementById('strat-engine');
    const delay = document.getElementById('strat-delay');

    if (pair) pair.value = st.pair;
    if (baseAmount) baseAmount.value = st.baseAmount;
    if (expiry) expiry.value = st.expiryDuration;
    if (mmType) mmType.value = st.moneyManagement;
    if (martilMult) martilMult.value = st.martingaleMultiplier;
    if (martilStep) martilStep.value = st.maxMartingaleStep;
    if (tp) tp.value = st.takeProfit;
    if (sl) sl.value = st.stopLoss;
    if (engine) engine.value = st.signalEngine;
    if (delay) delay.value = st.tradeInterval;
  }

  // --- Akun Tab ---
  updateAccountTabUI() {
    const prof = accountService.profile;
    const elDemoBal = document.getElementById('account-demo-balance');
    const elRealBal = document.getElementById('account-real-balance');

    if (elDemoBal) elDemoBal.innerText = `$${brokerService.balance.demo.toFixed(2)}`;
    if (elRealBal) elRealBal.innerText = `$${brokerService.balance.real.toFixed(2)}`;

    const chkSound = document.getElementById('chk-account-sound');
    const chkHaptic = document.getElementById('chk-account-haptic');

    if (chkSound) chkSound.checked = audioService.enabled;
    if (chkHaptic) chkHaptic.checked = prof.hapticEnabled;

    // OTA Updater fields
    const txtRepo = document.getElementById('input-github-repo');
    const chkAuto = document.getElementById('chk-auto-update');
    const lblVer = document.getElementById('lbl-current-version');

    if (txtRepo) txtRepo.value = updaterService.githubRepo;
    if (chkAuto) chkAuto.checked = updaterService.autoCheck;
    if (lblVer) lblVer.innerText = `v${updaterService.currentVersion} (Build ${updaterService.currentBuild})`;
  }

  // --- OTA In-App Update Modal UI ---
  showUpdateModal(data) {
    const modal = document.getElementById('update-modal');
    const title = document.getElementById('update-modal-title');
    const ver = document.getElementById('update-modal-ver');
    const notes = document.getElementById('update-modal-notes');
    const progressWrap = document.getElementById('update-progress-wrap');
    const actions = document.getElementById('update-modal-actions');

    if (!modal) return;

    if (title) title.innerText = data.title || 'Pembaruan Baru Tersedia!';
    if (ver) ver.innerText = `Versi Baru: v${data.remoteVersion} (Build ${data.remoteBuild})`;

    if (notes) {
      if (data.releaseNotes && data.releaseNotes.length > 0) {
        notes.innerHTML = data.releaseNotes.map((n) => `<li>${n}</li>`).join('');
      } else {
        notes.innerHTML = '<li>Peningkatan performa dan kestabilan bot trading.</li>';
      }
    }

    if (progressWrap) progressWrap.classList.add('hidden');
    if (actions) actions.classList.remove('hidden');

    modal.style.display = 'flex';
    modal.classList.remove('hidden');
    audioService.playTap();
  }

  hideUpdateModal() {
    const modal = document.getElementById('update-modal');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.add('hidden');
    }
  }

  async handleApplyOTAUpdate() {
    const actions = document.getElementById('update-modal-actions');
    const progressWrap = document.getElementById('update-progress-wrap');
    const progressBar = document.getElementById('update-progress-bar');
    const progressText = document.getElementById('update-progress-text');

    if (actions) actions.classList.add('hidden');
    if (progressWrap) progressWrap.classList.remove('hidden');

    try {
      await updaterService.performOTAUpdate((percent, file) => {
        if (progressBar) progressBar.style.width = `${percent}%`;
        if (progressText) progressText.innerText = `Mengunduh ${file} (${percent}%)...`;
      });

      if (progressText) progressText.innerText = '✅ Pembaruan selesai dipasang! Memuat ulang...';
      audioService.playWin();

      setTimeout(() => {
        window.location.reload(true);
      }, 1200);
    } catch (err) {
      this.showToast(`Pembaruan gagal: ${err.message}`, 'danger');
      if (actions) actions.classList.remove('hidden');
      if (progressWrap) progressWrap.classList.add('hidden');
    }
  }

  // --- Toast Notifications ---
  showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type} animate-slide-up`;
    toast.innerText = message;

    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 3200);
  }
}

// Instantiate and export app
export const app = new App();

// On DOM ready
window.addEventListener('DOMContentLoaded', () => {
  app.init();
});

