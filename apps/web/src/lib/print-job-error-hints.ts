import type { UILanguage } from '@/lib/i18n';

type ErrorHint = { match: (msg: string) => boolean; hint: Record<UILanguage, string> };

const ERROR_HINTS: ErrorHint[] = [
  {
    match: (m) => /print job expired.*\d+ minutes/i.test(m),
    hint: {
      zh: '任务已超过 10 分钟未打出，系统已自动作废；如需补打请在后台对该任务点「重试」（会生成新的待打印任务）。',
      en: 'Job was older than 10 minutes and was auto-cancelled; use Retry in the dashboard to re-queue if you still need a ticket.',
      pt: 'Trabalho com mais de 10 minutos foi cancelado; use Repetir no painel para reenviar se ainda precisar do ticket.',
      es: 'El trabajo llevaba más de 10 minutos y se anuló automáticamente; usa Reintentar en el panel para volver a enviarlo si aún necesitas el ticket.',
      fr: 'Le travail avait plus de 10 minutes et a été annulé automatiquement ; utilisez Réessayer dans le tableau de bord pour le remettre en file si le bon est encore nécessaire.',
      de: 'Der Auftrag war älter als 10 Minuten und wurde automatisch storniert; mit „Wiederholen“ im Dashboard erneut einreihen, falls der Bon noch gebraucht wird.',
    },
  },
  {
    match: (m) => /printer was offline|skipped.*offline|only jobs created after the printer came online/i.test(m),
    hint: {
      zh: '打印机恢复上线时跳过了积压任务；打印机就绪后点「重试」即可补打。',
      en: 'Skipped while the printer was offline; click Retry after the printer is online to reprint.',
      pt: 'Ignorado com impressora offline; use Repetir com a impressora online para imprimir de novo.',
      es: 'Se omitió mientras la impresora estaba sin conexión; pulsa Reintentar cuando vuelva a estar en línea.',
      fr: 'Ignoré pendant que l’imprimante était hors ligne ; cliquez sur Réessayer une fois l’imprimante en ligne.',
      de: 'Wurde übersprungen, während der Drucker offline war; nach dem Onlinegehen auf „Wiederholen“ klicken.',
    },
  },
  {
    match: (m) => /startdocprinter/i.test(m),
    hint: {
      zh: 'USB 打印 bug：请升级至 print-agent v0.2.1+ 并重启代理。',
      en: 'USB print bug: upgrade to print-agent v0.2.1+ and restart the agent.',
      pt: 'Erro USB: atualize para print-agent v0.2.1+ e reinicie o agente.',
      es: 'Fallo de impresión USB: actualiza a print-agent v0.2.1+ y reinicia el agente.',
      fr: 'Bug d’impression USB : passez à print-agent v0.2.1+ et redémarrez l’agent.',
      de: 'USB-Druckfehler: auf print-agent v0.2.1+ aktualisieren und den Agenten neu starten.',
    },
  },
  {
    match: (m) => /receipt printer not ready|will retry within \d+ minutes/i.test(m),
    hint: {
      zh: '账单已入队，等待打印机：在 configure 映射档口，或在结账页选定档口打印机；10 分钟内配好会继续打印。',
      en: 'Receipt queued: map a station printer in configure or pick one on checkout; prints within 10 minutes once ready.',
      pt: 'Recibo na fila: mapeie impressora no configure ou escolha no checkout; imprime em 10 minutos.',
      es: 'Cuenta en cola: asigna una impresora de partida en configure o elige una en el cobro; se imprime en 10 minutos cuando esté lista.',
      fr: 'Addition en file : associez une imprimante de poste dans configure ou choisissez-en une à l’encaissement ; impression sous 10 minutes.',
      de: 'Rechnung in der Warteschlange: Stationsdrucker in configure zuordnen oder an der Kasse auswählen; Druck innerhalb von 10 Minuten.',
    },
  },
  {
    match: (m) =>
      /receipt_printer_id required|multiple stations mapped|no station printers configured within \d+ minutes/i.test(
        m,
      ),
    hint: {
      zh: '超过 10 分钟仍未配置打印机：在 configure 映射档口，或在结账/账单页下拉框选定一台后重试打印。',
      en: '10-minute window expired: map printers in configure or pick one on checkout/bill, then retry the job.',
      pt: 'Janela de 10 min expirou: mapeie no configure ou escolha impressora e reenvie o trabalho.',
      es: 'La ventana de 10 minutos ha expirado: asigna impresoras en configure o elige una en el cobro o en la cuenta y reintenta el trabajo.',
      fr: 'Délai de 10 minutes dépassé : associez des imprimantes dans configure ou choisissez-en une à l’encaissement/sur l’addition, puis relancez le travail.',
      de: '10-Minuten-Fenster abgelaufen: Drucker in configure zuordnen oder an Kasse/Rechnung auswählen und den Auftrag wiederholen.',
    },
  },
  {
    match: (m) => /no station_printers mapping/i.test(m),
    hint: {
      zh: '该出品档口未映射打印机：在 configure 为该档口选择打印机。',
      en: 'Station not mapped: assign a printer for this station in configure.',
      pt: 'Estacao sem impressora: mapeie esta estacao no configure.',
      es: 'Partida sin impresora asignada: elige una impresora para esta partida en configure.',
      fr: 'Poste non associé : attribuez une imprimante à ce poste dans configure.',
      de: 'Station nicht zugeordnet: Weisen Sie dieser Station in configure einen Drucker zu.',
    },
  },
  {
    match: (m) => /127\.0\.0\.1:9100|connection refused/i.test(m),
    hint: {
      zh: '打印机地址错误（指向本机 9100）：在 configure 页改为 winspool:队列名 或 tcp:打印机IP:9100。',
      en: 'Wrong printer address (localhost :9100): set winspool:queue or tcp:printer-ip:9100 in configure.',
      pt: 'Endereco errado (localhost :9100): defina winspool:fila ou tcp:ip:9100 em configure.',
      es: 'Dirección de impresora incorrecta (localhost :9100): pon winspool:cola o tcp:ip-impresora:9100 en configure.',
      fr: 'Adresse d’imprimante incorrecte (localhost :9100) : indiquez winspool:file ou tcp:ip-imprimante:9100 dans configure.',
      de: 'Falsche Druckeradresse (localhost :9100): in configure winspool:Warteschlange oder tcp:Drucker-IP:9100 eintragen.',
    },
  },
  {
    match: (m) => /dial tcp.*9100/i.test(m),
    hint: {
      zh: '无法连接网口打印机：检查网线、IP 与防火墙，或在 configure 中重新选择打印机。',
      en: 'Cannot reach LAN printer :9100: check cable, IP, firewall, or reselect in configure.',
      pt: 'Sem ligacao LAN :9100: verifique cabo, IP, firewall ou reconfigure.',
      es: 'No se puede conectar con la impresora de red :9100: revisa el cable, la IP y el firewall, o vuelve a elegirla en configure.',
      fr: 'Imprimante réseau :9100 inaccessible : vérifiez le câble, l’IP et le pare-feu, ou resélectionnez-la dans configure.',
      de: 'Netzwerkdrucker :9100 nicht erreichbar: Kabel, IP und Firewall prüfen oder in configure neu auswählen.',
    },
  },
  {
    match: (m) => /open printer/i.test(m),
    hint: {
      zh: 'Windows 找不到该打印机队列：确认 USB 驱动已装、队列名与 configure 中一致。',
      en: 'Windows printer queue not found: check USB driver and queue name in configure.',
      pt: 'Fila Windows nao encontrada: verifique driver USB e nome em configure.',
      es: 'Windows no encuentra esa cola de impresión: comprueba el controlador USB y que el nombre de la cola coincida con configure.',
      fr: 'File d’impression Windows introuvable : vérifiez le pilote USB et le nom de la file dans configure.',
      de: 'Windows-Druckerwarteschlange nicht gefunden: USB-Treiber prüfen und Warteschlangennamen mit configure abgleichen.',
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
