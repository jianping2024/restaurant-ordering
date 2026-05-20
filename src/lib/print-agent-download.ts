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
  if (!repo || repo.includes('..') || repo.startsWith('/')) return null;
  const base = `https://github.com/${repo}/releases/latest/download`;
  return {
    setupAmd64: `${base}/MesaPrintAgent-Setup-amd64.exe`,
    setupArm64: `${base}/MesaPrintAgent-Setup-arm64.exe`,
    zipAmd64: `${base}/MesaPrintAgent-windows-amd64.zip`,
    zipArm64: `${base}/MesaPrintAgent-windows-arm64.zip`,
    releasesPage: `https://github.com/${repo}/releases`,
  };
}
