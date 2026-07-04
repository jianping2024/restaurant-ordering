import Image from 'next/image';

type Props = {
  className?: string;
};

const ASSET = '/illustrations/checkout-submitted-receipt.png';
const WIDTH = 192;
const HEIGHT = 173;

/** Post-checkout success hero — static design asset (transparent PNG). */
export function CheckoutSubmittedHeroIllustration({ className = 'h-[88px] w-auto' }: Props) {
  return (
    <Image
      src={ASSET}
      alt=""
      width={WIDTH}
      height={HEIGHT}
      className={className}
      aria-hidden
    />
  );
}
