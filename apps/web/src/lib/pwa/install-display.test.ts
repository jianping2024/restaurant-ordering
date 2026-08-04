import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isStandaloneDisplay, resolvePwaInstallSurface } from './install-display.ts';

describe('isStandaloneDisplay', () => {
  it('detects CSS display-mode standalone', () => {
    assert.equal(
      isStandaloneDisplay((q) => q.includes('display-mode: standalone'), {}),
      true,
    );
  });

  it('detects iOS navigator.standalone', () => {
    assert.equal(
      isStandaloneDisplay(() => false, { standalone: true }),
      true,
    );
  });

  it('is false in a normal browser tab', () => {
    assert.equal(isStandaloneDisplay(() => false, {}), false);
  });
});

describe('resolvePwaInstallSurface', () => {
  it('hides when already installed', () => {
    assert.equal(
      resolvePwaInstallSurface({ standalone: true, deferredPromptAvailable: true }),
      'hidden',
    );
  });

  it('offers browser prompt when deferred event is available', () => {
    assert.equal(
      resolvePwaInstallSurface({ standalone: false, deferredPromptAvailable: true }),
      'browser_prompt',
    );
  });

  it('falls back to manual hint otherwise', () => {
    assert.equal(
      resolvePwaInstallSurface({ standalone: false, deferredPromptAvailable: false }),
      'manual_hint',
    );
  });
});
