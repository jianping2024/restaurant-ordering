type Props = {
  className?: string;
};

const STROKE = 1.75;

function Sparkle({ cx, cy }: { cx: number; cy: number }) {
  return (
    <path
      d={`M${cx} ${cy - 4} ${cx + 1.1} ${cy - 1.2} ${cx + 4} ${cy - 1.2} ${cx + 1.6} ${cy + 0.8} ${cx + 2.6} ${cy + 3.6} ${cx} ${cy + 2.1} ${cx - 2.6} ${cy + 3.6} ${cx - 1.6} ${cy + 0.8} ${cx - 4} ${cy - 1.2} ${cx - 1.1} ${cy - 1.2}Z`}
      fill="currentColor"
    />
  );
}

function ReceiptLineRow({ y }: { y: number }) {
  return (
    <>
      <line x1="40" y1={y} x2="56" y2={y} stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" />
      <line x1="60" y1={y} x2="66" y2={y} stroke="currentColor" strokeWidth={STROKE} strokeLinecap="round" />
    </>
  );
}

/** Brand receipt line art for post-checkout success hero (matches design asset). */
export function CheckoutSubmittedHeroIllustration({
  className = 'h-[88px] w-[112px] text-brand-gold',
}: Props) {
  return (
    <svg
      viewBox="0 0 112 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <Sparkle cx={16} cy={44} />
      <Sparkle cx={98} cy={68} />

      <path
        d="M72 16h8v8h-8"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />

      <path
        d="M36 86l3 3-3 3 3 3-3 3 3 3h36l3-3-3-3 3-3-3-3 3-3V22c0-5 3-8 8-8h20c5 0 8 3 8 8"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinejoin="round"
      />

      <text
        x="54"
        y="40"
        textAnchor="middle"
        fill="currentColor"
        fontSize="14"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="600"
      >
        €
      </text>

      <ReceiptLineRow y={48} />
      <ReceiptLineRow y={54} />
      <ReceiptLineRow y={60} />
      <ReceiptLineRow y={66} />
    </svg>
  );
}
