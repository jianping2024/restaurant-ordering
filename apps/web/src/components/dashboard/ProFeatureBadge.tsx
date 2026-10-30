/** Sole inline "Pro" tag for Pro-gated controls inside a page (top nav keeps no Pro chrome). */
export function ProFeatureBadge({ label }: { label: string }) {
  return (
    <span className="rounded bg-brand-gold px-1.5 text-[10px] font-bold uppercase leading-4 text-brand-bg">
      {label}
    </span>
  );
}
