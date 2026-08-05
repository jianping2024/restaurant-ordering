/**
 * Standalone cold-start launch surface — one style/boot path.
 * Colors + icon paths: site-manifest only.
 * Standalone detection queries: install-display only (same as isStandaloneDisplay).
 * DOM mark: root layout JSX only (id + icon src + size from these exports).
 *
 * Phase machine (sole timing model): off → in → hold → out → off.
 */
import {
  STANDALONE_DISPLAY_MEDIA_QUERIES,
} from '@/lib/pwa/install-display';
import {
  PWA_BACKGROUND_COLOR,
} from '@/lib/pwa/site-manifest';

export const PWA_LAUNCH_SHELL_ID = 'mesa-pwa-launch';

/** Centered mark size (CSS px) — one value for style + layout img attrs. */
export const PWA_LAUNCH_MARK_PX = 180;

/** Fade-in and fade-out duration (ms) — same value both ways. */
export const PWA_LAUNCH_FADE_MS = 350;

/**
 * Fully-opaque hold after fade-in (ms), before fade-out.
 * Total branded time ≈ FADE + HOLD + FADE (~1.6s).
 */
export const PWA_LAUNCH_HOLD_MS = 900;

export type PwaLaunchPhase = 'in' | 'hold' | 'out';

/** Sole CSS for the launch overlay (shown only when html[data-pwa-launch="1"]). */
export function buildPwaLaunchShellStyle(): string {
  const id = PWA_LAUNCH_SHELL_ID;
  const px = PWA_LAUNCH_MARK_PX;
  const fade = PWA_LAUNCH_FADE_MS;
  const bg = PWA_BACKGROUND_COLOR;
  return (
    `#${id}{display:none;position:fixed;inset:0;z-index:2147483646;align-items:center;justify-content:center;background:${bg};margin:0;padding:0;pointer-events:none;opacity:0;transition:opacity ${fade}ms ease}` +
    `html[data-pwa-launch="1"] #${id}{display:flex}` +
    `html[data-pwa-launch="1"][data-pwa-launch-phase="in"] #${id},` +
    `html[data-pwa-launch="1"][data-pwa-launch-phase="hold"] #${id}{opacity:1}` +
    `html[data-pwa-launch="1"][data-pwa-launch-phase="out"] #${id}{opacity:0}` +
    `#${id} img{width:${px}px;height:${px}px;display:block}`
  );
}

/**
 * Body boot: standalone only.
 * 1) data-pwa-launch=1 (flex + opacity 0) → 2) rAF×2 then phase=in (fade)
 * → 3) hold → 4) phase=out → 5) clear flags.
 * Does not remove the React-owned node (avoids hydration mismatch).
 */
export function buildPwaLaunchShellBootScript(): string {
  const queries = JSON.stringify([...STANDALONE_DISPLAY_MEDIA_QUERIES]);
  const id = JSON.stringify(PWA_LAUNCH_SHELL_ID);
  const fadeMs = String(PWA_LAUNCH_FADE_MS);
  const holdMs = String(PWA_LAUNCH_HOLD_MS);
  const bg = JSON.stringify(PWA_BACKGROUND_COLOR);
  return `(()=>{var q=${queries};var standalone=q.some(function(x){return window.matchMedia(x).matches;})||navigator.standalone===true;if(!standalone)return;var root=document.documentElement;root.setAttribute("data-pwa-launch","1");root.style.backgroundColor=${bg};var clear=function(){root.removeAttribute("data-pwa-launch-phase");root.removeAttribute("data-pwa-launch");root.style.backgroundColor="";};var fadeOut=function(){root.setAttribute("data-pwa-launch-phase","out");setTimeout(clear,${fadeMs});};var holdThenOut=function(){root.setAttribute("data-pwa-launch-phase","hold");setTimeout(fadeOut,${holdMs});};var beginFadeIn=function(){requestAnimationFrame(function(){requestAnimationFrame(function(){root.setAttribute("data-pwa-launch-phase","in");setTimeout(holdThenOut,${fadeMs});});});};var afterReady=function(){var el=document.getElementById(${id});var img=el&&el.querySelector("img");var start=function(){beginFadeIn();};if(!img||img.complete)start();else{var done=false;var once=function(){if(done)return;done=true;start();};img.addEventListener("load",once);img.addEventListener("error",once);setTimeout(once,${fadeMs}+${holdMs});}};if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",afterReady);else afterReady();})();`;
}
