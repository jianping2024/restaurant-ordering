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
  CoverVideo,
  DimOverlay,
  KenBurnsImage,
  assets,
} from "../components/Visuals";
import { colors, fonts } from "../theme";

const tickets = [
  { table: "A12", dish: "宫保鸡丁 x2", delay: 20 },
  { table: "B03", dish: "酸辣汤 x1", delay: 45 },
  { table: "A07", dish: "扬州炒饭 x3", delay: 70 },
];

/** 18–25s: 订单进入 + 厨房同步出单 */
export const SceneKitchen: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      <CoverVideo src={assets.vidWok} />
      <AbsoluteFill
        style={{
          opacity: interpolate(frame, [95, 115], [0, 0.85], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <KenBurnsImage src={assets.imgKitchen} name="Kitchen print" />
      </AbsoluteFill>
      <DimOverlay opacity={0.38} />

      <Interactive.Div
        name="Order feed"
        style={{
          position: "absolute",
          top: 140,
          left: 48,
          right: 48,
        }}
      >
        {tickets.map((t) => (
          <Interactive.Div
            key={t.table + t.dish}
            name={`Ticket ${t.table}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "18px 24px",
              marginBottom: 14,
              borderRadius: 14,
              backgroundColor: "rgba(15,14,12,0.82)",
              borderLeft: `6px solid ${colors.gold}`,
              fontFamily: fonts.zh,
              color: colors.text,
              opacity: interpolate(frame, [t.delay, t.delay + 10], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              translate: interpolate(
                frame,
                [t.delay, t.delay + 12],
                ["-60px 0px", "0px 0px"],
                {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.bezier(0.16, 1, 0.3, 1),
                },
              ),
            }}
          >
            <span style={{ fontSize: 36, fontWeight: 800 }}>{t.table}</span>
            <span style={{ fontSize: 32, fontWeight: 600 }}>{t.dish}</span>
            <span style={{ fontSize: 26, color: colors.success }}>新单</span>
          </Interactive.Div>
        ))}
      </Interactive.Div>

      <BottomCaption
        lines={["减少人工 · 减少漏单 · 提高翻台率"]}
        delay={100}
      />
    </AbsoluteFill>
  );
};
