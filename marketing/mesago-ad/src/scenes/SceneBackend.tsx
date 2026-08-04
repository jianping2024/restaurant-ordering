import React from "react";
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
} from "remotion";
import {
  CheckLine,
  DimOverlay,
  KenBurnsImage,
  assets,
} from "../components/Visuals";
import { colors, fonts } from "../theme";

/** 10–18s: 快速切换后台功能点 */
export const SceneBackend: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <KenBurnsImage src={assets.imgOwner} name="Owner dashboard" />
      <DimOverlay opacity={0.55} />

      <Interactive.Div
        name="Backend label"
        style={{
          position: "absolute",
          top: 140,
          left: 64,
          right: 64,
          fontFamily: fonts.zh,
          fontSize: 36,
          fontWeight: 600,
          color: colors.goldLight,
          letterSpacing: "0.08em",
          opacity: interpolate(frame, [0, 12], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        后台一键管理
      </Interactive.Div>

      <Interactive.Div
        name="Feature list"
        style={{
          position: "absolute",
          left: 48,
          right: 48,
          top: 240,
        }}
      >
        <CheckLine text="工作日 / 周末 Buffet 自动切换" delay={18} />
        <CheckLine text="开台后才能点餐" delay={70} />
        <CheckLine text="老板手机随时查看营业情况" delay={130} />
      </Interactive.Div>

      {/* Mini UI cards floating */}
      <Interactive.Div
        name="Buffet card"
        style={{
          position: "absolute",
          right: 56,
          bottom: 220,
          width: 280,
          padding: 20,
          borderRadius: 16,
          backgroundColor: colors.card,
          border: `1px solid ${colors.gold}`,
          opacity: interpolate(frame, [40, 55], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          scale: interpolate(frame, [40, 58], [0.9, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            output: "perceptual-scale",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          }),
          fontFamily: fonts.zh,
          color: colors.text,
        }}
      >
        <div style={{ fontSize: 24, color: colors.textMuted }}>今日 Buffet</div>
        <div style={{ fontSize: 40, fontWeight: 800, color: colors.gold }}>
          周末价 €14.9
        </div>
        <div style={{ fontSize: 22, marginTop: 8, color: colors.success }}>
          已自动切换
        </div>
      </Interactive.Div>
    </AbsoluteFill>
  );
};
