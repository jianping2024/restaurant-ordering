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
  S07Devices,
  S08End,
} from "./scenes/v2/Scenes";
import { assets } from "./components/V2Visuals";
import { AdProps, FPS, defaultAdProps } from "./theme";

/**
 * VO-safe timeline (no overlaps), ~65s @ 30fps
 * Each VO starts ~0.25s into its scene and finishes before next scene.
 *
 * S1 0–6s   VO1 4.42s  算账€400
 * S2 6–14s  VO2 6.53s  €6万（150 台）
 * S3 14–22s VO3 6.36s  扫码菜单
 * S4 22–31s VO4 6.55s  本地断网
 * S5 31–37s VO5 4.13s  开台锁码
 * S6 37–44s VO6 4.87s  Buffet
 * S7 44–51s VO6b 4.92s 手机电脑
 * S8 51–65s VO7 ~11.3s CTA + contacts
 */
const S = {
  s1: 0,
  s2: 6 * FPS,
  s3: 14 * FPS,
  s4: 22 * FPS,
  s5: 31 * FPS,
  s6: 37 * FPS,
  s7: 44 * FPS,
  s8: 51 * FPS,
} as const;

const D = {
  s1: 6 * FPS,
  s2: 8 * FPS,
  s3: 8 * FPS,
  s4: 9 * FPS,
  s5: 6 * FPS,
  s6: 7 * FPS,
  s7: 7 * FPS,
  s8: 14 * FPS,
} as const;

export const MesaGoAdV2: React.FC<AdProps> = (props) => {
  const { contactLine, ctaLine, whatsapps, wechats } = {
    ...defaultAdProps,
    ...props,
  };
  const voIn = 8; // ~0.27s into scene

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
      <Sequence from={S.s7} durationInFrames={D.s7} name="Devices">
        <S07Devices />
      </Sequence>
      <Sequence from={S.s8} durationInFrames={D.s8} name="End">
        <S08End
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
      <Sequence from={S.s3 + voIn} name="VO3">
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
      <Sequence from={S.s7 + voIn} name="VO6b">
        <Audio src={assets.vo6b} />
      </Sequence>
      <Sequence from={S.s8 + voIn} name="VO7">
        <Audio src={assets.vo7} />
      </Sequence>

      {/* Whoosh only on silent cuts between scenes (not under VO) */}
      <Sequence from={S.s2 - 2} name="W1">
        <Audio src={assets.whoosh} volume={0.22} />
      </Sequence>
      <Sequence from={S.s3 - 2} name="W2">
        <Audio src={assets.whoosh} volume={0.22} />
      </Sequence>
      <Sequence from={S.s5 - 2} name="W3">
        <Audio src={assets.whoosh} volume={0.22} />
      </Sequence>
      <Sequence from={S.s7 - 2} name="W4">
        <Audio src={assets.whoosh} volume={0.22} />
      </Sequence>

      <Audio
        src={assets.bgm}
        loop
        volume={(f) =>
          interpolate(f, [61 * FPS, 65 * FPS], [0.12, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
    </AbsoluteFill>
  );
};

export const MESAGO_AD_V2_DURATION = 65 * FPS;
