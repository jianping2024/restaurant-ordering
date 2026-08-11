import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { Video } from "@remotion/media";
import { colors, fonts } from "../theme";
import {
  phoneFillRatioForSrc,
  phoneTopFillStyle,
  UiPrivacyFog,
  uiPrivacyFilter,
  useUiPrivacyEnabled,
} from "./V3Visuals";

export const assets = {
  hallA: staticFile("video/pirata-hall-a.mp4"),
  hallB: staticFile("video/pirata-hall-b.mp4"),
  sy2Head: staticFile("video/sy2-head.mp4"),
  bgm: staticFile("audio/bgm-music-candidate.mp3"),
  whoosh: staticFile("audio/whoosh.wav"),
  vo1: staticFile("audio/v2-01.mp3"),
  vo2: staticFile("audio/v2-02.mp3"),
  vo3: staticFile("audio/v2-03.mp3"),
  vo4: staticFile("audio/v2-04.mp3"),
  vo5: staticFile("audio/v2-05.mp3"),
  vo6: staticFile("audio/v2-06.mp3"),
  vo6b: staticFile("audio/v2-06b-phone.mp3"),
  vo7: staticFile("audio/v2-07.mp3"),
  vo8: staticFile("audio/v2-08.mp3"),
  uiMenu: staticFile("ui/menu-mobile.png"),
  uiBoard: staticFile("ui/board-mobile.png"),
  uiBoardDesktop: staticFile("ui/board-desktop.png"),
  uiBuffet: staticFile("ui/buffet-prices-mobile.png"),
  uiBuffetSlots: staticFile("ui/buffet-slots.png"),
  uiBuffetFallback: staticFile("ui/buffet-mobile.png"),
  uiDashMobile: staticFile("ui/dashboard-mobile.png"),
  uiDashDesktop: staticFile("ui/dashboard-desktop.png"),
  flowBoardIdle: staticFile("ui/flow/01-board-idle.png"),
  flowOpenDialog: staticFile("ui/flow/02-open-dialog.png"),
  flowOpenAdult: staticFile("ui/flow/03-open-adult.png"),
  flowBoardOpen: staticFile("ui/flow/04-board-open.png"),
  flowDash: staticFile("ui/flow/05-dashboard.png"),
  flowSettingsHub: staticFile("ui/flow/06-settings-hub.png"),
  flowMenuHome: staticFile("ui/flow/10-menu-home.png"),
  flowMenuDrinks: staticFile("ui/flow/11-menu-drinks.png"),
  flowMenuAdded: staticFile("ui/flow/12-menu-added.png"),
};

export type ClickStep = {
  src: string;
  /** frames to show this screen before transitioning */
  hold: number;
  /** tap point as 0–1 inside the UI frame; omit = no finger */
  tap?: { x: number; y: number };
};

/** Phone UI with finger tap + page swap, synced to step holds */
export const ClickFlowUi: React.FC<{
  steps: ClickStep[];
  delay?: number;
  cropTop?: number;
}> = ({ steps, delay = 0, cropTop = 0.02 }) => {
  const frame = useCurrentFrame();
  const local = Math.max(0, frame - delay);
  let cursor = 0;
  let stepIndex = 0;
  let within = 0;
  for (let i = 0; i < steps.length; i++) {
    const h = steps[i]!.hold;
    if (local < cursor + h || i === steps.length - 1) {
      stepIndex = i;
      within = local - cursor;
      break;
    }
    cursor += h;
  }
  const step = steps[stepIndex]!;
  const next = steps[stepIndex + 1];
  const tapAt = Math.max(0, step.hold - 10);
  const tapping = step.tap && within >= tapAt;
  const cross = next
    ? interpolate(within, [tapAt + 4, step.hold], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 0;
  const imgH = `${100 / (1 - cropTop)}%`;
  const imgTop = `${(-cropTop * 100) / (1 - cropTop)}%`;
  const privacy = useUiPrivacyEnabled();
  const imgStyle: React.CSSProperties = {
    width: "100%",
    height: imgH,
    marginTop: imgTop,
    objectFit: "cover",
    objectPosition: "top center",
    filter: privacy ? uiPrivacyFilter() : undefined,
    transform: privacy ? "scale(1.08)" : undefined,
  };

  return (
    <Interactive.Div
      name="Click flow UI"
      style={{
        position: "absolute",
        left: 28,
        right: 28,
        top: 72,
        bottom: 210,
        borderRadius: 28,
        overflow: "hidden",
        border: `3px solid ${colors.goldDark}`,
        boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
        backgroundColor: "#0a0a0a",
        opacity: interpolate(frame, [delay, delay + 8], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    >
      <Img
        src={step.src}
        style={{
          position: "absolute",
          inset: 0,
          ...imgStyle,
          opacity: 1 - cross * 0.35,
        }}
      />
      {next ? (
        <Img
          src={next.src}
          style={{
            position: "absolute",
            inset: 0,
            ...imgStyle,
            opacity: cross,
          }}
        />
      ) : null}
      <UiPrivacyFog />
      {step.tap && tapping ? (
        <div
          style={{
            position: "absolute",
            left: `${step.tap.x * 100}%`,
            top: `${step.tap.y * 100}%`,
            width: 54,
            height: 54,
            marginLeft: -27,
            marginTop: -27,
            borderRadius: "50%",
            border: "3px solid rgba(255,255,255,0.95)",
            backgroundColor: "rgba(212,168,67,0.45)",
            boxShadow: "0 0 0 10px rgba(212,168,67,0.18)",
            scale: interpolate(within, [tapAt, tapAt + 6], [1.25, 0.85], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              output: "perceptual-scale",
            }),
            opacity: interpolate(within, [tapAt, tapAt + 2, step.hold], [0, 1, 0.3], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        />
      ) : null}
    </Interactive.Div>
  );
};

export const CoverVideo: React.FC<{
  src: string;
  startFrom?: number;
  dark?: number;
}> = ({ src, startFrom = 0, dark = 0.4 }) => (
  <AbsoluteFill>
    <Video
      src={src}
      muted
      trimBefore={startFrom}
      objectFit="cover"
      style={{ width: "100%", height: "100%" }}
    />
    <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${dark})` }} />
  </AbsoluteFill>
);

/** Near-fullscreen phone UI; optional top crop to hide demo chrome */
export const FullUi: React.FC<{
  src: string;
  delay?: number;
  cropTop?: number;
}> = ({ src, delay = 0, cropTop = 0.14 }) => {
  const frame = useCurrentFrame();
  const imgH = `${100 / (1 - cropTop)}%`;
  const imgTop = `${(-cropTop * 100) / (1 - cropTop)}%`;
  const privacy = useUiPrivacyEnabled();
  const imgStyle: React.CSSProperties = {
    width: "100%",
    height: imgH,
    marginTop: imgTop,
    objectFit: "cover",
    objectPosition: "top center",
    filter: privacy ? uiPrivacyFilter() : undefined,
    transform: privacy ? "scale(1.08)" : undefined,
  };
  return (
    <Interactive.Div
      name="Full UI"
      style={{
        position: "absolute",
        left: 28,
        right: 28,
        top: 72,
        bottom: 210,
        borderRadius: 28,
        overflow: "hidden",
        border: `3px solid ${colors.goldDark}`,
        boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
        backgroundColor: "#0a0a0a",
        opacity: interpolate(frame, [delay, delay + 10], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        scale: interpolate(frame, [delay, delay + 12], [0.97, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          output: "perceptual-scale",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }),
      }}
    >
      <Img src={src} style={imgStyle} />
      <UiPrivacyFog />
    </Interactive.Div>
  );
};

export const DualDevice: React.FC<{
  phoneSrc: string;
  desktopSrc: string;
  delay?: number;
  phoneFillRatio?: number;
}> = ({ phoneSrc, desktopSrc, delay = 4, phoneFillRatio }) => {
  const frame = useCurrentFrame();
  const privacy = useUiPrivacyEnabled();
  const phoneImgStyle = phoneTopFillStyle(
    phoneFillRatio ?? phoneFillRatioForSrc(phoneSrc),
  );
  const op = interpolate(frame, [delay, delay + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ opacity: op }}>
      <Interactive.Div
        name="Desktop"
        style={{
          position: "absolute",
          left: 36,
          right: 36,
          top: 90,
          height: 560,
          borderRadius: 16,
          overflow: "hidden",
          border: `3px solid ${colors.goldDark}`,
          boxShadow: "0 18px 50px rgba(0,0,0,0.5)",
        }}
      >
        <Img
          src={desktopSrc}
          style={{
            width: "100%",
            height: "118%",
            marginTop: "-8%",
            objectFit: "cover",
            objectPosition: "top",
            filter: privacy ? uiPrivacyFilter() : undefined,
            transform: privacy ? "scale(1.06)" : undefined,
          }}
        />
        <UiPrivacyFog intensity={0.9} />
        <div
          style={{
            position: "absolute",
            left: 14,
            top: 14,
            zIndex: 2,
            padding: "8px 14px",
            borderRadius: 999,
            backgroundColor: "rgba(15,14,12,0.88)",
            color: colors.goldLight,
            fontFamily: fonts.zh,
            fontSize: 24,
            fontWeight: 700,
          }}
        >
          电脑端
        </div>
      </Interactive.Div>
      <Interactive.Div
        name="Phone"
        style={{
          position: "absolute",
          left: "50%",
          bottom: 230,
          width: 420,
          height: 760,
          marginLeft: -210,
          borderRadius: 32,
          overflow: "hidden",
          border: `4px solid ${colors.gold}`,
          boxShadow: "0 24px 70px rgba(0,0,0,0.6)",
        }}
      >
        <Img
          src={phoneSrc}
          style={{
            ...phoneImgStyle,
            filter: privacy ? uiPrivacyFilter() : undefined,
            transform: privacy ? "scale(1.08)" : undefined,
          }}
        />
        <UiPrivacyFog />
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
          手机端
        </div>
      </Interactive.Div>
    </AbsoluteFill>
  );
};

export const Caption: React.FC<{
  lines: string[];
  delay?: number;
  size?: number;
}> = ({ lines, delay = 4, size = 42 }) => {
  const frame = useCurrentFrame();
  return (
    <Interactive.Div
      name="Caption"
      style={{
        position: "absolute",
        left: 36,
        right: 36,
        bottom: 88,
        padding: "22px 24px",
        borderRadius: 16,
        backgroundColor: "rgba(15,14,12,0.88)",
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
            fontSize: size,
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

export const ContrastSplit: React.FC<{
  badTitle: string;
  badBody: string;
  goodTitle: string;
  goodBody: string;
  delay?: number;
}> = ({ badTitle, badBody, goodTitle, goodBody, delay = 8 }) => {
  const frame = useCurrentFrame();
  return (
    <Interactive.Div
      name="Contrast"
      style={{
        position: "absolute",
        left: 36,
        right: 36,
        bottom: 250,
        display: "flex",
        gap: 12,
        opacity: interpolate(frame, [delay, delay + 10], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
      }}
    >
      <div
        style={{
          flexGrow: 1,
          padding: "16px 12px",
          borderRadius: 14,
          backgroundColor: "rgba(60,24,24,0.92)",
          border: "1px solid rgba(239,68,68,0.45)",
        }}
      >
        <div style={{ fontFamily: fonts.zh, fontSize: 24, color: colors.danger, fontWeight: 700, marginBottom: 6 }}>
          ✕ {badTitle}
        </div>
        <div style={{ fontFamily: fonts.zh, fontSize: 28, color: colors.text, fontWeight: 800, lineHeight: 1.3 }}>
          {badBody}
        </div>
      </div>
      <div
        style={{
          flexGrow: 1,
          padding: "16px 12px",
          borderRadius: 14,
          backgroundColor: "rgba(20,48,32,0.94)",
          border: "1px solid rgba(34,197,94,0.45)",
        }}
      >
        <div style={{ fontFamily: fonts.zh, fontSize: 24, color: colors.success, fontWeight: 700, marginBottom: 6 }}>
          ✓ {goodTitle}
        </div>
        <div style={{ fontFamily: fonts.zh, fontSize: 28, color: colors.text, fontWeight: 800, lineHeight: 1.3 }}>
          {goodBody}
        </div>
      </div>
    </Interactive.Div>
  );
};

export const BigNumber: React.FC<{
  label: string;
  value: string;
  delay?: number;
}> = ({ label, value, delay = 0 }) => {
  const frame = useCurrentFrame();
  return (
    <Interactive.Div
      name={label}
      style={{
        textAlign: "center",
        opacity: interpolate(frame, [delay, delay + 10], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        scale: interpolate(frame, [delay, delay + 12], [0.92, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          output: "perceptual-scale",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }),
      }}
    >
      <div style={{ fontFamily: fonts.zh, fontSize: 36, color: colors.textMuted, fontWeight: 600, marginBottom: 12 }}>
        {label}
      </div>
      <div style={{ fontFamily: fonts.display, fontSize: 118, color: colors.gold, fontWeight: 700 }}>
        {value}
      </div>
    </Interactive.Div>
  );
};
