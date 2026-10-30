/**
 * Sole guest dish-motion playback policy (pure): play only when the surface
 * should be seen — on screen, tab visible, and not covered by an open detail.
 * Element `src` must always match the catalog URL (resync when it changes).
 * No global concurrent cap. Client wiring lives in `DishMotionVideo`.
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

/**
 * Sole place that decides whether the video element needs a new `src`.
 * Returns true when the attribute was written (caller should treat as not-yet-playing).
 */
export function applyDishMotionVideoElementSrc(
  video: Pick<HTMLVideoElement, 'getAttribute' | 'setAttribute'>,
  src: string,
): boolean {
  if (video.getAttribute('src') === src) return false;
  video.setAttribute('src', src);
  return true;
}
