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

/**
 * Minimum time the branded shell stays up after DOM is ready (standalone only).
 * 2× rAF alone is invisible on real iOS/Android; keep one constant here.
 */
export const PWA_LAUNCH_SHELL_MIN_MS = 600;

/** Sole CSS for the launch overlay (shown only when html[data-pwa-launch="1"]). */
export function buildPwaLaunchShellStyle(): string {
  return `#${PWA_LAUNCH_SHELL_ID}{display:none;position:fixed;inset:0;z-index:2147483646;align-items:center;justify-content:center;background:${PWA_BACKGROUND_COLOR};margin:0;padding:0;pointer-events:none}html[data-pwa-launch="1"] #${PWA_LAUNCH_SHELL_ID}{display:flex}#${PWA_LAUNCH_SHELL_ID} img{width:96px;height:96px;display:block}`;
}

/**
 * Body boot: mark standalone windows so CSS shows the shell, wait for the mark
 * image (or timeout), hold {@link PWA_LAUNCH_SHELL_MIN_MS}, then clear the flag.
 * Does not remove the React-owned node (avoids hydration mismatch).
 */
export function buildPwaLaunchShellBootScript(): string {
  const queries = JSON.stringify([...STANDALONE_DISPLAY_MEDIA_QUERIES]);
  const id = JSON.stringify(PWA_LAUNCH_SHELL_ID);
  const minMs = String(PWA_LAUNCH_SHELL_MIN_MS);
  return `(()=>{var q=${queries};var standalone=q.some(function(x){return window.matchMedia(x).matches;})||navigator.standalone===true;if(!standalone)return;document.documentElement.setAttribute("data-pwa-launch","1");document.documentElement.style.backgroundColor=${JSON.stringify(PWA_BACKGROUND_COLOR)};var dismiss=function(){document.documentElement.removeAttribute("data-pwa-launch");document.documentElement.style.backgroundColor="";};var afterReady=function(){var t0=Date.now();var finish=function(){var left=Math.max(0,${minMs}-(Date.now()-t0));setTimeout(function(){requestAnimationFrame(function(){requestAnimationFrame(dismiss);});},left);};var el=document.getElementById(${id});var img=el&&el.querySelector("img");if(!img||img.complete)finish();else{var done=false;var once=function(){if(done)return;done=true;finish();};img.addEventListener("load",once);img.addEventListener("error",once);setTimeout(once,${minMs});}};if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",afterReady);else afterReady();})();`;
}
