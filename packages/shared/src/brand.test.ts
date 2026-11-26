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
  it('defines OULIN product naming', () => {
    assert.equal(PRODUCT_NAME, 'OULIN');
    assert.equal(OPS_CONSOLE_NAME, 'OULIN Ops');
    assert.equal(PRINT_AGENT_NAME, 'OULIN Print Agent');
    assert.equal(PRINT_AGENT_TRAY_TITLE, 'OULIN Print');
    assert.equal(PRODUCT_SITE_TITLE, 'OULIN — 葡萄牙餐厅点餐系统');
  });

  it('localizes print agent label', () => {
    assert.equal(printAgentLabel('zh'), 'OULIN 打印助手');
    assert.equal(printAgentLabel('en'), 'OULIN Print Agent');
    assert.equal(printAgentLabel('pt'), 'OULIN Print Agent');
  });
});
