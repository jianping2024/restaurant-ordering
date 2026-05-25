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
    match: (m) => /receipt printer not ready|will retry within 20 minutes/i.test(m),
    hint: {
      zh: '账单已入队，等待打印机：在 configure 映射档口，或在结账页选定档口打印机；20 分钟内配好会继续打印。',
      en: 'Receipt queued: map a station printer in configure or pick one on checkout; prints within 20 minutes once ready.',
      pt: 'Recibo na fila: mapeie impressora no configure ou escolha no checkout; imprime em 20 minutos.',
    },
  },
  {
    match: (m) => /receipt_printer_id required|multiple stations mapped|no station printers configured within 20 minutes/i.test(m),
    hint: {
      zh: '超过 20 分钟仍未配置打印机：在 configure 映射档口，或在结账/账单页下拉框选定一台后重试打印。',
      en: '20-minute window expired: map printers in configure or pick one on checkout/bill, then retry the job.',
      pt: 'Janela de 20 min expirou: mapeie no configure ou escolha impressora e reenvie o trabalho.',
    },
  },
  {
    match: (m) => /no station_printers mapping/i.test(m),
    hint: {
      zh: '该出品档口未映射打印机：在 configure 为该档口选择打印机。',
      en: 'Station not mapped: assign a printer for this station in configure.',
      pt: 'Estacao sem impressora: mapeie esta estacao no configure.',
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
