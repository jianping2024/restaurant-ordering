/**
 * Standalone cold-start launch surface — one style/boot path.
 * Colors + icon paths: site-manifest only.
 * Standalone detection queries: install-display only (same as isStandaloneDisplay).
 * DOM mark: root layout JSX only (id + icon src from these exports).
 */
import {
  STANDALONE_DISPLAY_MEDIA_QUERIES,
} from '@/lib/pwa/install-display';
import {
  PWA_BACKGROUND_COLOR,
} from '@/lib/pwa/site-manifest';

export const PWA_LAUNCH_SHELL_ID = 'mesa-pwa-launch';

/** Sole CSS for the launch overlay (shown only when html[data-pwa-launch="1"]). */
export function buildPwaLaunchShellStyle(): string {
  return `#${PWA_LAUNCH_SHELL_ID}{display:none;position:fixed;inset:0;z-index:2147483646;align-items:center;justify-content:center;background:${PWA_BACKGROUND_COLOR};margin:0;padding:0;pointer-events:none}html[data-pwa-launch="1"] #${PWA_LAUNCH_SHELL_ID}{display:flex}#${PWA_LAUNCH_SHELL_ID} img{width:96px;height:96px;display:block}`;
}

/**
 * Head boot: mark standalone windows so CSS shows the shell before body paint.
 * Dismiss clears the flag after first content paint (2× rAF) — does not remove the
 * React-owned node (avoids hydration mismatch).
 */
export function buildPwaLaunchShellBootScript(): string {
  const queries = JSON.stringify([...STANDALONE_DISPLAY_MEDIA_QUERIES]);
  return `(()=>{var q=${queries};var standalone=q.some(function(x){return window.matchMedia(x).matches;})||navigator.standalone===true;if(!standalone)return;document.documentElement.setAttribute("data-pwa-launch","1");document.documentElement.style.backgroundColor=${JSON.stringify(PWA_BACKGROUND_COLOR)};var dismiss=function(){document.documentElement.removeAttribute("data-pwa-launch");document.documentElement.style.backgroundColor="";};var go=function(){requestAnimationFrame(function(){requestAnimationFrame(dismiss);});};if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",go);else go();})();`;
}
