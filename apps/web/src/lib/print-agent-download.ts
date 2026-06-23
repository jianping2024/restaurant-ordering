import fs from 'fs';
import path from 'path';

/**
 * Stable GitHub Release asset basenames (CI must keep these names).
 * Dashboard links use /api/downloads/print-agent/* instead — those paths never change.
 */
export const PRINT_AGENT_GITHUB_ASSETS = {
  setupAmd64: 'MesaPrintAgent-Setup-amd64.exe',
  portableAmd64: 'MesaPrintAgent-windows-amd64.zip',
  setupArm64: 'MesaPrintAgent-Setup-arm64.exe',
  portableArm64: 'MesaPrintAgent-windows-arm64.zip',
} as const;

export type PrintAgentDownloadArtifact =
  | 'setup-amd64'
  | 'portable-amd64'
  | 'setup-arm64'
  | 'portable-arm64';

const ARTIFACT_TO_FILE: Record<PrintAgentDownloadArtifact, string> = {
  'setup-amd64': PRINT_AGENT_GITHUB_ASSETS.setupAmd64,
  'portable-amd64': PRINT_AGENT_GITHUB_ASSETS.portableAmd64,
  'setup-arm64': PRINT_AGENT_GITHUB_ASSETS.setupArm64,
  'portable-arm64': PRINT_AGENT_GITHUB_ASSETS.portableArm64,
};

/** Permanent paths on this site (prepend origin, e.g. NEXT_PUBLIC_BASE_URL). */
export const PRINT_AGENT_DOWNLOAD_API_PATHS = {
  setupAmd64: '/api/downloads/print-agent/setup-amd64',
  portableAmd64: '/api/downloads/print-agent/portable-amd64',
  setupArm64: '/api/downloads/print-agent/setup-arm64',
  portableArm64: '/api/downloads/print-agent/portable-arm64',
} as const;

export type PrintAgentDownloadUrls = {
  setupAmd64: string;
  setupArm64: string;
  zipAmd64: string;
  zipArm64: string;
  releasesPage: string;
};

export type PublishedPrintAgentFallback = {
  version: string;
  setupAmd64: string;
  zipAmd64: string;
  releasesPage: string;
};

export function isPrintAgentDownloadArtifact(s: string): s is PrintAgentDownloadArtifact {
  return s in ARTIFACT_TO_FILE;
}

export function getPrintAgentGithubRepo(): string | null {
  const repo = process.env.NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO?.trim();
  if (!repo || repo.includes('..') || repo.startsWith('/')) return null;
  return repo;
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

function pinnedReleaseDownloadUrl(repo: string, version: string, filename: string): string {
  return `https://github.com/${repo}/releases/download/print-agent-v${version}/${filename}`;
}

/** Latest GitHub “release” pointer — only when VERSION is unset (avoid silent downgrade). */
function latestReleaseDownloadUrl(repo: string, filename: string): string {
  return `https://github.com/${repo}/releases/latest/download/${filename}`;
}

async function githubAssetExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow', cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

/** Whether the pinned print-agent-v{version} asset exists on GitHub (not /latest). */
export async function isPinnedPrintAgentReleaseAvailable(
  artifact: PrintAgentDownloadArtifact = 'setup-amd64',
): Promise<boolean> {
  const repo = getPrintAgentGithubRepo();
  const version = getPrintAgentVersion();
  if (!repo || !version) return false;
  const url = pinnedReleaseDownloadUrl(repo, version, ARTIFACT_TO_FILE[artifact]);
  return githubAssetExists(url);
}

/** Resolve download URL for the version in apps/print-agent/VERSION only — never silently use /latest. */
export async function resolvePrintAgentGitHubDownloadUrl(
  artifact: PrintAgentDownloadArtifact,
): Promise<string | null> {
  const repo = getPrintAgentGithubRepo();
  if (!repo) return null;

  const filename = ARTIFACT_TO_FILE[artifact];
  const version = getPrintAgentVersion();
  if (version) {
    const pinned = pinnedReleaseDownloadUrl(repo, version, filename);
    if (await githubAssetExists(pinned)) return pinned;
    return null;
  }

  const latest = latestReleaseDownloadUrl(repo, filename);
  if (await githubAssetExists(latest)) return latest;
  return null;
}

/** Newest print-agent-v* release on GitHub that actually has installer assets. */
export async function findLatestPublishedPrintAgentRelease(): Promise<PublishedPrintAgentFallback | null> {
  const repo = getPrintAgentGithubRepo();
  if (!repo) return null;

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=40`, {
      headers: { Accept: 'application/vnd.github+json' },
      next: { revalidate: 120 },
    });
    if (!res.ok) return null;

    const releases = (await res.json()) as Array<{ tag_name?: string }>;
    for (const rel of releases) {
      const tag = rel.tag_name?.trim() ?? '';
      if (!tag.startsWith('print-agent-v')) continue;
      const version = tag.slice('print-agent-v'.length);
      const setupUrl = pinnedReleaseDownloadUrl(repo, version, PRINT_AGENT_GITHUB_ASSETS.setupAmd64);
      if (!(await githubAssetExists(setupUrl))) continue;
      return {
        version,
        setupAmd64: setupUrl,
        zipAmd64: pinnedReleaseDownloadUrl(repo, version, PRINT_AGENT_GITHUB_ASSETS.portableAmd64),
        releasesPage: `https://github.com/${repo}/releases/tag/${tag}`,
      };
    }
  } catch {
    return null;
  }
  return null;
}

/** Stable dashboard links on this deployment (origin required). */
export function getPrintAgentDownloadUrls(siteOrigin: string): PrintAgentDownloadUrls | null {
  const repo = getPrintAgentGithubRepo();
  const origin = siteOrigin.replace(/\/$/, '');
  if (!repo || !origin) return null;

  const version = getPrintAgentVersion();
  const releasesPage = version
    ? `https://github.com/${repo}/releases/tag/print-agent-v${version}`
    : `https://github.com/${repo}/releases`;

  return {
    setupAmd64: `${origin}${PRINT_AGENT_DOWNLOAD_API_PATHS.setupAmd64}`,
    zipAmd64: `${origin}${PRINT_AGENT_DOWNLOAD_API_PATHS.portableAmd64}`,
    setupArm64: `${origin}${PRINT_AGENT_DOWNLOAD_API_PATHS.setupArm64}`,
    zipArm64: `${origin}${PRINT_AGENT_DOWNLOAD_API_PATHS.portableArm64}`,
    releasesPage,
  };
}
