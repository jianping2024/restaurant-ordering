import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { STANDALONE_DISPLAY_MEDIA_QUERIES } from './install-display.ts';
import {
  PWA_LAUNCH_FADE_MS,
  PWA_LAUNCH_HOLD_MS,
  PWA_LAUNCH_MARK_PX,
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
  it('style/boot/layout share one id, mark size, fade/hold timing, and standalone queries', () => {
    const style = buildPwaLaunchShellStyle();
    const boot = buildPwaLaunchShellBootScript();

    assert.equal(PWA_LAUNCH_MARK_PX, 180);
    assert.equal(PWA_LAUNCH_FADE_MS, 350);
    assert.equal(PWA_LAUNCH_HOLD_MS, 900);
    assert.equal(layoutSource.includes('PWA_LAUNCH_SHELL_MIN_MS'), false);
    assert.equal(boot.includes('PWA_LAUNCH_SHELL_MIN_MS'), false);

    assert.match(style, new RegExp(`#${PWA_LAUNCH_SHELL_ID}`));
    assert.match(style, new RegExp(PWA_BACKGROUND_COLOR.replace('#', '\\#')));
    assert.match(style, new RegExp(`width:${PWA_LAUNCH_MARK_PX}px`));
    assert.match(style, /data-pwa-launch-phase="in"/);
    assert.match(style, /data-pwa-launch-phase="hold"/);
    assert.match(style, /data-pwa-launch-phase="out"/);
    assert.match(style, new RegExp(`transition:opacity ${PWA_LAUNCH_FADE_MS}ms`));

    assert.match(boot, /data-pwa-launch/);
    assert.match(boot, /data-pwa-launch-phase/);
    assert.match(boot, new RegExp(PWA_BACKGROUND_COLOR.replace('#', '\\#')));
    assert.match(boot, new RegExp(String(PWA_LAUNCH_FADE_MS)));
    assert.match(boot, new RegExp(String(PWA_LAUNCH_HOLD_MS)));
    assert.match(boot, /querySelector\("img"\)/);
    assert.equal(boot.includes('el.remove()'), false);
    // Fade-in must arm after display is on (rAF), not same tick as data-pwa-launch.
    assert.match(boot, /setAttribute\("data-pwa-launch","1"\)/);
    assert.match(
      boot,
      /setAttribute\("data-pwa-launch","1"\)[\s\S]*requestAnimationFrame[\s\S]*data-pwa-launch-phase","in"/,
    );

    for (const query of STANDALONE_DISPLAY_MEDIA_QUERIES) {
      assert.match(boot, new RegExp(query.replace(/[()]/g, '\\$&')));
    }

    assert.match(layoutSource, /id=\{PWA_LAUNCH_SHELL_ID\}/);
    assert.match(layoutSource, /width=\{PWA_LAUNCH_MARK_PX\}/);
    assert.match(layoutSource, /height=\{PWA_LAUNCH_MARK_PX\}/);
    assert.match(layoutSource, /PWA_ICON_PATHS\.any192/);
    assert.match(layoutSource, /buildPwaLaunchShellStyle/);
    assert.match(layoutSource, /buildPwaLaunchShellBootScript/);
    assert.equal(layoutSource.includes('buildPwaLaunchShellMarkup'), false);
    assert.equal(layoutSource.includes('width={96}'), false);
  });
});
