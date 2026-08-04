import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  OPS_CONSOLE_NAME,
  PRINT_AGENT_NAME,
  PRINT_AGENT_TRAY_TITLE,
  PRODUCT_NAME,
  PRODUCT_SITE_TITLE,
  printAgentLabel,
} from './brand';

describe('brand', () => {
  it('defines FARVOO product naming', () => {
    assert.equal(PRODUCT_NAME, 'FARVOO');
    assert.equal(OPS_CONSOLE_NAME, 'FARVOO Ops');
    assert.equal(PRINT_AGENT_NAME, 'FARVOO Print Agent');
    assert.equal(PRINT_AGENT_TRAY_TITLE, 'FARVOO Print');
    assert.equal(PRODUCT_SITE_TITLE, 'FARVOO — 葡萄牙餐厅点餐系统');
  });

  it('localizes print agent label', () => {
    assert.equal(printAgentLabel('zh'), 'FARVOO 打印助手');
    assert.equal(printAgentLabel('en'), 'FARVOO Print Agent');
    assert.equal(printAgentLabel('pt'), 'FARVOO Print Agent');
  });
});
