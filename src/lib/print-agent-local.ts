/** Unified re-pair + printer setup (must match apps/print-agent ConfigureWizardPort). */
export const PRINT_AGENT_CONFIGURE_PORT = 17892;

export function buildPrintAgentConfigureUrl(siteOrigin: string, code?: string): string {
  const origin = siteOrigin.replace(/\/$/, '');
  const params = new URLSearchParams({ api: origin });
  if (code) {
    params.set('code', code.replace(/\D/g, '').slice(0, 6));
  }
  return `http://127.0.0.1:${PRINT_AGENT_CONFIGURE_PORT}/configure?${params.toString()}`;
}
