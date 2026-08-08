'use client';

import { ProductLogo } from '@/components/ui/ProductLogo';
import { LanguageSwitcherIconChrome } from '@/components/ui/LanguageSwitcher';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { AuthIconTextRow } from '@/components/auth/AuthIconTextRow';
import { AuthShieldIcon } from '@/components/auth/auth-icons';
import {
  AUTH_SHELL_VARIANTS,
  type AuthShellCopy,
  type AuthShellVariant,
} from '@/components/auth/auth-shell-variants';
import { PRODUCT_NAME } from '@mesa/shared';

type Props = {
  variant: AuthShellVariant;
  copy: AuthShellCopy;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

function ShellSecurityNote({ text }: { text: string }) {
  return (
    <div className="mt-3 flex justify-center md:mt-4">
      <AuthIconTextRow
        icon={AuthShieldIcon}
        iconClassName="w-4 h-4 shrink-0 text-brand-gold mt-0.5"
        className="flex items-start gap-2 max-w-full"
      >
        <p className="text-brand-text-muted text-[12px] leading-relaxed md:text-xs">{text}</p>
      </AuthIconTextRow>
    </div>
  );
}

function AuthBrandMark() {
  return (
    <div className="mb-4 flex flex-col items-center md:mb-5" aria-label={PRODUCT_NAME}>
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl border-[1.5px] border-brand-gold font-heading text-[22px] leading-none text-brand-gold md:h-11 md:w-11 md:text-2xl"
        aria-hidden
      >
        F
      </div>
      <ProductLogo size="md" className="mt-2.5 tracking-[0.16em] md:mt-3" />
      <div className="mt-2.5 flex items-center gap-2 md:mt-3" aria-hidden>
        <span className="block h-px w-8 bg-brand-gold md:w-9" />
        <i className="block h-1.5 w-1.5 rotate-45 border border-brand-gold" />
        <span className="block h-px w-8 bg-brand-gold md:w-9" />
      </div>
    </div>
  );
}

function AppearanceChrome({ className }: { className?: string }) {
  return (
    <div className={className ?? 'mb-4 flex items-center justify-end gap-2'}>
      <ThemeToggle />
      <LanguageSwitcherIconChrome />
    </div>
  );
}

function TitleBlock({
  copy,
  align,
}: {
  copy: AuthShellCopy;
  align: 'center' | 'start';
}) {
  const alignClass =
    align === 'center' ? 'text-center' : 'text-center min-[821px]:text-left';
  return (
    <div className={`mb-5 min-[821px]:mb-5 ${alignClass}`}>
      <h1
        id="auth-login-title"
        className="font-heading text-[2rem] leading-tight text-brand-text min-h-[2.25rem] min-[821px]:text-[2.35rem] lg:text-[2.75rem]"
      >
        {copy.title}
      </h1>
      {copy.subtitle ? (
        <p className="mt-2 text-[15px] text-brand-text-muted min-[821px]:text-[15px]">{copy.subtitle}</p>
      ) : null}
      {copy.contextLine ? (
        <p className="mt-2 text-sm font-medium text-brand-text">{copy.contextLine}</p>
      ) : null}
    </div>
  );
}

function FoodHeroPanel({ hero }: { hero: NonNullable<AuthShellCopy['hero']> }) {
  return (
    <aside
      className="relative order-first mx-3.5 mt-3.5 h-[24vh] min-h-[185px] max-h-[235px] overflow-hidden rounded-[20px] bg-[#211a13] max-[460px]:h-[24vh] min-[461px]:max-[820px]:h-[30vh] min-[461px]:max-[820px]:max-h-[300px] min-[461px]:max-[820px]:rounded-3xl min-[821px]:order-none min-[821px]:mx-0 min-[821px]:mt-0 min-[821px]:h-auto min-[821px]:min-h-dvh min-[821px]:max-h-none min-[821px]:rounded-none"
      aria-label={hero.headline}
    >
      <picture className="absolute inset-0 block h-full w-full">
        <source media="(max-width: 820px)" srcSet="/auth/food-hero-640.webp" />
        <img
          src="/auth/food-hero.webp"
          alt=""
          width={1100}
          height={1180}
          decoding="async"
          fetchPriority="high"
          className="h-full w-full object-cover object-center"
        />
      </picture>
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/10 to-black/60 min-[821px]:bg-[linear-gradient(180deg,rgba(0,0,0,.06)_0%,rgba(0,0,0,.08)_50%,rgba(0,0,0,.58)_100%),linear-gradient(90deg,rgba(0,0,0,.08),transparent_35%)]"
        aria-hidden
      />
      <div className="absolute bottom-7 left-7 right-9 hidden text-white drop-shadow-[0_2px_14px_rgba(0,0,0,.35)] min-[821px]:bottom-8 min-[821px]:left-11 min-[821px]:right-9 min-[821px]:block lg:bottom-12 lg:left-[4.5rem]">
        <span className="mb-2.5 block text-[11px] tracking-[0.18em] text-[#f6d79f] min-[821px]:text-xs">
          {hero.eyebrow}
        </span>
        <strong className="font-heading text-[1.75rem] font-semibold leading-tight min-[821px]:text-[2rem] lg:text-[2.6rem]">
          {hero.headline}
        </strong>
        <p className="mt-2.5 max-w-md text-[14px] leading-relaxed text-white/85 min-[821px]:mt-3.5 min-[821px]:text-[15px]">
          {hero.body}
        </p>
      </div>
    </aside>
  );
}

function SplitLoginShell({
  copy,
  toolbar,
  footer,
  showAppearanceChrome,
  children,
}: {
  copy: AuthShellCopy;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  showAppearanceChrome: boolean;
  children: React.ReactNode;
}) {
  return (
    <main className="grid min-h-dvh grid-cols-1 overflow-hidden bg-brand-card min-[821px]:grid-cols-[minmax(520px,46%)_minmax(0,54%)]">
      <section
        className="relative flex min-h-0 flex-col justify-start px-[18px] pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-7 sm:px-[22px] min-[821px]:justify-center min-[821px]:overflow-auto min-[821px]:px-[clamp(3.25rem,5.6vw,5.75rem)] min-[821px]:py-[1.875rem]"
        aria-labelledby="auth-login-title"
        style={{
          backgroundImage:
            'radial-gradient(circle at 16% 18%, rgb(var(--color-brand-gold) / 0.08), transparent 32%)',
        }}
      >
        {showAppearanceChrome ? (
          <AppearanceChrome className="absolute right-[18px] top-[18px] z-10 flex items-center gap-2 min-[821px]:right-6 min-[821px]:top-[18px]" />
        ) : null}

        <div className="mx-auto w-full max-w-md min-[821px]:mx-0 min-[821px]:max-w-none">
          <AuthBrandMark />
          <TitleBlock copy={copy} align="start" />
          {toolbar ? <div className="mb-4">{toolbar}</div> : null}
          {children}
          {copy.securityNote ? <ShellSecurityNote text={copy.securityNote} /> : null}
          {footer ? <div className="mt-4">{footer}</div> : null}
        </div>
      </section>

      {copy.hero ? <FoodHeroPanel hero={copy.hero} /> : (
        <div className="hidden bg-brand-ink min-[821px]:block" aria-hidden />
      )}
    </main>
  );
}

function CardAuthShell({
  copy,
  toolbar,
  footer,
  showAppearanceChrome,
  children,
}: {
  copy: AuthShellCopy;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  showAppearanceChrome: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mesa-auth-bg flex min-h-screen flex-col items-center justify-center p-4">
      <div className="relative z-[1] w-full max-w-lg">
        {showAppearanceChrome ? <AppearanceChrome /> : null}

        <div className="rounded-2xl border border-brand-gold/25 bg-brand-card p-8 shadow-lg shadow-black/5">
          {toolbar ? <div className="mb-4">{toolbar}</div> : null}
          <div className="mb-6 text-center">
            <div className="mb-4 flex justify-center">
              <ProductLogo size="md" />
            </div>
            <h1 className="mb-2 min-h-[2.25rem] font-heading text-3xl text-brand-gold">{copy.title}</h1>
            {copy.subtitle ? <p className="text-sm text-brand-text-muted">{copy.subtitle}</p> : null}
            {copy.contextLine ? (
              <p className="mt-2 text-sm font-medium text-brand-text">{copy.contextLine}</p>
            ) : null}
          </div>
          {children}
          {copy.securityNote ? <ShellSecurityNote text={copy.securityNote} /> : null}
          {footer ? <div className="mt-4">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function AuthPageShell({ variant, copy, toolbar, footer, children }: Props) {
  const { layout, showAppearanceChrome } = AUTH_SHELL_VARIANTS[variant];

  if (layout === 'split') {
    return (
      <SplitLoginShell
        copy={copy}
        toolbar={toolbar}
        footer={footer}
        showAppearanceChrome={showAppearanceChrome}
      >
        {children}
      </SplitLoginShell>
    );
  }

  return (
    <CardAuthShell
      copy={copy}
      toolbar={toolbar}
      footer={footer}
      showAppearanceChrome={showAppearanceChrome}
    >
      {children}
    </CardAuthShell>
  );
}
