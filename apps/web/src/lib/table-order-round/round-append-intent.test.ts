import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveRoundAppendClientRequestId } from './round-append-intent';

type RoundRow = { append_client_request_id: string | null };

function mockAdmin(initial: RoundRow) {
  const state = { ...initial };
  const api = {
    from() {
      return {
        update(patch: Partial<RoundRow>) {
          return {
            eq() {
              return {
                is(col: string, value: null) {
                  return {
                    select() {
                      return {
                        async maybeSingle() {
                          if (
                            col === 'append_client_request_id' &&
                            value === null &&
                            state.append_client_request_id === null
                          ) {
                            Object.assign(state, patch);
                            return { data: { ...state }, error: null };
                          }
                          return { data: null, error: null };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
        select() {
          return {
            eq() {
              return {
                async maybeSingle() {
                  return { data: { ...state }, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
  return { admin: api as never, state };
}

describe('resolveRoundAppendClientRequestId', () => {
  it('returns existing id without minting', async () => {
    const { admin, state } = mockAdmin({ append_client_request_id: 'already-set' });
    const id = await resolveRoundAppendClientRequestId({
      admin,
      roundId: 'round-1',
      existingId: 'already-set',
    });
    assert.equal(id, 'already-set');
    assert.equal(state.append_client_request_id, 'already-set');
  });

  it('first writer wins when id is null', async () => {
    const { admin, state } = mockAdmin({ append_client_request_id: null });
    const id = await resolveRoundAppendClientRequestId({
      admin,
      roundId: 'round-1',
      existingId: null,
    });
    assert.ok(id.length > 0);
    assert.equal(state.append_client_request_id, id);
  });

  it('loser re-reads winner id when conditional update matches zero rows', async () => {
    const { admin, state } = mockAdmin({ append_client_request_id: 'winner-id' });
    const id = await resolveRoundAppendClientRequestId({
      admin,
      roundId: 'round-1',
      existingId: null,
    });
    assert.equal(id, 'winner-id');
    assert.equal(state.append_client_request_id, 'winner-id');
  });
});
