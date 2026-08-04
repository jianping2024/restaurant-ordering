import React from "react";
import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
} from "remotion";
import {
  BottomCaption,
  DimOverlay,
  KenBurnsImage,
  assets,
} from "../components/Visuals";

/** 5–10s: 扫码 → 手机进入菜单 */
export const SceneScan: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          opacity: interpolate(frame, [0, 55, 70, 150], [1, 1, 0, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <KenBurnsImage src={assets.imgScan} name="Scan QR" />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          opacity: interpolate(frame, [60, 78], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          scale: interpolate(frame, [60, 82], [1.08, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            output: "perceptual-scale",
          }),
        }}
      >
        <KenBurnsImage src={assets.imgMenu} name="Phone menu" />
      </AbsoluteFill>

      <DimOverlay opacity={0.38} />

      <Interactive.Div
        name="No app badge"
        style={{
          position: "absolute",
          top: 160,
          alignSelf: "center",
          left: "50%",
          translate: "-50% 0",
          padding: "14px 28px",
          borderRadius: 999,
          backgroundColor: "rgba(212,168,67,0.95)",
          color: "#0F0E0C",
          fontFamily: "Noto Sans SC, sans-serif",
          fontSize: 34,
          fontWeight: 800,
          opacity: interpolate(frame, [85, 100], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        无需下载 APP
      </Interactive.Div>

      <BottomCaption
        lines={
          frame < 75
            ? ["扫一扫，立即点餐"]
            : ["扫一扫，立即点餐", "无需下载 APP"]
        }
        delay={4}
      />
    </AbsoluteFill>
  );
};
