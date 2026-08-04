import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import {
  BottomCaption,
  CoverVideo,
  DimOverlay,
  KenBurnsImage,
  assets,
} from "../components/Visuals";

/** 0–5s: 高峰期服务员奔忙 + 顾客举手等待 */
export const SceneBusy: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill>
      {/* Live service B-roll under still */}
      <CoverVideo src={assets.vidWaiter} />
      {/* Storyboard: peak-hour restaurant with hands raised */}
      <AbsoluteFill
        style={{
          opacity: interpolate(frame, [0, 12, 70, 90], [1, 1, 0.35, 0.2], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <KenBurnsImage src={assets.imgBusy} name="Busy still" />
      </AbsoluteFill>
      <DimOverlay opacity={0.4} />
      <BottomCaption lines={["还在靠服务员一个个点餐？"]} />
    </AbsoluteFill>
  );
};
