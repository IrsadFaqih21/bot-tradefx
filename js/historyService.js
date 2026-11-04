/**
 * HistoryService - Records, calculates stats, and exports binary options trade history.
 */
export class HistoryService {
  constructor() {
    this.storageKey = 'tradefx_history_records';
    this.trades = this.loadHistory();
    this.subscribers = new Set();
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify() {
    const stats = this.getStatistics();
    this.subscribers.forEach((cb) => {
      try {
        cb(this.trades, stats);
      } catch (e) {
        console.error('History subscriber error:', e);
      }
    });
  }

  loadHistory() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to load trade history:', e);
    }
    return [];
  }

  saveHistory() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.trades));
    } catch (e) {
      console.error('Failed to save trade history:', e);
    }
    this.notify();
  }

  addTrade(trade) {
    this.trades.unshift(trade);
    // Keep last 300 trades in local cache for speed
    if (this.trades.length > 300) {
      this.trades = this.trades.slice(0, 300);
    }
    this.saveHistory();
  }

  clearHistory() {
    this.trades = [];
    localStorage.removeItem(this.storageKey);
    this.notify();
  }

  getFilteredTrades({ status = 'ALL', pair = 'ALL', date = 'ALL' }) {
    return this.trades.filter((t) => {
      if (status !== 'ALL' && t.status !== status) return false;
      if (pair !== 'ALL' && t.pair !== pair) return false;
      if (date === 'TODAY') {
        const todayStr = new Date().toDateString();
        const tradeDateStr = new Date(t.openedAt).toDateString();
        if (todayStr !== tradeDateStr) return false;
      }
      return true;
    });
  }

  getStatistics(tradesToCount = null) {
    const list = tradesToCount || this.trades;
    let totalTrades = list.length;
    let wins = 0;
    let losses = 0;
    let ties = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    let bestWinStreak = 0;
    let currentStreak = 0;
    let currentStreakType = null; // 'WIN' or 'LOSS'

    list.forEach((t) => {
      if (t.status === 'WIN') {
        wins++;
        totalProfit += t.profit;
      } else if (t.status === 'LOSS') {
        losses++;
        totalLoss += Math.abs(t.profit);
      } else {
        ties++;
      }
    });

    // Calculate streaks (chronological order)
    const chronological = [...list].reverse();
    let tempWinStreak = 0;
    chronological.forEach((t) => {
      if (t.status === 'WIN') {
        tempWinStreak++;
        if (tempWinStreak > bestWinStreak) bestWinStreak = tempWinStreak;
      } else if (t.status === 'LOSS') {
        tempWinStreak = 0;
      }
    });

    // Current streak from newest trades
    if (list.length > 0) {
      const firstType = list[0].status;
      currentStreakType = firstType;
      for (const t of list) {
        if (t.status === firstType) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    const netProfit = +(totalProfit - totalLoss).toFixed(2);
    const winRate = totalTrades > 0 ? +((wins / totalTrades) * 100).toFixed(1) : 0;
    const profitFactor = totalLoss > 0 ? +(totalProfit / totalLoss).toFixed(2) : totalProfit > 0 ? 99.9 : 0;

    return {
      totalTrades,
      wins,
      losses,
      ties,
      totalProfit: +totalProfit.toFixed(2),
      totalLoss: +totalLoss.toFixed(2),
      netProfit,
      winRate,
      profitFactor,
      bestWinStreak,
      currentStreak,
      currentStreakType
    };
  }

  exportToCSV() {
    if (this.trades.length === 0) return null;

    const headers = ['Order ID', 'Waktu Buka', 'Pasangan Aset', 'Arah', 'Harga Buka', 'Harga Tutup', 'Investasi ($)', 'Hasil', 'Profit/Rugi ($)'];
    const rows = this.trades.map((t) => [
      t.id,
      new Date(t.openedAt).toLocaleString('id-ID'),
      t.pair,
      t.direction,
      t.openPrice,
      t.closePrice || '-',
      t.amount,
      t.status,
      t.profit
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BotTradeFX_History_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }
}

export const historyService = new HistoryService();

