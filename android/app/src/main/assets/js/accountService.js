/**
 * AccountService - Manages trader profile, security PIN, haptic vibration, and theme.
 */
export class AccountService {
  constructor() {
    this.profile = this.loadProfile();
  }

  loadProfile() {
    const defaultProfile = {
      name: 'Trader FX VIP',
      memberId: 'FX-882910',
      tier: 'VIP Platinum',
      avatar: 'robot',
      hapticEnabled: true,
      soundEnabled: true,
      pinLockEnabled: false,
      pinCode: '1234',
      theme: 'cyberpunk'
    };

    try {
      const saved = localStorage.getItem('tradefx_account_profile');
      if (saved) {
        return { ...defaultProfile, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.error('Failed to load profile:', e);
    }
    return defaultProfile;
  }

  saveProfile(updated) {
    this.profile = { ...this.profile, ...updated };
    localStorage.setItem('tradefx_account_profile', JSON.stringify(this.profile));
    return this.profile;
  }

  // Trigger Android native haptic vibration if supported
  vibrate(pattern = [50]) {
    if (!this.profile.hapticEnabled) return;
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate(pattern);
      }
    } catch (e) {
      console.warn('Vibration not supported or blocked:', e);
    }
  }

  vibrateWin() {
    this.vibrate([100, 50, 100]);
  }

  vibrateLoss() {
    this.vibrate([200]);
  }

  vibrateStart() {
    this.vibrate([60, 40, 60]);
  }

  verifyPin(inputPin) {
    if (!this.profile.pinLockEnabled) return true;
    return this.profile.pinCode === inputPin;
  }
}

export const accountService = new AccountService();

