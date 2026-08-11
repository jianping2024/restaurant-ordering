import React from "react";
import { AbsoluteFill, Sequence, interpolate } from "remotion";
import { Audio } from "@remotion/media";
import { SceneBusy } from "./scenes/SceneBusy";
import { SceneScan } from "./scenes/SceneScan";
import { SceneBackend } from "./scenes/SceneBackend";
import { SceneKitchen } from "./scenes/SceneKitchen";
import { SceneEnd } from "./scenes/SceneEnd";
import { assets } from "./components/Visuals";
import { AdProps, FPS, defaultAdProps } from "./theme";

/**
 * Exact storyboard (30s @ 30fps = 900f):
 * 0–5   高峰忙碌 +「还在靠服务员一个个点餐？」
 * 5–10  扫码进菜单 +「扫一扫…无需下载 APP」
 * 10–18 后台功能 ✅ 三条
 * 18–25 订单进厨房 +「减少人工/漏单/提高翻台」
 * 25–30 Logo + CTA
 */
export const MesaGoAd: React.FC<AdProps> = (props) => {
  const { contactLine, ctaLine, whatsapps, wechats, agentLine, agentSubline } = {
    ...defaultAdProps,
    ...props,
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#0F0E0C" }}>
      <Sequence durationInFrames={5 * FPS} name="Busy">
        <SceneBusy />
      </Sequence>
      <Sequence from={5 * FPS} durationInFrames={5 * FPS} name="Scan">
        <SceneScan />
      </Sequence>
      <Sequence from={10 * FPS} durationInFrames={8 * FPS} name="Backend">
        <SceneBackend />
      </Sequence>
      <Sequence from={18 * FPS} durationInFrames={7 * FPS} name="Kitchen">
        <SceneKitchen />
      </Sequence>
      <Sequence from={25 * FPS} durationInFrames={5 * FPS} name="End">
        <SceneEnd
          contactLine={contactLine}
          ctaLine={ctaLine}
          whatsapps={whatsapps}
          wechats={wechats}
          agentLine={agentLine}
          agentSubline={agentSubline}
        />
      </Sequence>

      {/* Voiceover timed to each beat */}
      <Sequence from={8} name="VO1">
        <Audio src={assets.vo1} volume={1} />
      </Sequence>
      <Sequence from={5 * FPS + 6} name="VO2">
        <Audio src={assets.vo2} volume={1} />
      </Sequence>
      <Sequence from={10 * FPS + 8} name="VO3">
        <Audio src={assets.vo3} volume={1} />
      </Sequence>
      <Sequence from={18 * FPS + 12} name="VO4">
        <Audio src={assets.vo4} volume={1} />
      </Sequence>
      <Sequence from={25 * FPS + 6} name="VO5">
        <Audio src={assets.vo5} volume={1} />
      </Sequence>

      {/* Transition whooshes */}
      <Sequence from={5 * FPS - 4} name="Whoosh1">
        <Audio src={assets.whoosh} volume={0.35} />
      </Sequence>
      <Sequence from={10 * FPS - 4} name="Whoosh2">
        <Audio src={assets.whoosh} volume={0.35} />
      </Sequence>
      <Sequence from={18 * FPS - 4} name="Whoosh3">
        <Audio src={assets.whoosh} volume={0.35} />
      </Sequence>
      <Sequence from={25 * FPS - 4} name="Whoosh4">
        <Audio src={assets.whoosh} volume={0.35} />
      </Sequence>

      {/* Feature ding */}
      <Sequence from={10 * FPS + 18} name="Ding1">
        <Audio src={assets.ding} volume={0.25} />
      </Sequence>
      <Sequence from={10 * FPS + 70} name="Ding2">
        <Audio src={assets.ding} volume={0.25} />
      </Sequence>
      <Sequence from={10 * FPS + 130} name="Ding3">
        <Audio src={assets.ding} volume={0.25} />
      </Sequence>

      {/* BGM loop under VO */}
      <Audio
        src={assets.bgm}
        loop
        volume={(f) =>
          interpolate(f, [28 * FPS, 30 * FPS], [0.16, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
    </AbsoluteFill>
  );
};

export const MESAGO_AD_DURATION = 30 * FPS;
