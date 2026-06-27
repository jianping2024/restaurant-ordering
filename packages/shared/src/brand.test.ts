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
  it('defines MesaGo product naming', () => {
    assert.equal(PRODUCT_NAME, 'MesaGo');
    assert.equal(OPS_CONSOLE_NAME, 'MesaGo Ops');
    assert.equal(PRINT_AGENT_NAME, 'MesaGo Print Agent');
    assert.equal(PRINT_AGENT_TRAY_TITLE, 'MesaGo Print');
    assert.equal(PRODUCT_SITE_TITLE, 'MesaGo — 葡萄牙餐厅点餐系统');
  });

  it('localizes print agent label', () => {
    assert.equal(printAgentLabel('zh'), 'MesaGo 打印助手');
    assert.equal(printAgentLabel('en'), 'MesaGo Print Agent');
    assert.equal(printAgentLabel('pt'), 'MesaGo Print Agent');
  });
});
