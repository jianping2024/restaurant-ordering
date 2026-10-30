'use client';

import { useEffect, useRef, useState } from 'react';
import { dishVideoDeviceAllows } from '@/lib/menu-dish-video';
import {
  applyDishMotionVideoElementSrc,
  dishMotionVideoShouldPlay,
  type DishMotionVideoLayer,
} from '@/lib/menu-dish-video-playback';
import { MENU_IMAGE_OBJECT_FIT_CLASS } from '@/lib/menu-image';

/** How many detail-layer players are mounted (sheet open). Rails yield while > 0. */
let detailOpenCount = 0;
const detailOpenListeners = new Set<() => void>();

function getDishMotionDetailOpen(): boolean {
  return detailOpenCount > 0;
}

function subscribeDishMotionDetailOpen(listener: () => void): () => void {
  detailOpenListeners.add(listener);
  return () => {
    detailOpenListeners.delete(listener);
  };
}

function notifyDishMotionDetailOpenListeners(): void {
  detailOpenListeners.forEach((listener) => listener());
}

function retainDishMotionDetailOpen(): () => void {
  detailOpenCount += 1;
  notifyDishMotionDetailOpenListeners();
  return () => {
    detailOpenCount = Math.max(0, detailOpenCount - 1);
    notifyDishMotionDetailOpenListeners();
  };
}

function deviceAllowsDishVideo(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
    .connection;
  return dishVideoDeviceAllows({
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    saveData: connection?.saveData,
    effectiveType: connection?.effectiveType,
  });
}

/**
 * Sole guest dish motion video: muted seamless loop over the still photo.
 * Play only when on screen (≥50%), the tab is visible, and — for rail — no
 * detail sheet is open. Detail layer always wins while mounted. Downloads
 * only when about to play (`preload="none"`); catalog URL changes always
 * resync the element `src` (never keep a stale mp4). Reduced motion / data
 * saver / 2G / errors keep the photo. No global concurrent cap.
 */
export function DishMotionVideo(props: {
  src: string | null | undefined;
  /** Recommended rail (default) yields while a detail player is open. */
  layer?: DishMotionVideoLayer;
}) {
  const { src } = props;
  const layer: DishMotionVideoLayer = props.layer ?? 'rail';
  const ref = useRef<HTMLVideoElement>(null);
  const intersectingRef = useRef(false);
  const [allowed, setAllowed] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setAllowed(Boolean(src) && deviceAllowsDishVideo());
    setReady(false);
    setFailed(false);
  }, [src]);

  useEffect(() => {
    if (layer !== 'detail') return;
    return retainDishMotionDetailOpen();
  }, [layer]);

  useEffect(() => {
    const video = ref.current;
    if (!allowed || failed || !video || !src) return;

    const sync = () => {
      const should = dishMotionVideoShouldPlay({
        intersecting: intersectingRef.current,
        pageVisible: document.visibilityState === 'visible',
        layer,
        detailOpen: getDishMotionDetailOpen(),
      });
      if (should) {
        if (applyDishMotionVideoElementSrc(video, src)) {
          setReady(false);
        }
        void video.play().catch(() => {
          /* autoplay refused (e.g. iOS low power) → photo stays */
        });
      } else if (!video.paused) {
        video.pause();
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        intersectingRef.current = Boolean(entry?.isIntersecting);
        sync();
      },
      { threshold: 0.5 },
    );
    observer.observe(video);

    const onVisibility = () => {
      sync();
    };
    document.addEventListener('visibilitychange', onVisibility);
    const unsubscribeDetail = subscribeDishMotionDetailOpen(sync);

    sync();

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      unsubscribeDetail();
      video.pause();
    };
  }, [allowed, failed, src, layer]);

  if (!allowed || failed || !src) return null;
  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      preload="none"
      aria-hidden
      tabIndex={-1}
      disablePictureInPicture
      onPlaying={() => setReady(true)}
      onError={() => setFailed(true)}
      className={`pointer-events-none absolute inset-0 h-full w-full ${MENU_IMAGE_OBJECT_FIT_CLASS} transition-opacity duration-300 motion-reduce:transition-none ${
        ready ? 'opacity-100' : 'opacity-0'
      }`}
    />
  );
}
