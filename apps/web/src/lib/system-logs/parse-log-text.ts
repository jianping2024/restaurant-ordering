import type { SystemLogLine, SystemLogQuery } from '@/lib/system-logs/types';

/** Hard caps so one query cannot blow the Node process. */
export const SYSTEM_LOG_MAX_LINES = 2_000;
export const SYSTEM_LOG_MAX_BYTES = 2 * 1024 * 1024;
/** Max query window (matches retention intent). */
export const SYSTEM_LOG_MAX_RANGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Parse docker json-file lines, docker logs API demux text, or plain stdout lines
 * into SystemLogLine. One parser for all transports.
 */
export function parseLogTextToLines(raw: string): SystemLogLine[] {
  const out: SystemLogLine[] = [];
  const chunks = raw.split(/\r?\n/);
  for (const chunk of chunks) {
    if (!chunk) continue;
    const fromJson = tryParseDockerJsonFileLine(chunk);
    if (fromJson) {
      out.push(fromJson);
      continue;
    }
    const fromTs = tryParseTimestampPrefixLine(chunk);
    if (fromTs) {
      out.push(fromTs);
      continue;
    }
    out.push({ ts: '', message: chunk });
  }
  return out;
}

function tryParseDockerJsonFileLine(line: string): SystemLogLine | null {
  if (!line.startsWith('{')) return null;
  try {
    const obj = JSON.parse(line) as { log?: unknown; time?: unknown };
    if (typeof obj.log !== 'string') return null;
    const message = obj.log.replace(/\n$/, '');
    const ts = typeof obj.time === 'string' ? obj.time : '';
    return { ts, message };
  } catch {
    return null;
  }
}

/** `2024-01-01T12:00:00.000000000Z message` from docker logs --timestamps. */
function tryParseTimestampPrefixLine(line: string): SystemLogLine | null {
  const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\s(.*)$/.exec(line);
  if (!m) return null;
  return { ts: m[1], message: m[2] ?? '' };
}

export function filterSystemLogLines(
  lines: SystemLogLine[],
  query: SystemLogQuery,
): { lines: SystemLogLine[]; truncated: boolean } {
  const q = query.q.trim().toLowerCase();
  const fromMs = query.from.getTime();
  const toMs = query.to.getTime();
  const filtered: SystemLogLine[] = [];
  for (const line of lines) {
    if (line.ts) {
      const t = Date.parse(line.ts);
      if (Number.isFinite(t) && (t < fromMs || t > toMs)) continue;
    }
    if (q && !line.message.toLowerCase().includes(q)) continue;
    filtered.push(line);
    if (filtered.length >= SYSTEM_LOG_MAX_LINES) {
      return { lines: filtered, truncated: true };
    }
  }
  return { lines: filtered, truncated: false };
}

/** Demux Docker non-TTY log stream (8-byte headers) into UTF-8 text. */
export function demuxDockerLogStream(buf: Buffer): string {
  if (buf.length === 0) return '';
  // If it already looks like plain text / json lines, keep as-is.
  if (buf[0] !== 0x01 && buf[0] !== 0x02) {
    return buf.toString('utf8');
  }
  const parts: Buffer[] = [];
  let offset = 0;
  while (offset + 8 <= buf.length) {
    const size = buf.readUInt32BE(offset + 4);
    offset += 8;
    if (size < 0 || offset + size > buf.length) break;
    parts.push(buf.subarray(offset, offset + size));
    offset += size;
  }
  if (parts.length === 0) return buf.toString('utf8');
  return Buffer.concat(parts).toString('utf8');
}
