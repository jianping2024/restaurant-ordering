/**
 * Sole runtime identity for the web process (on-prem pack VER / Vercel git SHA).
 * Do not read package.json, current.json, or manifest.json here.
 */
export type WebAppBuildInfo = {
  version: string;
};

/** Only getter for web build version — health + settings footer both call this. */
export function getWebAppBuildInfo(): WebAppBuildInfo {
  const fromEnv = process.env.MESA_WEB_VERSION?.trim();
  if (fromEnv) return { version: fromEnv };

  const vercel = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  if (vercel) return { version: vercel.slice(0, 7) };

  return { version: '' };
}
