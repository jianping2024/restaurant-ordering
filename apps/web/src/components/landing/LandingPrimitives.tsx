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
}: {
  children: ReactNode;
  variant?: LandingButtonVariant;
  className?: string;
}) {
  return (
    <LandingButton href={LANDING_WHATSAPP_URL} variant={variant} className={className} external>
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
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-8 text-center sm:mb-12">
      <h2 className="font-heading text-2xl text-brand-text sm:text-3xl">{title}</h2>
      {subtitle ? (
        <p className="mx-auto mt-3 max-w-2xl text-[15px] leading-relaxed text-brand-text-muted sm:text-base">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
