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
          <span className="font-heading text-2xl text-brand-gold tracking-wider">Mesa</span>
          <div className="flex items-center gap-2 sm:gap-4">
            <LanguageSwitcher compact />
            <Link
              href="/auth/login"
              className="text-brand-text-muted hover:text-brand-text text-sm transition-colors whitespace-nowrap"
            >
              {dict.login}
            </Link>
            <Link
              href="/auth/register"
              className="bg-brand-gold text-brand-bg px-3 sm:px-5 py-2 rounded-lg text-xs sm:text-sm font-semibold hover:bg-brand-gold-light transition-colors whitespace-nowrap flex-shrink-0"
            >
              {dict.register}
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 py-24 text-center">
        <p className="text-brand-gold text-sm font-medium tracking-widest uppercase mb-6">
          {dict.heroTag}
        </p>
        <h1 className="font-heading text-6xl md:text-7xl text-brand-text leading-tight mb-6">
          {dict.heroTitleA}<br />
          <span className="text-gold-gradient">{dict.heroTitleB}</span>
        </h1>
        <p className="text-brand-text-muted text-lg max-w-xl mx-auto mb-10 leading-relaxed">
          {dict.heroDesc}
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <div className="flex flex-col items-center gap-1.5">
            <Link
              href="/auth/register"
              className="bg-brand-gold text-brand-bg px-8 py-4 rounded-xl text-base font-semibold hover:bg-brand-gold-light transition-colors"
            >
              {dict.start}
            </Link>
            <span className="text-brand-text-muted text-xs">{dict.verifyTip}</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <Link
              href="/demo/menu"
              className="border border-brand-border text-brand-text px-8 py-4 rounded-xl text-base hover:border-brand-gold/50 transition-colors"
            >
              {dict.demo}
            </Link>
            <span className="text-brand-text-muted text-xs">{dict.demoTip}</span>
          </div>
        </div>
      </section>

      {/* 功能特性 */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="font-heading text-3xl text-center text-brand-text mb-12">
          {dict.why} <span className="text-brand-gold">Mesa</span>?
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-brand-card border border-brand-border rounded-2xl p-6 card-hover"
            >
              <span className="text-4xl mb-4 block">{f.emoji}</span>
              <h3 className="font-heading text-xl text-brand-gold mb-2">{f.title}</h3>
              <p className="text-brand-text-muted text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-brand-border py-20 text-center">
        <h2 className="font-heading text-4xl text-brand-text mb-4">
          {dict.ready}
        </h2>
        <p className="text-brand-text-muted mb-8">{dict.readyDesc}</p>
        <Link
          href="/auth/register"
          className="inline-block bg-brand-gold text-brand-bg px-10 py-4 rounded-xl text-base font-semibold hover:bg-brand-gold-light transition-colors"
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
