/**
 * UpdaterService - In-App OTA (Over-The-Air) Live Update Engine for Bot TradeFX.
 * Checks GitHub repository for updates and hot-updates files directly inside the app
 * without requiring the user to re-download or reinstall the APK!
 */
export class UpdaterService {
  constructor() {
    this.currentVersion = '2.5.0';
    this.currentBuild = 250;
    this.githubRepo = localStorage.getItem('tradefx_github_repo') || '';
    this.githubBranch = localStorage.getItem('tradefx_github_branch') || 'main';
    this.autoCheck = localStorage.getItem('tradefx_auto_update_check') !== 'false';
    this.isChecking = false;
    this.isUpdating = false;
    this.subscribers = new Set();
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
        console.error('Updater subscriber error:', e);
      }
    });
  }

  setRepo(repo, branch = 'main') {
    this.githubRepo = repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
    this.githubBranch = branch.trim() || 'main';
    localStorage.setItem('tradefx_github_repo', this.githubRepo);
    localStorage.setItem('tradefx_github_branch', this.githubBranch);
    this.notify('config_changed', { repo: this.githubRepo, branch: this.githubBranch });
  }

  setAutoCheck(enabled) {
    this.autoCheck = enabled;
    localStorage.setItem('tradefx_auto_update_check', enabled ? 'true' : 'false');
  }

  getRawUrl(filePath) {
    if (!this.githubRepo) return null;
    return `https://raw.githubusercontent.com/${this.githubRepo}/${this.githubBranch}/${filePath}?t=${Date.now()}`;
  }

  /**
   * Check GitHub for newer versions
   */
  async checkForUpdates(isSilent = false) {
    if (!this.githubRepo) {
      if (!isSilent) {
        this.notify('no_repo_configured', {});
      }
      return null;
    }

    if (this.isChecking) return null;
    this.isChecking = true;
    this.notify('checking_start', {});

    try {
      const versionUrl = this.getRawUrl('version.json');
      const response = await fetch(versionUrl, { cache: 'no-store' });

      if (!response.ok) {
        throw new Error(`Gagal mengambil data dari GitHub (HTTP ${response.status})`);
      }

      const remoteData = await response.json();
      const hasUpdate = (remoteData.buildNumber && remoteData.buildNumber > this.currentBuild) ||
                        this.isVersionHigher(remoteData.version, this.currentVersion);

      const result = {
        hasUpdate,
        currentVersion: this.currentVersion,
        remoteVersion: remoteData.version,
        remoteBuild: remoteData.buildNumber,
        releaseDate: remoteData.releaseDate,
        title: remoteData.title,
        releaseNotes: remoteData.releaseNotes || []
      };

      this.notify('check_complete', result);
      return result;
    } catch (err) {
      console.warn('Update check failed:', err);
      this.notify('check_error', { message: err.message, isSilent });
      return null;
    } finally {
      this.isChecking = false;
    }
  }

  isVersionHigher(remote, current) {
    if (!remote || !current) return false;
    const rParts = remote.split('.').map((n) => parseInt(n, 10) || 0);
    const cParts = current.split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(rParts.length, cParts.length); i++) {
      const r = rParts[i] || 0;
      const c = cParts[i] || 0;
      if (r > c) return true;
      if (r < c) return false;
    }
    return false;
  }

  /**
   * Perform OTA In-App Hot-Update
   * Downloads updated core files directly into Service Worker Cache & reloads the app!
   */
  async performOTAUpdate(progressCallback) {
    if (!this.githubRepo || this.isUpdating) return false;
    this.isUpdating = true;

    const filesToUpdate = [
      'version.json',
      'index.html',
      'manifest.json',
      'css/style.css',
      'js/app.js',
      'js/botEngine.js',
      'js/brokerService.js',
      'js/historyService.js',
      'js/strategyService.js',
      'js/audioService.js',
      'js/accountService.js',
      'js/updaterService.js',
      'service-worker.js'
    ];

    try {
      let completed = 0;

      // Open Cache Storage if available
      const hasCache = 'caches' in window;
      const cache = hasCache ? await caches.open('bot-tradefx-ota') : null;

      for (const file of filesToUpdate) {
        const fileUrl = this.getRawUrl(file);
        const res = await fetch(fileUrl, { cache: 'no-store' });
        if (res.ok) {
          if (cache) {
            await cache.put('./' + file, res.clone());
          }
        }
        completed++;
        if (progressCallback) {
          progressCallback(Math.round((completed / filesToUpdate.length) * 100), file);
        }
      }

      // If Service Worker registered, tell it to update
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.update();
        }
      }

      // Mark update timestamp
      localStorage.setItem('tradefx_last_updated', new Date().toISOString());

      // Success
      this.isUpdating = false;
      return true;
    } catch (err) {
      this.isUpdating = false;
      throw new Error(`OTA update gagal: ${err.message}`);
    }
  }
}

export const updaterService = new UpdaterService();

