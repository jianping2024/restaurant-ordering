/** Sole guest order-gate hint strip (classic + sushi). Not a second notice channel. */
export function CustomerMenuOrderGateBanner({ message }: { message: string }) {
  return (
    <div className="mx-4 mt-2 rounded-lg border border-brand-ink/25 bg-brand-ink/5 px-3 py-2 text-[13px] leading-snug text-brand-text">
      {message}
    </div>
  );
}
