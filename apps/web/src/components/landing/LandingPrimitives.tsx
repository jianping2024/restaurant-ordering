import type { ReactNode } from 'react';
import Link from 'next/link';
import { LANDING_WHATSAPP_URL } from '@/lib/landing/contact';

type LandingExternalLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
};

export function LandingExternalLink({ href, children, className = '' }: LandingExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  );
}

type LandingButtonVariant = 'primary' | 'secondary' | 'ghost';

const BUTTON_CLASS: Record<LandingButtonVariant, string> = {
  primary:
    'bg-brand-gold text-brand-on-gold hover:bg-brand-gold-light font-semibold',
  secondary:
    'border border-brand-border text-brand-text hover:border-brand-gold/50',
  ghost: 'text-brand-text-muted hover:text-brand-gold',
};

type LandingButtonProps = {
  href: string;
  children: ReactNode;
  variant?: LandingButtonVariant;
  className?: string;
  external?: boolean;
};

export function LandingButton({
  href,
  children,
  variant = 'primary',
  className = '',
  external = false,
}: LandingButtonProps) {
  const classes = `inline-flex items-center justify-center rounded-xl px-6 py-3.5 text-[15px] transition-colors ${BUTTON_CLASS[variant]} ${className}`;

  if (external) {
    return (
      <LandingExternalLink href={href} className={classes}>
        {children}
      </LandingExternalLink>
    );
  }

  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}

export function LandingWhatsAppButton({
  children,
  variant = 'primary',
  className = '',
  href = LANDING_WHATSAPP_URL,
}: {
  children: ReactNode;
  variant?: LandingButtonVariant;
  className?: string;
  href?: string;
}) {
  return (
    <LandingButton href={href} variant={variant} className={className} external>
      {children}
    </LandingButton>
  );
}

export function LandingSection({
  id,
  children,
  className = '',
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={`scroll-mt-20 ${className}`.trim()}>
      {children}
    </section>
  );
}

export function LandingSectionHeader({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-10 grid gap-4 sm:mb-14 md:grid-cols-2 md:items-end md:gap-14">
      <div>
        <p className="inline-flex items-center gap-2.5 text-[12.5px] font-semibold uppercase tracking-[0.16em] text-brand-gold before:h-px before:w-[22px] before:bg-brand-gold before:content-['']">
          {kicker}
        </p>
        <h2 className="mt-3.5 whitespace-pre-line font-heading text-[clamp(1.7rem,3.1vw,2.5rem)] font-bold leading-[1.28] tracking-tight text-brand-text">
          {title}
        </h2>
      </div>
      {subtitle ? (
        <p className="text-base leading-relaxed text-brand-text-muted sm:text-[17px]">{subtitle}</p>
      ) : null}
    </div>
  );
}
