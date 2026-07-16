import type { WaiterTableBoardState } from '@/lib/waiter-board-session';

export type PartyOneClickMergePlan =
  | { kind: 'not_needed' }
  | {
      kind: 'ready';
      targetTableId: string;
      targetDisplayName: string;
      sourceTableIds: string[];
    };

/**
 * One-click party merge: only `dining` tables participate.
 * Target = first dining table in display order; checkout/idle are ignored.
 */
export function buildPartyOneClickMergePlan(
  orderedMemberTableIds: readonly string[],
  boardStateByTableId: (tableId: string) => WaiterTableBoardState,
  displayNameByTableId: (tableId: string) => string,
): PartyOneClickMergePlan {
  const diningIds = orderedMemberTableIds.filter(
    (id) => boardStateByTableId(id) === 'dining',
  );
  if (diningIds.length < 2) {
    return { kind: 'not_needed' };
  }
  const targetTableId = diningIds[0]!;
  const sourceTableIds = diningIds.slice(1);
  return {
    kind: 'ready',
    targetTableId,
    targetDisplayName: displayNameByTableId(targetTableId),
    sourceTableIds,
  };
}
