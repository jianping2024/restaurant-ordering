import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

describe('product UI font wiring', () => {
  it('loads only Jost; heading / money / statusVertical share body face', () => {
    const layout = readFileSync(join(here, '../app/layout.tsx'), 'utf8');
    assert.match(layout, /from "next\/font\/google"/);
    assert.match(layout, /\bJost\b/);
    assert.match(layout, /--font-jost/);
    assert.doesNotMatch(layout, /Cormorant|Noto_Serif|mesaMoneyFont|mesa-money-font/);

    const globals = readFileSync(join(here, '../app/globals.css'), 'utf8');
    assert.match(globals, /\.mesa-money\s*\{[\s\S]*?font-family:\s*var\(--font-jost\)/);
    assert.match(globals, /\.mesa-status-vertical\s*\{[\s\S]*?font-family:\s*var\(--font-jost\)/);
    assert.doesNotMatch(globals, /--font-mesa-money|--font-cormorant|--font-cjk-serif/);
    assert.doesNotMatch(globals, /oldstyle-nums|font-feature-settings:\s*'onum'/);
    assert.doesNotMatch(globals, /@font-face\s*\{/);

    const tailwind = readFileSync(join(here, '../../tailwind.config.ts'), 'utf8');
    assert.match(tailwind, /heading:\s*\["var\(--font-jost\)"/);
    assert.match(tailwind, /body:\s*\["var\(--font-jost\)"/);
    assert.doesNotMatch(tailwind, /--font-cormorant|--font-cjk-serif/);
  });
});
