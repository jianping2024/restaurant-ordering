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
  // Pin to tag assets (same filenames on every release; /latest/download is easy to confuse).
  const base = `https://github.com/${repo}/releases/download/print-agent-v${version}`;
  return {
    setupAmd64: `${base}/MesaPrintAgent-Setup-amd64.exe`,
    setupArm64: `${base}/MesaPrintAgent-Setup-arm64.exe`,
    zipAmd64: `${base}/MesaPrintAgent-windows-amd64.zip`,
    zipArm64: `${base}/MesaPrintAgent-windows-arm64.zip`,
    releasesPage: `https://github.com/${repo}/releases/tag/print-agent-v${version}`,
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
