/** Sole guest fullscreen notice chrome (maintenance + geo access). */
export function CustomerFullscreenNotice({
  title,
  body,
  detail,
}: {
  title: string;
  body: string;
  detail?: string | null;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-bg p-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-brand-fg">{title}</h1>
        <p className="mt-4 text-brand-muted">{body}</p>
        {detail ? <p className="mt-3 text-sm text-brand-muted/80">{detail}</p> : null}
      </div>
    </div>
  );
}
