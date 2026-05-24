import { NextResponse } from 'next/server';
import {
  isPrintAgentDownloadArtifact,
  resolvePrintAgentGitHubDownloadUrl,
} from '@/lib/print-agent-download';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: { artifact: string } },
) {
  const artifact = params.artifact;
  if (!isPrintAgentDownloadArtifact(artifact)) {
    return NextResponse.json({ error: 'unknown_artifact' }, { status: 404 });
  }

  const target = await resolvePrintAgentGitHubDownloadUrl(artifact);
  if (!target) {
    return NextResponse.json({ error: 'download_unavailable' }, { status: 503 });
  }

  return NextResponse.redirect(target, 302);
}
