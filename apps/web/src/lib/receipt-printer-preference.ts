const PRINTER_KEY_PREFIX = 'mesa-receipt-printer:';
const SOUND_KEY = 'mesa-checkout-sound';

export function receiptPrinterStorageKey(restaurantSlug: string): string {
  return `${PRINTER_KEY_PREFIX}${restaurantSlug}`;
}

export function loadSavedReceiptPrinterId(restaurantSlug: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(receiptPrinterStorageKey(restaurantSlug)) || '';
  } catch {
    return '';
  }
}

export function saveReceiptPrinterId(restaurantSlug: string, printerId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = receiptPrinterStorageKey(restaurantSlug);
    if (printerId) localStorage.setItem(key, printerId);
    else localStorage.removeItem(key);
  } catch {
    /* ignore quota / private mode */
  }
}

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
    /* ignore */
  }
}
