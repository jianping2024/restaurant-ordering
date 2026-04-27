import type { Metadata } from "next";
import { Cormorant_Garamond, Jost } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from '@/components/providers/LanguageProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { getServerUILanguageBootstrap } from '@/lib/i18n.server';
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
  title: "Mesa — 葡萄牙餐厅点餐系统",
  description: "多租户餐厅 SaaS，支持扫码点餐、实时厨房显示、智能分单",
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { initialLang, languageCookiePresent } = await getServerUILanguageBootstrap();
  const htmlLang = HTML_LANG_BY_UI[initialLang];

  return (
    <html lang={htmlLang} className={`${cormorant.variable} ${jost.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased bg-brand-bg text-brand-text font-body">
        <ThemeProvider>
          <LanguageProvider
            initialLang={initialLang}
            languageCookiePresent={languageCookiePresent}
          >
            {children}
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
