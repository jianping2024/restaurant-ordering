/** Local printer mapping UI (must match apps/print-agent ConfigureWizardPort). Pairing uses /pair on the same port while the tray configure session is active. */
export const PRINT_AGENT_CONFIGURE_PORT = 17892;

const HEALTH_PATH = '/api/health';
const PROBE_TIMEOUT_MS = 2500;

export function buildPrintAgentConfigureUrl(siteOrigin: string, code?: string, lang?: string): string {
  const origin = siteOrigin.replace(/\/$/, '');
  const params = new URLSearchParams({ api: origin });
  const normalizedCode = code ? code.replace(/\D/g, '').slice(0, 6) : '';
  if (normalizedCode) {
    params.set('code', normalizedCode);
  }
  if (lang === 'zh' || lang === 'en' || lang === 'pt') {
    params.set('lang', lang);
  }
  const path = normalizedCode ? '/pair' : '/configure';
  return `http://127.0.0.1:${PRINT_AGENT_CONFIGURE_PORT}${path}?${params.toString()}`;
}

export function printAgentLocalHealthUrl(): string {
  return `http://127.0.0.1:${PRINT_AGENT_CONFIGURE_PORT}${HEALTH_PATH}`;
}

/** True when MesaGo Print Agent tray is listening on localhost (paired agent running). */
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
 * Do not pass noopener — it prevents navigating the new tab from the opener.
 */
export async function openPrintAgentConfigure(
  siteOrigin: string,
  code?: string,
  lang?: string,
): Promise<'opened' | 'unreachable'> {
  if (typeof window === 'undefined') {
    return 'unreachable';
  }
  const url = buildPrintAgentConfigureUrl(siteOrigin, code, lang);
  // Must not use noopener/noreferrer: Chrome then returns null or a tab we cannot assign.
  const popup = window.open('', '_blank');
  const ok = await probeLocalPrintAgent();
  if (!ok) {
    popup?.close();
    return 'unreachable';
  }
  if (popup) {
    try {
      popup.location.href = url;
      return 'opened';
    } catch {
      popup.close();
    }
  }
  window.location.assign(url);
  return 'opened';
}
