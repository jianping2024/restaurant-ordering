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

/** Permanent same-origin paths (href relative — do not prefix a guessed http origin). */
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
  for (const rel of ['../../apps/print-agent/VERSION', 'apps/print-agent/VERSION'] as const) {
    try {
      return fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8').trim();
    } catch {
      /* try next cwd layout */
    }
  }
  return '';
}

function pinnedReleaseDownloadUrl(repo: string, version: string, filename: string): string {
  return `https://github.com/${repo}/releases/download/print-agent-v${version}/${filename}`;
}

/** Latest GitHub “release” pointer — only when VERSION is unset (avoid silent downgrade). */
function latestReleaseDownloadUrl(repo: string, filename: string): string {
  return `https://github.com/${repo}/releases/latest/download/${filename}`;
}

/** Cached GitHub HEAD for dashboard release status (redirect API keeps no-store). */
export const GITHUB_RELEASE_REVALIDATE_SEC = 120;

async function githubAssetExists(
  url: string,
  options?: { revalidate?: number },
): Promise<boolean> {
  try {
    const init: RequestInit =
      options?.revalidate != null
        ? { method: 'HEAD', redirect: 'follow', next: { revalidate: options.revalidate } }
        : { method: 'HEAD', redirect: 'follow', cache: 'no-store' };
    const res = await fetch(url, init);
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
  return githubAssetExists(url, { revalidate: GITHUB_RELEASE_REVALIDATE_SEC });
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
      if (
        !(await githubAssetExists(setupUrl, { revalidate: GITHUB_RELEASE_REVALIDATE_SEC }))
      ) {
        continue;
      }
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

export type PrintAgentDownloadStatus = {
  releaseReady: boolean;
  publishedFallback: PublishedPrintAgentFallback | null;
};

/** GitHub release readiness for dashboard download panel (cached; does not block other page data). */
async function resolvePrintAgentDownloadStatusInner(): Promise<PrintAgentDownloadStatus> {
  const version = getPrintAgentVersion();
  if (!version) {
    return { releaseReady: true, publishedFallback: null };
  }
  const releaseReady = await isPinnedPrintAgentReleaseAvailable('setup-amd64');
  const publishedFallback = !releaseReady ? await findLatestPublishedPrintAgentRelease() : null;
  return { releaseReady, publishedFallback };
}

const GITHUB_STATUS_TIMEOUT_MS = 5000;

export async function resolvePrintAgentDownloadStatus(): Promise<PrintAgentDownloadStatus> {
  try {
    return await Promise.race([
      resolvePrintAgentDownloadStatusInner(),
      new Promise<PrintAgentDownloadStatus>((resolve) => {
        setTimeout(
          () => resolve({ releaseReady: true, publishedFallback: null }),
          GITHUB_STATUS_TIMEOUT_MS,
        );
      }),
    ]);
  } catch {
    return { releaseReady: true, publishedFallback: null };
  }
}

/**
 * Dashboard installer links. Paths are same-origin relative so the browser keeps
 * the page scheme (https:// when the staff opened https://). Absolute origins from
 * getPublicWebOrigin can be http:// under Tunnel→Caddy X-Forwarded-Proto and Chrome
 * then hard-blocks the download as insecure.
 */
export function getPrintAgentDownloadUrls(): PrintAgentDownloadUrls | null {
  const repo = getPrintAgentGithubRepo();
  if (!repo) return null;

  const version = getPrintAgentVersion();
  const releasesPage = version
    ? `https://github.com/${repo}/releases/tag/print-agent-v${version}`
    : `https://github.com/${repo}/releases`;

  return {
    setupAmd64: PRINT_AGENT_DOWNLOAD_API_PATHS.setupAmd64,
    zipAmd64: PRINT_AGENT_DOWNLOAD_API_PATHS.portableAmd64,
    setupArm64: PRINT_AGENT_DOWNLOAD_API_PATHS.setupArm64,
    zipArm64: PRINT_AGENT_DOWNLOAD_API_PATHS.portableArm64,
    releasesPage,
  };
}
