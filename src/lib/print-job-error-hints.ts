import type { UILanguage } from '@/lib/i18n';

type ErrorHint = { match: (msg: string) => boolean; hint: Record<UILanguage, string> };

const ERROR_HINTS: ErrorHint[] = [
  {
    match: (m) => /startdocprinter/i.test(m),
    hint: {
      zh: 'USB 打印 bug：请升级至 print-agent v0.2.1+ 并重启代理。',
      en: 'USB print bug: upgrade to print-agent v0.2.1+ and restart the agent.',
      pt: 'Erro USB: atualize para print-agent v0.2.1+ e reinicie o agente.',
    },
  },
  {
    match: (m) => /no station_printers mapping/i.test(m),
    hint: {
      zh: '档口未映射打印机：运行 MesaPrintAgent.exe configure，或为各档口选打印机（v0.2.1+ 可回退默认打印机）。',
      en: 'Station not mapped: run MesaPrintAgent.exe configure, or upgrade to v0.2.1+ to fall back to the default printer.',
      pt: 'Estacao sem impressora: execute MesaPrintAgent.exe configure ou atualize para v0.2.1+.',
    },
  },
  {
    match: (m) => /127\.0\.0\.1:9100|connection refused/i.test(m),
    hint: {
      zh: '打印机地址错误（指向本机 9100）：在 configure 页改为 winspool:队列名 或 tcp:打印机IP:9100。',
      en: 'Wrong printer address (localhost :9100): set winspool:queue or tcp:printer-ip:9100 in configure.',
      pt: 'Endereco errado (localhost :9100): defina winspool:fila ou tcp:ip:9100 em configure.',
    },
  },
  {
    match: (m) => /dial tcp.*9100/i.test(m),
    hint: {
      zh: '无法连接网口打印机：检查网线、IP 与防火墙，或在 configure 中重新选择打印机。',
      en: 'Cannot reach LAN printer :9100: check cable, IP, firewall, or reselect in configure.',
      pt: 'Sem ligacao LAN :9100: verifique cabo, IP, firewall ou reconfigure.',
    },
  },
  {
    match: (m) => /open printer/i.test(m),
    hint: {
      zh: 'Windows 找不到该打印机队列：确认 USB 驱动已装、队列名与 configure 中一致。',
      en: 'Windows printer queue not found: check USB driver and queue name in configure.',
      pt: 'Fila Windows nao encontrada: verifique driver USB e nome em configure.',
    },
  },
];

export function printJobErrorHint(errorMessage: string | null | undefined, lang: UILanguage): string | null {
  if (!errorMessage?.trim()) return null;
  const msg = errorMessage.trim();
  for (const row of ERROR_HINTS) {
    if (row.match(msg)) return row.hint[lang];
  }
  return null;
}
