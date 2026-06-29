const SOUND_KEY = 'mesa-checkout-sound';

export function loadCheckoutSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const v = localStorage.getItem(SOUND_KEY);
    if (v === null) return true;
    return v === '1';
  } catch {
    return true;
  }
}

export function saveCheckoutSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SOUND_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore quota / private mode */
  }
}
