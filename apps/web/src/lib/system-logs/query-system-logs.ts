import 'server-only';

import { readFile } from 'node:fs/promises';
import { readWebDockerLogs } from '@/lib/system-logs/docker-log-source';
import {
  SYSTEM_LOG_MAX_BYTES,
  SYSTEM_LOG_MAX_RANGE_MS,
  filterSystemLogLines,
  parseLogTextToLines,
} from '@/lib/system-logs/parse-log-text';
import type { SystemLogQuery, SystemLogQueryResult } from '@/lib/system-logs/types';

export type SystemLogQueryErrorCode =
  | 'invalid_range'
  | 'range_too_large'
  | 'source_unavailable'
  | 'read_failed';

export class SystemLogQueryError extends Error {
  readonly code: SystemLogQueryErrorCode;

  constructor(code: SystemLogQueryErrorCode, message?: string) {
    super(message || code);
    this.code = code;
    this.name = 'SystemLogQueryError';
  }
}

/**
 * Sole reader for on-prem web runtime logs.
 * Production: Docker Engine logs API (json-file 20m×5 behind the daemon).
 * Local UAT: MESA_SYSTEM_LOG_PATH plain/json-file fixture (same parse + filter).
 */
export async function querySystemLogs(query: SystemLogQuery): Promise<SystemLogQueryResult> {
  if (!(query.from instanceof Date) || !(query.to instanceof Date)) {
    throw new SystemLogQueryError('invalid_range');
  }
  if (
    !Number.isFinite(query.from.getTime()) ||
    !Number.isFinite(query.to.getTime()) ||
    query.from.getTime() > query.to.getTime()
  ) {
    throw new SystemLogQueryError('invalid_range');
  }
  if (query.to.getTime() - query.from.getTime() > SYSTEM_LOG_MAX_RANGE_MS) {
    throw new SystemLogQueryError('range_too_large');
  }

  const filePath = (process.env.MESA_SYSTEM_LOG_PATH || '').trim();
  let raw: string;
  let source: SystemLogQueryResult['source'];

  try {
    if (filePath) {
      source = 'file';
      const buf = await readFile(filePath);
      raw = buf.subarray(0, SYSTEM_LOG_MAX_BYTES).toString('utf8');
    } else {
      source = 'docker';
      raw = await readWebDockerLogs(query.from, query.to);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'read_failed';
    if (message.includes('ENOENT') || message.includes('docker_web_container_not_found')) {
      throw new SystemLogQueryError('source_unavailable', message);
    }
    throw new SystemLogQueryError('read_failed', message);
  }

  const parsed = parseLogTextToLines(raw);
  const { lines, truncated } = filterSystemLogLines(parsed, query);
  return { lines, truncated, source };
}
