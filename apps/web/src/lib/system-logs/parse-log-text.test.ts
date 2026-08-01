import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  demuxDockerLogStream,
  filterSystemLogLines,
  parseLogTextToLines,
} from './parse-log-text.ts';

describe('parseLogTextToLines', () => {
  it('parses docker json-file lines', () => {
    const lines = parseLogTextToLines(
      [
        '{"log":"hello\\n","stream":"stdout","time":"2026-08-01T10:00:00.000000000Z"}',
        '{"log":"world\\n","stream":"stderr","time":"2026-08-01T10:00:01.000000000Z"}',
      ].join('\n'),
    );
    assert.equal(lines.length, 2);
    assert.equal(lines[0]?.message, 'hello');
    assert.equal(lines[0]?.ts, '2026-08-01T10:00:00.000000000Z');
    assert.equal(lines[1]?.message, 'world');
  });

  it('parses timestamp-prefixed docker logs lines', () => {
    const lines = parseLogTextToLines('2026-08-01T10:00:00.123456789Z ready\n');
    assert.equal(lines[0]?.ts, '2026-08-01T10:00:00.123456789Z');
    assert.equal(lines[0]?.message, 'ready');
  });
});

describe('filterSystemLogLines', () => {
  it('filters by time window and keyword', () => {
    const { lines, truncated } = filterSystemLogLines(
      [
        { ts: '2026-08-01T09:00:00.000Z', message: 'before' },
        { ts: '2026-08-01T10:00:00.000Z', message: 'alpha error' },
        { ts: '2026-08-01T11:00:00.000Z', message: 'beta ok' },
        { ts: '2026-08-01T12:00:00.000Z', message: 'gamma ERROR' },
      ],
      {
        from: new Date('2026-08-01T10:00:00.000Z'),
        to: new Date('2026-08-01T11:30:00.000Z'),
        q: 'error',
      },
    );
    assert.equal(truncated, false);
    assert.deepEqual(lines.map((l) => l.message), ['alpha error']);
  });
});

describe('demuxDockerLogStream', () => {
  it('demuxes framed docker stream', () => {
    const payload = Buffer.from('hi\n', 'utf8');
    const header = Buffer.alloc(8);
    header[0] = 1;
    header.writeUInt32BE(payload.length, 4);
    const text = demuxDockerLogStream(Buffer.concat([header, payload]));
    assert.equal(text, 'hi\n');
  });
});
