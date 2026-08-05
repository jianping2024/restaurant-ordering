---
name: buffet-promo-video
description: >-
  FARVOO / MesaGo buffet promo video workflow for marketing/mesago-ad.
  Use when editing MesaGoAdV2, capturing product UI for ads, generating
  voiceover, Higgsfield scene plates, Remotion timeline, or exporting
  buffet marketing shorts. Triggers: buffet promo, 宣传片, mesago-ad,
  FARVOO ad, 自助广告, MesaGoAdV2.
---

# Buffet promo video (FARVOO)

Project: `marketing/mesago-ad` · Compositions: `MesaGoAdV3` (≈77s 左右分屏；结尾预约演示 → 诚招代理，同联系方式) · `MesaGoAdV2` · Vertical 1080×1920 @ 30fps.

## Tool stack (do not invent a second pipeline)

| Role | Tool | Notes |
|------|------|--------|
| Timeline / animation / export | Remotion + Remotion Agent Skills | Edit in `src/`, render with `npm run render` |
| Product proof (real UI) | Playwright / Chrome DevTools / `scripts/capture-ad-flow.mjs` | Localhost product screenshots only — no mock chrome for proof shots |
| Scene plates (buffet / tablet / offline / rush) | Higgsfield MCP + skills | B-roll / atmosphere only; never replace product UI proof |
| Voice + SFX | ElevenLabs MCP (preferred) or Edge TTS fallback `scripts/generate-vo-v2.mjs` | ZH + PT narration |
| Mix / compress / QC | FFmpeg | Loudness, mux, format check |
| Brand layout (optional) | Figma MCP | Icons / frame specs |

## Brand pillars (exactly four — keep on-screen copy aligned)

**经济 · 安全 · 稳定 · 便捷**

Do not invent a fifth pillar. Product proof and VO must map to these.

## Seven selling beats (storyboard truth)

Aligned with `src/MesaGoAdV2.tsx` + `scripts/generate-vo-v2.mjs`:

1. **经济 — tablet cost** — one tablet ≈ €400 (pain open)
2. **经济 — fleet cost** — 100 tables ≈ €40,000+ wall of tablets
3. **便捷 — guest phone** — scan / 三语菜单 / drinks to bar (real UI click-flow)
4. **稳定 — on-prem** — data in-store; wan down, shop still runs
5. **安全 — open table** — staff confirms guests; QR only live after open
6. **便捷 — buffet schedule** — weekday/weekend/holiday prices auto-switch
7. **便捷 — phone ops + proof + CTA** — board/phone manage open→pay; live restaurants; demo CTA

Secondary lines allowed only as support for the above (e.g. “已落地 · 稳定使用中”).

## Hard product rules

- **No restaurant trade names** on screen (无店名).
- Contact CTA from `src/theme.ts` `defaultAdProps` (WhatsApp / 微信) — do not invent numbers.
- Product UI assets live under `public/ui/` and `public/ui/flow/` — regenerate via capture script, do not redraw fake dashboards for “proof”.
- Captions / VO stay Chinese-first for CN audience; PT VO is a parallel track, same beats.
- Prefer real capture over illustration for any claim that is “the system does X”.

## Workflow order

1. Read this skill + Remotion best-practices (if editing timeline).
2. Capture / refresh UI proof (`node scripts/capture-ad-flow.mjs` with local stack + UAT cookies).
3. Optional: Higgsfield plates for hall / rush / offline atmosphere → `public/images|video/`.
4. VO: ElevenLabs into `public/audio/` (or Edge TTS script) — one file per scene beat.
5. Wire sequences in `MesaGoAdV3` / `scenes/v3/` (split script) or `MesaGoAdV2` / `scenes/v2/`.
6. `npm run dev` preview → `npm run render` → FFmpeg loudness/size QC on `out/`.

## Commands

```bash
cd marketing/mesago-ad
npm run dev              # Studio → MesaGoAdV3
npm run render           # → out/mesago-ad-v3.mp4
npm run render:v2        # → out/mesago-ad-v2.mp4
node scripts/capture-ad-flow.mjs
npm run capture:pirata        # pirata.farvoo.com · qiantai · 简体中文
node scripts/generate-vo-v3.mjs   # Edge TTS for V3 split script
node scripts/generate-vo-v2.mjs   # Edge TTS for V2
```

## Anti-patterns

- Parallel mock UI that competes with captured screenshots for the same beat.
- Polling / fake “live metrics” overlays that are not in product.
- Purple-glow SaaS stock look — keep `theme.ts` gold/dark palette.
- Expanding scope into kitchen/print deep-dives unless Will asks.
