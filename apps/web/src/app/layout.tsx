import type { Metadata, Viewport } from "next";
import { Jost } from "next/font/google";
import { PRODUCT_NAME, PRODUCT_SITE_DESCRIPTION_ZH, PRODUCT_SITE_TITLE } from '@mesa/shared';
import { PWA_ICON_PATHS, PWA_THEME_COLOR } from '@/lib/pwa/site-manifest';
import {
  PWA_LAUNCH_SHELL_ID,
  PWA_LAUNCH_MARK_PX,
  buildPwaLaunchShellBootScript,
  buildPwaLaunchShellStyle,
} from '@/lib/pwa/launch-shell';
import "./globals.css";
import { LanguageProvider } from '@/components/providers/LanguageProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { ToastContainer } from '@/components/ui/Toast';
import { getServerLanguage } from '@/lib/i18n.server';
import { HTML_LANG_BY_UI } from '@/lib/i18n';
import { buildThemeInitScript } from '@/lib/theme';

/**
 * Sole next/font writer: --font-jost (product body face).
 * heading / .mesa-money / .mesa-status-vertical all consume this + --font-cjk-sans.
 * Do not redeclare --font-jost in globals.css (literal override leaves next/font unloaded).
 */
const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-jost",
  display: "swap",
});

export const metadata: Metadata = {
  title: PRODUCT_SITE_TITLE,
  description: PRODUCT_SITE_DESCRIPTION_ZH,
  applicationName: PRODUCT_NAME,
  appleWebApp: {
    capable: true,
    title: PRODUCT_NAME,
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: PWA_THEME_COLOR,
};

const themeInitScript = buildThemeInitScript();
const pwaLaunchShellStyle = buildPwaLaunchShellStyle();
const pwaLaunchShellBootScript = buildPwaLaunchShellBootScript();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialLang = getServerLanguage();
  const htmlLang = HTML_LANG_BY_UI[initialLang];

  return (
    <html
      lang={htmlLang}
      className={jost.variable}
      suppressHydrationWarning
    >
      <body className="antialiased bg-brand-bg text-brand-text font-body">
        {/* Early paint: launch CSS/boot before providers (no manual <head> — App Router owns head). */}
        <style dangerouslySetInnerHTML={{ __html: pwaLaunchShellStyle }} />
        <script dangerouslySetInnerHTML={{ __html: pwaLaunchShellBootScript }} />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <div id={PWA_LAUNCH_SHELL_ID} aria-hidden="true">
          {/* Raw img: cold-start mark must paint without next/image runtime. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={PWA_ICON_PATHS.any192}
            alt=""
            width={PWA_LAUNCH_MARK_PX}
            height={PWA_LAUNCH_MARK_PX}
            decoding="async"
          />
        </div>
        <ThemeProvider>
          <LanguageProvider initialLang={initialLang}>
            {children}
            <ToastContainer />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
