import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { STANDALONE_DISPLAY_MEDIA_QUERIES } from './install-display.ts';
import {
  PWA_LAUNCH_SHELL_ID,
  buildPwaLaunchShellBootScript,
  buildPwaLaunchShellStyle,
} from './launch-shell.ts';
import { PWA_BACKGROUND_COLOR } from './site-manifest.ts';

const layoutSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../app/layout.tsx'),
  'utf8',
);

describe('pwa launch shell', () => {
  it('style/boot and root layout share one id, bg, icon, and standalone queries', () => {
    const style = buildPwaLaunchShellStyle();
    const boot = buildPwaLaunchShellBootScript();

    assert.match(style, new RegExp(`#${PWA_LAUNCH_SHELL_ID}`));
    assert.match(style, new RegExp(PWA_BACKGROUND_COLOR.replace('#', '\\#')));
    assert.match(boot, /data-pwa-launch/);
    assert.match(boot, new RegExp(PWA_BACKGROUND_COLOR.replace('#', '\\#')));
    assert.equal(boot.includes('el.remove()'), false);
    for (const query of STANDALONE_DISPLAY_MEDIA_QUERIES) {
      assert.match(boot, new RegExp(query.replace(/[()]/g, '\\$&')));
    }

    assert.match(layoutSource, /id=\{PWA_LAUNCH_SHELL_ID\}/);
    assert.match(layoutSource, /PWA_ICON_PATHS\.any192/);
    assert.match(layoutSource, /buildPwaLaunchShellStyle/);
    assert.match(layoutSource, /buildPwaLaunchShellBootScript/);
    assert.equal(layoutSource.includes('buildPwaLaunchShellMarkup'), false);
  });
});
