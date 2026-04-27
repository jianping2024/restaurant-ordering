'use client';

import Link from 'next/link';
import { useLanguage } from '@/components/providers/LanguageProvider';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { getMessages } from '@/lib/i18n/messages';

// 产品落地页
export default function LandingPage() {
  const { lang } = useLanguage();
  const dict = getMessages(lang).landing;
  const features = dict.features;

  return (
    <div className="min-h-screen bg-brand-bg">
      {/* 导航栏 */}
      <nav className="border-b border-brand-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 min-h-16 py-2 flex items-center justify-between gap-2">
          <span className="font-heading text-xl sm:text-2xl text-brand-gold tracking-wider">Mesa</span>
          <div className="flex items-center gap-2 sm:gap-4">
            <LanguageSwitcher compact />
            <Link
              href="/auth/login"
              className="text-brand-text-muted hover:text-brand-text text-[13px] sm:text-sm transition-colors whitespace-nowrap"
            >
              {dict.login}
            </Link>
            <Link
              href="/auth/login"
              className="bg-brand-gold text-brand-bg px-3 sm:px-5 py-2 rounded-lg text-[13px] sm:text-sm font-semibold hover:bg-brand-gold-light transition-colors whitespace-nowrap flex-shrink-0"
            >
              {dict.ownerCta}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
        <p className="text-brand-gold text-[13px] sm:text-sm font-medium tracking-widest uppercase mb-4 sm:mb-6">
          {dict.heroTag}
        </p>
        <h1 className="font-heading text-4xl sm:text-5xl md:text-7xl text-brand-text leading-tight mb-4 sm:mb-6">
          {dict.heroTitleA}<br />
          <span className="text-gold-gradient">{dict.heroTitleB}</span>
        </h1>
        <p className="text-brand-text-muted text-base sm:text-lg max-w-xl mx-auto mb-8 sm:mb-10 leading-relaxed">
          {dict.heroDesc}
        </p>
        <div className="flex items-stretch justify-center gap-3 sm:gap-4 flex-col sm:flex-row">
          <div className="flex flex-col items-center gap-1.5 w-full sm:w-auto">
            <Link
              href="/auth/login"
              className="w-full sm:w-auto bg-brand-gold text-brand-bg px-8 py-3.5 sm:py-4 rounded-xl text-[15px] sm:text-base font-semibold hover:bg-brand-gold-light transition-colors"
            >
              {dict.ownerCta}
            </Link>
            <span className="text-brand-text-muted text-[13px]">{dict.ownerCtaDesc}</span>
          </div>
          <div className="flex flex-col items-center gap-1.5 w-full sm:w-auto">
            <Link
              href="/demo"
              className="w-full sm:w-auto border border-brand-border text-brand-text px-8 py-3.5 sm:py-4 rounded-xl text-[15px] sm:text-base hover:border-brand-gold/50 transition-colors"
            >
              {dict.demo}
            </Link>
            <span className="text-brand-text-muted text-[13px]">{dict.demoTip}</span>
          </div>
        </div>
      </section>

      {/* 功能特性 */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-16">
        <h2 className="font-heading text-2xl sm:text-3xl text-center text-brand-text mb-8 sm:mb-12">
          {dict.why} <span className="text-brand-gold">Mesa</span>?
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-brand-card border border-brand-border rounded-2xl p-5 sm:p-6 card-hover"
            >
              <span className="text-3xl sm:text-4xl mb-3 sm:mb-4 block">{f.emoji}</span>
              <h3 className="font-heading text-lg sm:text-xl text-brand-gold mb-2">{f.title}</h3>
              <p className="text-brand-text-muted text-[15px] sm:text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-brand-border py-14 sm:py-20 text-center px-4">
        <h2 className="font-heading text-3xl sm:text-4xl text-brand-text mb-3 sm:mb-4">
          {dict.ready}
        </h2>
        <p className="text-brand-text-muted text-[15px] sm:text-base mb-6 sm:mb-8">{dict.readyDesc}</p>
        <Link
          href="/auth/login"
          className="inline-block w-full max-w-xs sm:w-auto bg-brand-gold text-brand-bg px-10 py-3.5 sm:py-4 rounded-xl text-[15px] sm:text-base font-semibold hover:bg-brand-gold-light transition-colors"
        >
          {dict.readyBtn}
        </Link>
      </section>

      <footer className="border-t border-brand-border py-8 text-center text-brand-muted text-sm">
        © 2024 Mesa · {dict.copyright}
      </footer>
    </div>
  );
}
