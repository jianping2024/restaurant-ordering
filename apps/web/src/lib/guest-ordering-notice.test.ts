import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  emptyGuestOrderingNotice,
  normalizeGuestOrderingNotice,
  resolveGuestOrderingNoticeForDisplay,
  validateGuestOrderingNoticeDraft,
} from './guest-ordering-notice';

describe('guest-ordering-notice', () => {
  it('normalizes missing payload to disabled empty notice', () => {
    assert.deepEqual(normalizeGuestOrderingNotice(null), emptyGuestOrderingNotice());
  });

  it('resolves localized title/body with pt fallback', () => {
    const notice = normalizeGuestOrderingNotice({
      enabled: true,
      updated_at: '2026-07-28T10:00:00.000Z',
      title: { pt: 'Aviso', en: '', zh: '' },
      body: { pt: 'Corpo', en: 'Body', zh: '' },
    });
    assert.deepEqual(resolveGuestOrderingNoticeForDisplay(notice, 'en'), {
      title: 'Aviso',
      body: 'Body',
      updatedAt: '2026-07-28T10:00:00.000Z',
    });
  });

  it('returns null when disabled or missing pt content while enabled', () => {
    const enabledEmpty = normalizeGuestOrderingNotice({
      enabled: true,
      updated_at: '2026-07-28T10:00:00.000Z',
      title: { pt: '', en: 'Hi', zh: '' },
      body: { pt: 'Body', en: '', zh: '' },
    });
    assert.equal(resolveGuestOrderingNoticeForDisplay(enabledEmpty, 'en'), null);
    assert.equal(
      validateGuestOrderingNoticeDraft(enabledEmpty),
      'notice_pt_title_required',
    );
  });

  it('strips control characters and trims', () => {
    const notice = normalizeGuestOrderingNotice({
      enabled: true,
      updated_at: '2026-07-28T10:00:00.000Z',
      title: { pt: '  Olá\u0007 ', en: '', zh: '' },
      body: { pt: 'Texto', en: '', zh: '' },
    });
    assert.equal(notice.title.pt, 'Olá');
    assert.equal(validateGuestOrderingNoticeDraft(notice), null);
  });
});
