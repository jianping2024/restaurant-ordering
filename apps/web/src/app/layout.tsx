import type { Metadata } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import { PRODUCT_SITE_DESCRIPTION_ZH, PRODUCT_SITE_TITLE } from '@mesa/shared';
import "./globals.css";
import { LanguageProvider } from '@/components/providers/LanguageProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { ToastContainer } from '@/components/ui/Toast';
import { getServerLanguage } from '@/lib/i18n.server';
import type { UILanguage } from '@/lib/i18n';

const HTML_LANG_BY_UI: Record<UILanguage, string> = {
  zh: 'zh-Hans',
  en: 'en',
  pt: 'pt',
};

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-cormorant",
  display: "swap",
});

const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-jost",
  display: "swap",
});

export const metadata: Metadata = {
  title: PRODUCT_SITE_TITLE,
  description: PRODUCT_SITE_DESCRIPTION_ZH,
};

const themeInitScript = `
(() => {
  const key = 'mesa-theme';
  const fallback = 'light';
  let theme = fallback;
  try {
    const saved = localStorage.getItem(key);
    if (saved === 'dark' || saved === 'light') theme = saved;
  } catch {}
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialLang = getServerLanguage();
  const htmlLang = HTML_LANG_BY_UI[initialLang];

  return (
    <html lang={htmlLang} className={`${cormorant.variable} ${jost.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased bg-brand-bg text-brand-text font-body">
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
