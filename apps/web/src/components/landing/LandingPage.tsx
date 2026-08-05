'use client';

import { LandingBuffetFeatures } from '@/components/landing/LandingBuffetFeatures';
import { LandingCaseStudy } from '@/components/landing/LandingCaseStudy';
import { LandingContact } from '@/components/landing/LandingContact';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingNav } from '@/components/landing/LandingNav';
import { LandingPainPoints } from '@/components/landing/LandingPainPoints';
import { LandingPillars } from '@/components/landing/LandingPillars';
import { LandingProductPreview } from '@/components/landing/LandingProductPreview';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-brand-bg">
      <LandingNav />
      <main>
        <LandingHero />
        <LandingPillars />
        <LandingPainPoints />
        <LandingBuffetFeatures />
        <LandingProductPreview />
        <LandingCaseStudy />
        <LandingContact />
      </main>
      <LandingFooter />
    </div>
  );
}
