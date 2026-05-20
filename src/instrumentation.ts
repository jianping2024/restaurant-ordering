export async function register() {
  if (process.env.NEXT_RUNTIME === 'edge') return;
  const { startNightlyAutoCloseScheduler } = await import('@/lib/nightly-auto-close-scheduler');
  startNightlyAutoCloseScheduler();
}
