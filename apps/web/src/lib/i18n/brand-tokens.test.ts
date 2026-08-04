import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyBrandTokens, getBrandTokens } from './brand-tokens';

describe('brand-tokens', () => {
  it('resolves zh print assistant copy from tokens', () => {
    const tokens = getBrandTokens('zh');
    const out = applyBrandTokens(
      '在收银电脑安装并启动 {printAgent}；托盘 {brand} 图标；从 {brand} 拉取',
      tokens,
    );
    assert.equal(
      out,
      '在收银电脑安装并启动 FARVOO 打印助手；托盘 FARVOO 图标；从 FARVOO 拉取',
    );
  });

  it('resolves en tray icon token', () => {
    const tokens = getBrandTokens('en');
    const out = applyBrandTokens('Open {brand} with the {trayIcon} tray icon running', tokens);
    assert.equal(out, 'Open FARVOO with the FARVOO Print tray icon running');
  });
});
