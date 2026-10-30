/**
 * Sole guest dish-motion playback policy (pure): play only when the surface
 * should be seen — on screen, tab visible, and not covered by an open detail.
 * Element `src` must always match the catalog URL (resync when it changes).
 * No global concurrent cap. Client wiring lives in `DishMotionVideo`.
 *
 * Well media exclusivity: when motion is covering, the still (photo/emoji)
 * must not show through — sole `dishMotionCoversStill`.
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
 * Sole rule: motion is the only visible media in the well (still must hide).
 * Ready = first `playing` event; failed / not allowed → still stays.
 */
export function dishMotionCoversStill(input: {
  allowed: boolean;
  failed: boolean;
  ready: boolean;
}): boolean {
  return input.allowed && !input.failed && input.ready;
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
