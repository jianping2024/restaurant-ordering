'use client';

import { useEffect, useRef, useState } from 'react';
import {
  DISH_VIDEO_MAX_CONCURRENT_PLAYING,
  dishVideoDeviceAllows,
} from '@/lib/menu-dish-video';
import { MENU_IMAGE_OBJECT_FIT_CLASS } from '@/lib/menu-image';

const playing = new Set<HTMLVideoElement>();

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
 * Sole guest dish motion video: muted seamless loop layered over the still photo in the
 * same well. The photo stays the poster — the video fades in only once it is playing,
 * downloads only when ≥50% on screen, pauses off screen, and never renders on reduced
 * motion / data saver / load error / autoplay refusal. Max {@link DISH_VIDEO_MAX_CONCURRENT_PLAYING}.
 */
export function DishMotionVideo({ src }: { src: string | null | undefined }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [allowed, setAllowed] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setAllowed(Boolean(src) && deviceAllowsDishVideo());
    setReady(false);
    setFailed(false);
  }, [src]);

  useEffect(() => {
    const video = ref.current;
    if (!allowed || failed || !video || !src) return;
    const play = () => {
      if (playing.size >= DISH_VIDEO_MAX_CONCURRENT_PLAYING && !playing.has(video)) return;
      if (!video.getAttribute('src')) video.setAttribute('src', src);
      void video.play().catch(() => {
        /* autoplay refused (e.g. iOS low power) → photo stays */
      });
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) play();
        else if (!video.paused) video.pause();
      },
      { threshold: 0.5 },
    );
    observer.observe(video);
    return () => {
      observer.disconnect();
      video.pause();
      playing.delete(video);
    };
  }, [allowed, failed, src]);

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
      onPlaying={(e) => {
        playing.add(e.currentTarget);
        setReady(true);
      }}
      onPause={(e) => playing.delete(e.currentTarget)}
      onError={() => setFailed(true)}
      className={`pointer-events-none absolute inset-0 h-full w-full ${MENU_IMAGE_OBJECT_FIT_CLASS} transition-opacity duration-300 motion-reduce:transition-none ${
        ready ? 'opacity-100' : 'opacity-0'
      }`}
    />
  );
}
