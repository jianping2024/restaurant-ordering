import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

describe('mesa money font wiring', () => {
  it('loads Mesa Money only via mesaMoneyFont + --font-mesa-money (no globals @font-face)', () => {
    const fontModule = readFileSync(join(here, 'mesa-money-font.ts'), 'utf8');
    assert.match(fontModule, /next\/font\/local/);
    assert.match(fontModule, /--font-mesa-money/);
    assert.match(fontModule, /display:\s*'optional'/);
    assert.match(fontModule, /CormorantGaramond-Variable\.ttf/);

    const globals = readFileSync(join(here, '../app/globals.css'), 'utf8');
    assert.match(globals, /var\(--font-mesa-money\)/);
    assert.doesNotMatch(globals, /@font-face\s*\{/);
    assert.doesNotMatch(globals, /font-family:\s*'Mesa Money'/);

    const layout = readFileSync(join(here, '../app/layout.tsx'), 'utf8');
    assert.match(layout, /mesaMoneyFont/);
    assert.match(layout, /mesaMoneyFont\.variable/);
  });
});
