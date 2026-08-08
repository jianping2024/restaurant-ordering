import localFont from 'next/font/local';

/**
 * Sole loader for euro amount face (full Cormorant with onum).
 * Root layout mounts `variable`; `.mesa-money` consumes `--font-mesa-money`.
 * Do not add a parallel `@font-face` for this family in globals.css.
 */
export const mesaMoneyFont = localFont({
  src: [
    {
      path: '../../public/fonts/CormorantGaramond-Variable.ttf',
      weight: '300 700',
      style: 'normal',
    },
  ],
  variable: '--font-mesa-money',
  display: 'optional',
  preload: true,
  adjustFontFallback: true,
});
