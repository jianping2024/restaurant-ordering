import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collectPaymentInitialCustomerName,
  shouldAutoIssueFiscalAfterCollect,
} from './checkout-print-ask';
import { WHOLE_TABLE_PAYER_KEY } from './split-person-label';

describe('shouldAutoIssueFiscalAfterCollect', () => {
  it('is false when fiscal is off', () => {
    assert.equal(
      shouldAutoIssueFiscalAfterCollect({
        fiscal: false,
        paymentMethod: 'MULTIBANCO',
        customerNif: '502757191',
      }),
      false,
    );
  });

  it('is true for MULTIBANCO / MIXED without NIF', () => {
    assert.equal(
      shouldAutoIssueFiscalAfterCollect({
        fiscal: true,
        paymentMethod: 'MULTIBANCO',
        customerNif: '',
      }),
      true,
    );
    assert.equal(
      shouldAutoIssueFiscalAfterCollect({
        fiscal: true,
        paymentMethod: 'MIXED',
        customerNif: '',
      }),
      true,
    );
  });

  it('is true for CASH with valid NIF', () => {
    assert.equal(
      shouldAutoIssueFiscalAfterCollect({
        fiscal: true,
        paymentMethod: 'CASH',
        customerNif: '502757191',
      }),
      true,
    );
  });

  it('is false for CASH without NIF', () => {
    assert.equal(
      shouldAutoIssueFiscalAfterCollect({
        fiscal: true,
        paymentMethod: 'CASH',
        customerNif: '',
      }),
      false,
    );
  });

  it('is false for CASH with invalid NIF', () => {
    assert.equal(
      shouldAutoIssueFiscalAfterCollect({
        fiscal: true,
        paymentMethod: 'CASH',
        customerNif: '123456780',
      }),
      false,
    );
  });
});

describe('collectPaymentInitialCustomerName', () => {
  it('trims person names and drops whole-table sentinels', () => {
    assert.equal(collectPaymentInitialCustomerName('  Ana  '), 'Ana');
    assert.equal(collectPaymentInitialCustomerName(WHOLE_TABLE_PAYER_KEY), '');
    assert.equal(collectPaymentInitialCustomerName('整桌'), '');
    assert.equal(collectPaymentInitialCustomerName(undefined), '');
    assert.equal(collectPaymentInitialCustomerName(''), '');
  });
});
