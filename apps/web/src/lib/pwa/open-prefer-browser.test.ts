import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { openHttpUrlPreferBrowser } from './open-prefer-browser.ts';

describe('openHttpUrlPreferBrowser', () => {
  it('opens a browser tab when not standalone', async () => {
    const opened: string[] = [];
    const result = await openHttpUrlPreferBrowser('https://example.test/menu', {
      isStandalone: () => false,
      openTab: (url) => {
        opened.push(url);
      },
    });
    assert.deepEqual(result, { mode: 'browser_tab' });
    assert.deepEqual(opened, ['https://example.test/menu']);
  });

  it('copies to clipboard when standalone (never opens a tab)', async () => {
    const opened: string[] = [];
    const copied: string[] = [];
    const result = await openHttpUrlPreferBrowser('https://example.test/menu?table_id=1', {
      isStandalone: () => true,
      openTab: (url) => {
        opened.push(url);
      },
      writeClipboard: async (text) => {
        copied.push(text);
        return true;
      },
    });
    assert.deepEqual(result, { mode: 'clipboard', ok: true });
    assert.deepEqual(opened, []);
    assert.deepEqual(copied, ['https://example.test/menu?table_id=1']);
  });

  it('reports clipboard failure without opening a tab', async () => {
    const opened: string[] = [];
    const result = await openHttpUrlPreferBrowser('https://example.test/x', {
      isStandalone: () => true,
      openTab: (url) => {
        opened.push(url);
      },
      writeClipboard: async () => false,
    });
    assert.deepEqual(result, { mode: 'clipboard', ok: false });
    assert.deepEqual(opened, []);
  });
});
