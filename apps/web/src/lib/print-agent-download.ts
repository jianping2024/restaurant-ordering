/**
 * Store cashier agent download + recommended version.
 * Sole product line: Farvoo Fiscal Agent (farvoo-fatura `fiscal-agent-v*`).
 * Legacy Mesa `print-agent-v*` / `apps/print-agent/VERSION` is not used here.
 */

/**
 * Stable GitHub Release asset basenames (CI must keep these names).
 * Dashboard links use /api/downloads/print-agent/* instead — those paths never change.
 */
export const PRINT_AGENT_GITHUB_ASSETS = {
  setupAmd64: 'FarvooFiscalAgent-Setup-amd64.exe',
  portableAmd64: 'FarvooFiscalAgent-windows-amd64.zip',
} as const;

export type PrintAgentDownloadArtifact = 'setup-amd64' | 'portable-amd64';

const ARTIFACT_TO_FILE: Record<PrintAgentDownloadArtifact, string> = {
  'setup-amd64': PRINT_AGENT_GITHUB_ASSETS.setupAmd64,
  'portable-amd64': PRINT_AGENT_GITHUB_ASSETS.portableAmd64,
};

/** Permanent same-origin paths (href relative — do not prefix a guessed http origin). */
export const PRINT_AGENT_DOWNLOAD_API_PATHS = {
  setupAmd64: '/api/downloads/print-agent/setup-amd64',
  portableAmd64: '/api/downloads/print-agent/portable-amd64',
} as const;

export type PrintAgentDownloadUrls = {
  setupAmd64: string;
  zipAmd64: string;
  releasesPage: string;
};

export type PublishedPrintAgentFallback = {
  version: string;
  setupAmd64: string;
  zipAmd64: string;
  releasesPage: string;
};

const RELEASE_TAG_PREFIX = 'fiscal-agent-v';

export function isPrintAgentDownloadArtifact(s: string): s is PrintAgentDownloadArtifact {
  return s in ARTIFACT_TO_FILE;
}

export function getPrintAgentGithubRepo(): string | null {
  const repo = process.env.NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO?.trim();
  if (!repo || repo.includes('..') || repo.startsWith('/')) return null;
  return repo;
}

/**
 * Optional build/env pin for the recommended Fiscal Agent semver.
 * Empty → callers use {@link resolveRecommendedAgentVersion} (latest published release).
 * Does **not** read legacy `apps/print-agent/VERSION`.
 */
export function getPrintAgentVersion(): string {
  return process.env.NEXT_PUBLIC_PRINT_AGENT_VERSION?.trim() ?? '';
}

function pinnedReleaseDownloadUrl(repo: string, version: string, filename: string): string {
  return `https://github.com/${repo}/releases/download/${RELEASE_TAG_PREFIX}${version}/${filename}`;
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

/** Whether the pinned fiscal-agent-v{version} asset exists on GitHub. */
export async function isPinnedPrintAgentReleaseAvailable(
  artifact: PrintAgentDownloadArtifact = 'setup-amd64',
): Promise<boolean> {
  const repo = getPrintAgentGithubRepo();
  const version = getPrintAgentVersion();
  if (!repo || !version) return false;
  const url = pinnedReleaseDownloadUrl(repo, version, ARTIFACT_TO_FILE[artifact]);
  return githubAssetExists(url, { revalidate: GITHUB_RELEASE_REVALIDATE_SEC });
}

/**
 * Resolve download URL for the recommended Fiscal Agent build.
 * Pinned env version when set; otherwise newest published `fiscal-agent-v*` with installer assets.
 */
export async function resolvePrintAgentGitHubDownloadUrl(
  artifact: PrintAgentDownloadArtifact,
): Promise<string | null> {
  const repo = getPrintAgentGithubRepo();
  if (!repo) return null;

  const filename = ARTIFACT_TO_FILE[artifact];
  const pinned = getPrintAgentVersion();
  if (pinned) {
    const url = pinnedReleaseDownloadUrl(repo, pinned, filename);
    if (await githubAssetExists(url)) return url;
    return null;
  }

  const latest = await findLatestPublishedPrintAgentRelease();
  if (!latest) return null;
  return artifact === 'setup-amd64' ? latest.setupAmd64 : latest.zipAmd64;
}

/** Newest fiscal-agent-v* release on GitHub that actually has installer assets. */
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
      if (!tag.startsWith(RELEASE_TAG_PREFIX)) continue;
      const version = tag.slice(RELEASE_TAG_PREFIX.length);
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

/**
 * Sole recommended store-agent version for devices list + runtime-config + download badge.
 * Env pin when set; else latest published Fiscal Agent with installer assets.
 */
export async function resolveRecommendedAgentVersion(): Promise<string> {
  const pinned = getPrintAgentVersion();
  if (pinned) return pinned;
  const latest = await findLatestPublishedPrintAgentRelease();
  return latest?.version ?? '';
}

export type PrintAgentDownloadStatus = {
  version: string;
  releaseReady: boolean;
  /** When env pin is set but that tag has no assets yet — newest published build for temporary install. */
  publishedFallback: PublishedPrintAgentFallback | null;
};

/** GitHub release readiness for dashboard download panel (cached; does not block other page data). */
async function resolvePrintAgentDownloadStatusInner(): Promise<PrintAgentDownloadStatus> {
  const pinned = getPrintAgentVersion();
  if (pinned) {
    const releaseReady = await isPinnedPrintAgentReleaseAvailable('setup-amd64');
    const publishedFallback = !releaseReady ? await findLatestPublishedPrintAgentRelease() : null;
    return { version: pinned, releaseReady, publishedFallback };
  }

  const latest = await findLatestPublishedPrintAgentRelease();
  if (!latest) {
    return { version: '', releaseReady: false, publishedFallback: null };
  }
  return { version: latest.version, releaseReady: true, publishedFallback: null };
}

const GITHUB_STATUS_TIMEOUT_MS = 5000;

export async function resolvePrintAgentDownloadStatus(): Promise<PrintAgentDownloadStatus> {
  try {
    return await Promise.race([
      resolvePrintAgentDownloadStatusInner(),
      new Promise<PrintAgentDownloadStatus>((resolve) => {
        setTimeout(
          () => resolve({ version: '', releaseReady: true, publishedFallback: null }),
          GITHUB_STATUS_TIMEOUT_MS,
        );
      }),
    ]);
  } catch {
    return { version: '', releaseReady: true, publishedFallback: null };
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
    ? `https://github.com/${repo}/releases/tag/${RELEASE_TAG_PREFIX}${version}`
    : `https://github.com/${repo}/releases`;

  return {
    setupAmd64: PRINT_AGENT_DOWNLOAD_API_PATHS.setupAmd64,
    zipAmd64: PRINT_AGENT_DOWNLOAD_API_PATHS.portableAmd64,
    releasesPage,
  };
}
