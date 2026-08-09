/** Placeholder order id for connection-test print jobs (no FK to orders). */
export const PRINT_AGENT_CONNECTION_TEST_ORDER_ID =
  '00000000-0000-4000-8000-00000000c0de';

/** Sole connection-test dish line for claim / queue (follows print_locale). */
export function printAgentConnectionTestLine(
  brand: string,
  locale: 'zh' | 'en' | 'pt',
): string {
  const phrase =
    locale === 'zh' ? '连接测试' : locale === 'pt' ? 'teste de ligação' : 'connection test';
  return `${brand} — ${phrase}`;
}
