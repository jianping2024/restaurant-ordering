import React from "react";
import { AbsoluteFill, Sequence, interpolate } from "remotion";
import { Audio } from "@remotion/media";
import {
  S01Price,
  S02Total,
  S03Menu,
  S04Local,
  S05OpenTable,
  S06Buffet,
  S07MobileOps,
  S08Proof,
  S09End,
} from "./scenes/v2/Scenes";
import { assets } from "./components/V2Visuals";
import { AdProps, FPS, defaultAdProps } from "./theme";

/**
 * FARVOO ad v4 — 经济·安全·稳定·便捷 · 全流程点击 · 无店名
 *
 * S1  0–6    经济 €400（店面 2.jpg）
 * S2  6–15   经济 €40k（航拍 3.jpg · 100 桌）
 * S3  15–29  sy2 前7秒 → 中文菜单点击
 * S4  29–39  稳定（VO4 ~8.7s）
 * S5  39–49  安全 开台点击
 * S6  49–56  Buffet（无角色管理顶栏）
 * S7  56–66  便捷 前台1.jpg → 手机看板
 * S8  66–73  已入住社证
 * S9  73–86  CTA（WhatsApp 不重复底栏）
 */
const S = {
  s1: 0,
  s2: 6 * FPS,
  s3: 15 * FPS,
  s4: 29 * FPS,
  s5: 39 * FPS,
  s6: 49 * FPS,
  s7: 56 * FPS,
  s8: 66 * FPS,
  s9: 73 * FPS,
} as const;

const D = {
  s1: 6 * FPS,
  s2: 9 * FPS,
  s3: 14 * FPS,
  s4: 10 * FPS,
  s5: 10 * FPS,
  s6: 7 * FPS,
  s7: 10 * FPS,
  s8: 7 * FPS,
  s9: 13 * FPS,
} as const;

export const MesaGoAdV2: React.FC<AdProps> = (props) => {
  const { contactLine, ctaLine, whatsapps, wechats } = {
    ...defaultAdProps,
    ...props,
  };
  const voIn = 8;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0F0E0C" }}>
      <Sequence from={S.s1} durationInFrames={D.s1} name="Price">
        <S01Price />
      </Sequence>
      <Sequence from={S.s2} durationInFrames={D.s2} name="Total">
        <S02Total />
      </Sequence>
      <Sequence from={S.s3} durationInFrames={D.s3} name="Menu">
        <S03Menu />
      </Sequence>
      <Sequence from={S.s4} durationInFrames={D.s4} name="Local">
        <S04Local />
      </Sequence>
      <Sequence from={S.s5} durationInFrames={D.s5} name="OpenTable">
        <S05OpenTable />
      </Sequence>
      <Sequence from={S.s6} durationInFrames={D.s6} name="Buffet">
        <S06Buffet />
      </Sequence>
      <Sequence from={S.s7} durationInFrames={D.s7} name="MobileOps">
        <S07MobileOps />
      </Sequence>
      <Sequence from={S.s8} durationInFrames={D.s8} name="Proof">
        <S08Proof />
      </Sequence>
      <Sequence from={S.s9} durationInFrames={D.s9} name="End">
        <S09End
          contactLine={contactLine}
          ctaLine={ctaLine}
          whatsapps={whatsapps}
          wechats={wechats}
        />
      </Sequence>

      <Sequence from={S.s1 + voIn} name="VO1">
        <Audio src={assets.vo1} />
      </Sequence>
      <Sequence from={S.s2 + voIn} name="VO2">
        <Audio src={assets.vo2} />
      </Sequence>
      {/* VO3 starts after sy2 hook so narration matches App clicks */}
      <Sequence from={S.s3 + 7 * FPS + voIn} name="VO3">
        <Audio src={assets.vo3} />
      </Sequence>
      <Sequence from={S.s4 + voIn} name="VO4">
        <Audio src={assets.vo4} />
      </Sequence>
      <Sequence from={S.s5 + voIn} name="VO5">
        <Audio src={assets.vo5} />
      </Sequence>
      <Sequence from={S.s6 + voIn} name="VO6">
        <Audio src={assets.vo6} />
      </Sequence>
      <Sequence from={S.s7 + voIn} name="VO7">
        <Audio src={assets.vo6b} />
      </Sequence>
      <Sequence from={S.s8 + voIn} name="VO8">
        <Audio src={assets.vo8} />
      </Sequence>
      <Sequence from={S.s9 + voIn} name="VO9">
        <Audio src={assets.vo7} />
      </Sequence>

      <Sequence from={S.s2 - 2} name="W1">
        <Audio src={assets.whoosh} volume={0.18} />
      </Sequence>
      <Sequence from={S.s3 - 2} name="W2">
        <Audio src={assets.whoosh} volume={0.18} />
      </Sequence>
      <Sequence from={S.s5 - 2} name="W3">
        <Audio src={assets.whoosh} volume={0.18} />
      </Sequence>
      <Sequence from={S.s7 - 2} name="W4">
        <Audio src={assets.whoosh} volume={0.18} />
      </Sequence>
      <Sequence from={S.s8 - 2} name="W5">
        <Audio src={assets.whoosh} volume={0.16} />
      </Sequence>

      {/* BGM: user-approved bgm-music-candidate */}
      <Audio
        src={assets.bgm}
        loop
        loopVolumeCurveBehavior="extend"
        volume={(f) =>
          interpolate(f, [0, 18, 80 * FPS, 86 * FPS], [0, 0.2, 0.18, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
    </AbsoluteFill>
  );
};

export const MESAGO_AD_V2_DURATION = 86 * FPS;
