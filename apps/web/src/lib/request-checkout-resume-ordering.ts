export async function requestCheckoutResumeOrdering(params: {
  slug: string;
  tableId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { slug, tableId } = params;
  try {
    const res = await fetch(
      `/api/restaurants/${encodeURIComponent(slug)}/checkout/resume-ordering`,
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_id: tableId }),
      },
    );
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok) {
      return { ok: false, error: data.error || 'resume_failed' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'network_error' };
  }
}
