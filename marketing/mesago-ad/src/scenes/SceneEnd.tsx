import React from "react";
import {
  AbsoluteFill,
  Interactive,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { AdProps, colors, fonts } from "../theme";

/** v1 end card — contact from landing */
export const SceneEnd: React.FC<AdProps> = ({
  contactLine,
  ctaLine,
  whatsapps,
  wechats,
}) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        justifyContent: "center",
        alignItems: "center",
        padding: "0 64px",
        gap: 18,
      }}
    >
      <Interactive.Div
        name="Glow"
        style={{
          position: "absolute",
          top: -120,
          width: 900,
          height: 900,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(212,168,67,0.35) 0%, transparent 65%)",
        }}
      />

      <Interactive.Div
        name="Logo"
        style={{
          fontFamily: fonts.display,
          fontSize: 100,
          fontWeight: 700,
          color: colors.gold,
          letterSpacing: "0.08em",
          opacity: interpolate(frame, [0, 12], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        FARVOO
      </Interactive.Div>

      <Interactive.Div
        name="Tagline"
        style={{
          fontFamily: fonts.zh,
          fontSize: 36,
          fontWeight: 700,
          color: colors.text,
          textAlign: "center",
          opacity: interpolate(frame, [14, 26], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        葡萄牙华人餐厅专用点餐系统
      </Interactive.Div>

      <Interactive.Div
        name="CTA"
        style={{
          marginTop: 28,
          padding: "24px 48px",
          borderRadius: 999,
          backgroundColor: colors.gold,
          color: colors.bg,
          fontFamily: fonts.zh,
          fontSize: 40,
          fontWeight: 800,
          opacity: interpolate(frame, [32, 44], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        {ctaLine}
      </Interactive.Div>

      <Interactive.Div
        name="Contact"
        style={{
          marginTop: 16,
          fontFamily: fonts.zh,
          fontSize: 28,
          fontWeight: 600,
          color: colors.textMuted,
          textAlign: "center",
          lineHeight: 1.65,
          opacity: interpolate(frame, [48, 62], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        微信 {wechats.map((c) => c.display).join(" / ")}
        <br />
        WhatsApp {whatsapps.join(" / ")}
        <br />
        {contactLine}
      </Interactive.Div>
    </AbsoluteFill>
  );
};
