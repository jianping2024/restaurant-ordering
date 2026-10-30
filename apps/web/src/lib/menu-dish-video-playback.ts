/**
 * Sole guest dish-motion playback policy (pure): play only when the surface
 * should be seen — on screen, tab visible, and not covered by an open detail.
 * No global concurrent cap. Client wiring lives in {@link DishMotionVideo}.
 */

export type DishMotionVideoLayer = 'rail' | 'detail';

export function dishMotionVideoShouldPlay(input: {
  intersecting: boolean;
  pageVisible: boolean;
  layer: DishMotionVideoLayer;
  detailOpen: boolean;
}): boolean {
  if (!input.intersecting || !input.pageVisible) return false;
  if (input.layer === 'detail') return true;
  return !input.detailOpen;
}
