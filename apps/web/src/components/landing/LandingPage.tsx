'use client';

import { LandingCaseStudy } from '@/components/landing/LandingCaseStudy';
import { LandingContact } from '@/components/landing/LandingContact';
import { LandingFeatures } from '@/components/landing/LandingFeatures';
import { LandingFlow } from '@/components/landing/LandingFlow';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingMobileCta } from '@/components/landing/LandingMobileCta';
import { LandingNav } from '@/components/landing/LandingNav';
import { LandingPainPoints } from '@/components/landing/LandingPainPoints';
import { LandingTeam } from '@/components/landing/LandingTeam';
import { LandingTrustStrip } from '@/components/landing/LandingTrustStrip';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-brand-bg pb-[68px] md:pb-0">
      <LandingNav />
      <main>
        <LandingHero />
        <LandingTrustStrip />
        <LandingPainPoints />
        <LandingFlow />
        <LandingFeatures />
        <LandingTeam />
        <LandingCaseStudy />
        <LandingContact />
      </main>
      <LandingFooter />
      <LandingMobileCta />
    </div>
  );
}
