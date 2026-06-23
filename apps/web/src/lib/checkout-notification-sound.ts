/** Two-tone chime for new checkout requests (no audio file dependency). */
export function playCheckoutRequestChime(): void {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new AudioContext();
    void ctx.resume();

    const playTone = (
      frequency: number,
      startAt: number,
      durationSec: number,
      peakGain: number,
      onLastEnded?: () => void,
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startAt);
      osc.stop(startAt + durationSec + 0.02);
      if (onLastEnded) {
        osc.onended = onLastEnded;
      }
    };

    const t0 = ctx.currentTime;
    playTone(880, t0, 0.48, 0.14);
    playTone(1174.66, t0 + 0.52, 0.58, 0.12, () => void ctx.close());
  } catch {
    /* autoplay policy or unsupported */
  }
}
