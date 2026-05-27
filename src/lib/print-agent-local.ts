/** Unified re-pair + printer setup (must match apps/print-agent ConfigureWizardPort). */
export const PRINT_AGENT_CONFIGURE_PORT = 17892;

const HEALTH_PATH = '/api/health';
const PROBE_TIMEOUT_MS = 2500;

export function buildPrintAgentConfigureUrl(siteOrigin: string, code?: string): string {
  const origin = siteOrigin.replace(/\/$/, '');
  const params = new URLSearchParams({ api: origin });
  if (code) {
    params.set('code', code.replace(/\D/g, '').slice(0, 6));
  }
  return `http://127.0.0.1:${PRINT_AGENT_CONFIGURE_PORT}/configure?${params.toString()}`;
}

export function printAgentLocalHealthUrl(): string {
  return `http://127.0.0.1:${PRINT_AGENT_CONFIGURE_PORT}${HEALTH_PATH}`;
}

/** True when Mesa Print Agent tray is listening on localhost (paired agent running). */
export async function probeLocalPrintAgent(timeoutMs = PROBE_TIMEOUT_MS): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false;
  }
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(printAgentLocalHealthUrl(), {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) {
      return false;
    }
    const data = (await res.json()) as { ok?: boolean };
    return data.ok === true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Open local configure UI. Opens a blank tab synchronously (user gesture) so popup
 * blockers do not swallow the window after the async health probe.
 */
export async function openPrintAgentConfigure(
  siteOrigin: string,
  code?: string,
): Promise<'opened' | 'unreachable'> {
  if (typeof window === 'undefined') {
    return 'unreachable';
  }
  const url = buildPrintAgentConfigureUrl(siteOrigin, code);
  const popup = window.open('about:blank', '_blank', 'noopener,noreferrer');
  const ok = await probeLocalPrintAgent();
  if (!ok) {
    popup?.close();
    return 'unreachable';
  }
  if (popup) {
    popup.location.replace(url);
    return 'opened';
  }
  // Popup blocked: same-tab navigation still reaches the local agent.
  window.location.assign(url);
  return 'opened';
}
