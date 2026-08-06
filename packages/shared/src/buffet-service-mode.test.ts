import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_BUFFET_SERVICE_MODE,
  isSushiBuffetMode,
  normalizeBuffetServiceMode,
  parseBuffetServiceMode,
} from './buffet-service-mode';

describe('buffet service mode', () => {
  it('defaults unknown to classic', () => {
    assert.equal(normalizeBuffetServiceMode(null), DEFAULT_BUFFET_SERVICE_MODE);
    assert.equal(normalizeBuffetServiceMode('nope'), 'classic');
  });

  it('parses only known modes', () => {
    assert.equal(parseBuffetServiceMode('sushi'), 'sushi');
    assert.equal(parseBuffetServiceMode('classic'), 'classic');
    assert.equal(parseBuffetServiceMode('x'), null);
  });

  it('detects sushi mode', () => {
    assert.equal(isSushiBuffetMode('sushi'), true);
    assert.equal(isSushiBuffetMode('classic'), false);
  });
});
