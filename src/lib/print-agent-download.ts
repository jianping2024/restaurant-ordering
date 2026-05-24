import fs from 'fs';
import path from 'path';

/** GitHub Releases download URLs for the Windows print agent (stable asset names). */

export type PrintAgentDownloadUrls = {
  setupAmd64: string;
  setupArm64: string;
  zipAmd64: string;
  zipArm64: string;
  releasesPage: string;
};

export function getPrintAgentDownloadUrls(): PrintAgentDownloadUrls | null {
  const repo = process.env.NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO?.trim();
  const version = getPrintAgentVersion();
  if (!repo || repo.includes('..') || repo.startsWith('/') || !version) return null;

  // Binaries: GitHub "latest" release (this repo only publishes print-agent tags).
  // Avoids 404 when the dashboard is deployed before release assets are uploaded.
  const latestDl = `https://github.com/${repo}/releases/latest/download`;
  const tagPage = `https://github.com/${repo}/releases/tag/print-agent-v${version}`;

  return {
    setupAmd64: `${latestDl}/MesaPrintAgent-Setup-amd64.exe`,
    zipAmd64: `${latestDl}/MesaPrintAgent-windows-amd64.zip`,
    // arm64 installer is not in CI yet; tag page lists all assets if published manually.
    setupArm64: `${latestDl}/MesaPrintAgent-Setup-arm64.exe`,
    zipArm64: `${latestDl}/MesaPrintAgent-windows-arm64.zip`,
    releasesPage: tagPage,
  };
}

/** Semver baked into CI builds (apps/print-agent/VERSION). Override via NEXT_PUBLIC_PRINT_AGENT_VERSION. */
export function getPrintAgentVersion(): string {
  const fromEnv = process.env.NEXT_PUBLIC_PRINT_AGENT_VERSION?.trim();
  if (fromEnv) return fromEnv;
  try {
    const versionPath = path.join(process.cwd(), 'apps/print-agent/VERSION');
    return fs.readFileSync(versionPath, 'utf8').trim();
  } catch {
    return '';
  }
}
