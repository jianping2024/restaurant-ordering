import React, { createContext, useContext } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { colors, fonts } from "../theme";

export const v3Assets = {
  plateTablets: staticFile("images/v3/01-tablet-wall.png"),
  plateScan: staticFile("images/v3/02-phone-scan.png"),
  plateOffline: staticFile("images/v3/03-offline-chaos.png"),
  plateStaffPhone: staticFile("images/v3/05-staff-phone.png"),
  plateGuestPhone: staticFile("images/v3/06-guest-phone.png"),
  hallA: staticFile("video/pirata-hall-a.mp4"),
  hallB: staticFile("video/pirata-hall-b.mp4"),
  bgm: staticFile("audio/bgm-music-candidate.mp3"),
  whoosh: staticFile("audio/whoosh.wav"),
  vo1: staticFile("audio/v3/v3-01-cost.mp3"),
  vo2: staticFile("audio/v3/v3-02-offline.mp3"),
  vo3: staticFile("audio/v3/v3-03-roles.mp3"),
  vo4: staticFile("audio/v3/v3-04-guestnet.mp3"),
  vo5: staticFile("audio/v3/v3-05-devices.mp3"),
  vo6: staticFile("audio/v3/v3-06-prices.mp3"),
  vo7: staticFile("audio/v3/v3-07-history.mp3"),
  voProof: staticFile("audio/v3/v3-08-proof.mp3"),
  vo8: staticFile("audio/v3/v3-09-end.mp3"),
  voAgent: staticFile("audio/v3/v3-10-agent.mp3"),
  flowBoardIdle: staticFile("ui/flow/01-board-idle.png"),
  flowBoardOpen: staticFile("ui/flow/04-board-open.png"),
  flowOpenDialog: staticFile("ui/flow/02-open-dialog.png"),
  flowDash: staticFile("ui/flow/05-dashboard.png"),
  flowMenuHome: staticFile("ui/flow/10-menu-home.png"),
  flowMenuDrinks: staticFile("ui/flow/11-menu-drinks.png"),
  flowMenuAdded: staticFile("ui/flow/12-menu-added.png"),
  flowSettingsHub: staticFile("ui/flow/06-settings-hub.png"),
  flowBuffetHub: staticFile("ui/flow/20-buffet-hub.png"),
  flowOrderHistory: staticFile("ui/flow/30-order-history.png"),
  flowOrderHistoryDetail: staticFile("ui/flow/31-order-history-detail.png"),
  proofP1: staticFile("images/proof/p1.jpg"),
  proofP2: staticFile("images/proof/p2.jpg"),
  proofP3: staticFile("images/proof/p3.jpg"),
  proofM1: staticFile("video/proof-m1-clip.mp4"),
  proofM2: staticFile("video/proof-m2-clip.mp4"),
  uiBuffetSlots: staticFile("ui/buffet-slots.png"),
  uiBuffet: staticFile("ui/buffet-prices-mobile.png"),
  uiBoard: staticFile("ui/board-mobile.png"),
  uiBoardDesktop: staticFile("ui/board-desktop.png"),
  uiDashDesktop: staticFile("ui/dashboard-desktop.png"),
  uiDashMobile: staticFile("ui/dashboard-mobile.png"),
  fallbackBusy: staticFile("images/scene-busy-restaurant.png"),
  fallbackPhone: staticFile("images/scene-phone-menu.png"),
  fallbackScan: staticFile("images/scene-scan-qr.png"),
  fallbackOwner: staticFile("images/scene-owner-phone.png"),
};

/** Top portion of mobile screenshot to scale into the phone frame (hides same-color bottom padding). */
export function phoneFillRatioForSrc(src: string): number {
  if (
    src.includes("10-menu") ||
    src.includes("11-menu") ||
    src.includes("12-menu")
  ) {
    return 0.41;
  }
  if (src.includes("buffet-prices")) return 0.52;
  if (src.includes("board-mobile")) return 0.68;
  if (src.includes("board-open") || src.includes("board-idle")) return 0.68;
  if (src.includes("31-order-history-detail")) return 0.7;
  if (src.includes("30-order-history")) return 0.85;
  if (src.includes("order-history")) return 0.7;
  return 0.92;
}

export function phoneTopFillStyle(fillRatio: number): React.CSSProperties {
  const ratio = Math.min(0.98, Math.max(0.35, fillRatio));
  return {
    width: "100%",
    height: `${100 / ratio}%`,
    marginTop: 0,
    objectFit: "cover",
    objectPosition: "top center",
  };
}

/** Soft fog so product UI reads as real, but text/prices stay unreadable. */
export const UI_PRIVACY_BLUR_PX = 4.5;

/** When false, product screenshots render sharp (clear export). Default true. */
export const UiPrivacyContext = createContext(true);

export function useUiPrivacyEnabled(): boolean {
  return useContext(UiPrivacyContext);
}

export function isProductUiSrc(src: string): boolean {
  return /\/ui\/|ui%2F|flow\/|buffet-|board-|dashboard-|menu-/.test(src);
}

export function uiPrivacyFilter(extra?: string): string {
  const base = `blur(${UI_PRIVACY_BLUR_PX}px) saturate(0.88) contrast(0.96) brightness(1.04)`;
  return extra ? `${base} ${extra}` : base;
}

/** Mist veil on top of blurred screenshots (labels stay crisp above this). */
export const UiPrivacyFog: React.FC<{ intensity?: number }> = ({
  intensity = 1,
}) => {
  const enabled = useUiPrivacyEnabled();
  if (!enabled) return null;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        background: `linear-gradient(165deg,
        rgba(252,249,242,${0.22 * intensity}) 0%,
        rgba(236,232,224,${0.34 * intensity}) 45%,
        rgba(248,245,238,${0.26 * intensity}) 100%)`,
        boxShadow: "inset 0 0 60px rgba(255,255,255,0.18)",
      }}
    />
  );
};

/** Full-bleed left | right compare for 9:16 shorts */
export const VsSplit: React.FC<{
  leftSrc: string;
  rightSrc: string;
  leftLabel: string;
  rightLabel: string;
  leftBody: string;
  rightBody: string;
  delay?: number;
}> = ({
  leftSrc,
  rightSrc,
  leftLabel,
  rightLabel,
  leftBody,
  rightBody,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  // Never start at opacity 0 — frame 0 is the file thumbnail and looked like a black screen.
  const reveal = interpolate(frame, [delay, delay + 12], [0.45, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <AbsoluteFill style={{ opacity: reveal }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "row",
        }}
      >
        <Panel
          side="left"
          src={leftSrc}
          label={leftLabel}
          body={leftBody}
          tint="rgba(90,18,18,0.55)"
          badgeBg="rgba(60,24,24,0.94)"
          badgeColor={colors.danger}
          mark="✕"
        />
        <div
          style={{
            width: 4,
            background: `linear-gradient(180deg, transparent, ${colors.gold}, transparent)`,
          }}
        />
        <Panel
          side="right"
          src={rightSrc}
          label={rightLabel}
          body={rightBody}
          tint="rgba(12,40,28,0.5)"
          badgeBg="rgba(20,48,32,0.94)"
          badgeColor={colors.success}
          mark="✓"
        />
      </div>
    </AbsoluteFill>
  );
};

const Panel: React.FC<{
  side: "left" | "right";
  src: string;
  label: string;
  body: string;
  tint: string;
  badgeBg: string;
  badgeColor: string;
  mark: string;
}> = ({ src, label, body, tint, badgeBg, badgeColor, mark }) => {
  const privacy = useUiPrivacyEnabled();
  const uiShot = isProductUiSrc(src);
  const fogUi = privacy && uiShot;
  return (
  <div style={{ flexGrow: 1, position: "relative", overflow: "hidden" }}>
    <Img
      src={src}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: "center",
        filter: fogUi ? uiPrivacyFilter() : undefined,
        transform: fogUi ? "scale(1.06)" : undefined,
      }}
    />
    {fogUi ? <UiPrivacyFog intensity={0.85} /> : null}
    <div style={{ position: "absolute", inset: 0, backgroundColor: tint }} />
    <Interactive.Div
      name={`${mark} ${label}`}
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        top: 56,
        padding: "14px 14px",
        borderRadius: 14,
        backgroundColor: badgeBg,
        border: `1px solid ${badgeColor}66`,
      }}
    >
      <div
        style={{
          fontFamily: fonts.zh,
          fontSize: 22,
          fontWeight: 700,
          color: badgeColor,
          marginBottom: 6,
        }}
      >
        {mark} {label}
      </div>
      <div
        style={{
          fontFamily: fonts.zh,
          fontSize: 28,
          fontWeight: 800,
          color: colors.text,
          lineHeight: 1.35,
        }}
      >
        {body}
      </div>
    </Interactive.Div>
  </div>
  );
};

export const PhoneProof: React.FC<{
  src: string;
  delay?: number;
  label?: string;
  side?: "center" | "right";
  /** Top fraction of screenshot to fill the phone frame (auto from src when omitted). */
  fillRatio?: number;
}> = ({ src, delay = 4, label, side = "center", fillRatio }) => {
  const frame = useCurrentFrame();
  const privacy = useUiPrivacyEnabled();
  const imgStyle = phoneTopFillStyle(fillRatio ?? phoneFillRatioForSrc(src));
  const left =
    side === "right" ? "52%" : side === "center" ? "50%" : "50%";
  return (
    <Interactive.Div
      name={label || "Phone proof"}
      style={{
        position: "absolute",
        left,
        top: 220,
        width: 420,
        height: 860,
        marginLeft: side === "right" ? 0 : -210,
        borderRadius: 32,
        overflow: "hidden",
        border: `3px solid ${colors.gold}`,
        boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
        opacity: interpolate(frame, [delay, delay + 10], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        scale: interpolate(frame, [delay, delay + 12], [0.94, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          output: "perceptual-scale",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }),
      }}
    >
      <Img
        src={src}
        style={{
          ...imgStyle,
          filter: privacy ? uiPrivacyFilter() : undefined,
          transform: privacy ? "scale(1.08)" : undefined,
        }}
      />
      <UiPrivacyFog />
      {label ? (
        <div
          style={{
            position: "absolute",
            left: 12,
            top: 12,
            zIndex: 2,
            padding: "8px 12px",
            borderRadius: 999,
            backgroundColor: "rgba(15,14,12,0.88)",
            color: colors.goldLight,
            fontFamily: fonts.zh,
            fontSize: 22,
            fontWeight: 700,
          }}
        >
          {label}
        </div>
      ) : null}
    </Interactive.Div>
  );
};

export const BottomCaption: React.FC<{
  lines: string[];
  delay?: number;
}> = ({ lines, delay = 6 }) => {
  const frame = useCurrentFrame();
  return (
    <Interactive.Div
      name="Caption"
      style={{
        position: "absolute",
        left: 28,
        right: 28,
        bottom: 72,
        padding: "18px 20px",
        borderRadius: 16,
        backgroundColor: "rgba(15,14,12,0.9)",
        border: `1px solid rgba(212,168,67,0.4)`,
        opacity: interpolate(frame, [delay, delay + 8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    >
      {lines.map((line) => (
        <div
          key={line}
          style={{
            fontFamily: fonts.zh,
            fontSize: 34,
            fontWeight: 800,
            color: colors.text,
            textAlign: "center",
            lineHeight: 1.35,
          }}
        >
          {line}
        </div>
      ))}
    </Interactive.Div>
  );
};

export const BulletStack: React.FC<{
  items: string[];
  delay?: number;
  tone?: "good" | "bad";
  /** Frames between each bullet reveal (default 8 ≈ 0.27s — too fast for long copy). */
  stagger?: number;
}> = ({ items, delay = 10, tone = "good", stagger = 8 }) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: "absolute",
        left: 36,
        right: 36,
        top: 280,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {items.map((item, i) => {
        const t0 = delay + i * stagger;
        return (
          <Interactive.Div
            key={item}
            name={item}
            style={{
              padding: "14px 18px",
              borderRadius: 14,
              backgroundColor:
                tone === "good"
                  ? "rgba(20,48,32,0.92)"
                  : "rgba(60,24,24,0.92)",
              border:
                tone === "good"
                  ? "1px solid rgba(34,197,94,0.4)"
                  : "1px solid rgba(239,68,68,0.4)",
              opacity: interpolate(frame, [t0, t0 + 10], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: interpolate(frame, [t0, t0 + 10], ["0px 12px", "0px 0px"], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              fontFamily: fonts.zh,
              fontSize: 30,
              fontWeight: 700,
              color: colors.text,
            }}
          >
            {tone === "good" ? "✓ " : "✕ "}
            {item}
          </Interactive.Div>
        );
      })}
    </div>
  );
};
