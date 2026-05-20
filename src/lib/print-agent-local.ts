/** Local pairing wizard served by MesaPrintAgent (must match apps/print-agent PairWizardPort). */
export const PRINT_AGENT_PAIR_PORT = 17890;

export function buildPrintAgentPairUrl(siteOrigin: string, code?: string): string {
  const origin = siteOrigin.replace(/\/$/, '');
  const params = new URLSearchParams({ api: origin });
  if (code) {
    params.set('code', code.replace(/\D/g, '').slice(0, 6));
  }
  return `http://127.0.0.1:${PRINT_AGENT_PAIR_PORT}/pair?${params.toString()}`;
}
