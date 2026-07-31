import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import {
  buildStaffLoginQrUrl,
  buildTableMenuQrUrl,
  generateTableQrDataUrl,
  removeTableQrCache,
  tableQrDownloadFilename,
} from './table-menu-qr.ts';

describe('table-menu-qr', () => {
  beforeEach(() => {
    removeTableQrCache('table-a');
    removeTableQrCache('table-b');
  });

  it('buildTableMenuQrUrl uses explicit origin and encodes table id', () => {
    const url = buildTableMenuQrUrl('demo-restaurant', 'abc-123', 'http://192.168.0.141');
    assert.equal(url, 'http://192.168.0.141/demo-restaurant/menu?table_id=abc-123');
  });

  it('buildStaffLoginQrUrl points at staff login', () => {
    assert.equal(
      buildStaffLoginQrUrl('demo-restaurant', 'https://pirata.example.com'),
      'https://pirata.example.com/demo-restaurant/staff/login',
    );
  });

  it('tableQrDownloadFilename sanitizes display name', () => {
    assert.equal(tableQrDownloadFilename('A-01'), 'table-A-01-qr.png');
    assert.equal(tableQrDownloadFilename('  '), 'table-table-qr.png');
  });

  it('generateTableQrDataUrl caches by origin and table id', async () => {
    const first = await generateTableQrDataUrl('demo-restaurant', 'table-a', 'http://localhost:3000');
    const second = await generateTableQrDataUrl('demo-restaurant', 'table-a', 'http://localhost:3000');
    assert.equal(first, second);
    assert.match(first, /^data:image\/png;base64,/);
  });

  it('removeTableQrCache forces regeneration', async () => {
    const first = await generateTableQrDataUrl('demo-restaurant', 'table-b', 'http://localhost:3000');
    removeTableQrCache('table-b');
    const second = await generateTableQrDataUrl('demo-restaurant', 'table-b', 'http://localhost:3000');
    assert.match(first, /^data:image\/png;base64,/);
    assert.match(second, /^data:image\/png;base64,/);
  });
});
