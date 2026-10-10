/**
 * Sole press-relief tokens for clickable controls.
 * Strong = primary CTA (`Button` gold); soft = other Button variants + pool CTAs;
 * compact = chips / icon-only (lighter ledge + small press).
 * Do not copy these shadow strings at call sites.
 */

export const buttonPressReliefStrongClass =
  'shadow-[0_5px_0_0_rgb(0_0_0/0.35),0_8px_16px_rgb(0_0_0/0.2),inset_0_1px_0_rgb(255_255_255/0.22),inset_0_-1px_0_rgb(0_0_0/0.2)] enabled:active:translate-y-[4px] enabled:active:shadow-[0_0_0_0_rgb(0_0_0/0),0_2px_4px_rgb(0_0_0/0.16),inset_0_5px_10px_rgb(0_0_0/0.45),inset_0_1px_0_rgb(0_0_0/0.25)] motion-reduce:enabled:active:translate-y-0';

export const buttonPressReliefSoftClass =
  'shadow-[0_3px_0_0_rgb(0_0_0/0.16),0_4px_10px_rgb(0_0_0/0.08),inset_0_1px_0_rgb(255_255_255/0.55),inset_0_-1px_0_rgb(0_0_0/0.06)] enabled:active:translate-y-[2px] enabled:active:shadow-[0_0_0_0_rgb(0_0_0/0),0_1px_3px_rgb(0_0_0/0.12),inset_0_3px_7px_rgb(0_0_0/0.18),inset_0_1px_0_rgb(0_0_0/0.08)] motion-reduce:enabled:active:translate-y-0';

export const buttonPressReliefCompactClass =
  'shadow-[0_2px_0_0_rgb(0_0_0/0.12),0_2px_6px_rgb(0_0_0/0.06),inset_0_1px_0_rgb(255_255_255/0.45)] enabled:active:translate-y-[1.5px] enabled:active:scale-[0.98] enabled:active:shadow-[0_0_0_0_rgb(0_0_0/0),0_1px_2px_rgb(0_0_0/0.1),inset_0_2px_5px_rgb(0_0_0/0.16)] motion-reduce:enabled:active:translate-y-0 motion-reduce:enabled:active:scale-100';
