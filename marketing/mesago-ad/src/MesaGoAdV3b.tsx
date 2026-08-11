import React from "react";
import { AbsoluteFill, Sequence, interpolate } from "remotion";
import { Audio } from "@remotion/media";
import {
  V3S01Cost,
  V3S03Roles,
  V3S05Devices,
  V3S06Prices,
  V3S07History,
  V3S08Proof,
} from "./scenes/v3/Scenes";
import { V3bS02Offline, V3bS04GuestNet, V3bS09End } from "./scenes/v3b/Scenes";
import { v3bAssets } from "./components/V3bVisuals";
import { UiPrivacyContext } from "./components/V3Visuals";
import { AdProps, FPS, defaultAdProps } from "./theme";

/** Measured VO durations (seconds) — v3b tracks regenerated 2026-08-11. */
const VO_DUR_SEC = {
  vo1: 7.32,
  vo2: 6.29,
  vo3: 7.56,
  vo4: 6.19,
  vo5: 6.22,
  vo6: 6.38,
  vo7: 7.44,
  voProof: 7.54,
  vo8: 8.42,
  voAgent: 4.58,
} as const;

const VO_GAP = 4;

function scheduleVoTracks(
  tracks: { key: keyof typeof VO_DUR_SEC; sceneStart: number }[],
  voIn: number,
): { key: keyof typeof VO_DUR_SEC; start: number; durationInFrames: number }[] {
  let prevEnd = 0;
  return tracks.map(({ key, sceneStart }) => {
    const preferred = sceneStart + voIn;
    const start = Math.max(preferred, prevEnd + VO_GAP);
    const durationInFrames = Math.ceil(VO_DUR_SEC[key] * FPS);
    prevEnd = start + durationInFrames;
    return { key, start, durationInFrames };
  });
}

/**
 * MesaGoAdV3b — based on MesaGoAdV3, but:
 * - S02: offline -> add "断网后可接入店内 Wi‑Fi 继续扫码点餐"
 * - S04: guest scan -> add "灵活安全（4G/5G + 断网可连店内 Wi‑Fi）"
 * - S09: end -> add "经典 Buffet / 寿司自助"
 *
 * Do NOT overwrite MesaGoAdV3. This is a new composition only.
 */
const S = {
  s1: 0,
  s2: 8 * FPS,
  s3: 15 * FPS,
  s4: 28 * FPS,
  s5: 34 * FPS,
  s6: 41 * FPS,
  s7: 48 * FPS,
  s8: 55 * FPS,
  /** Proof extended +3s for Google Pirata storefront clip */
  s9: 66 * FPS,
} as const;

const D = {
  s1: 8 * FPS,
  s2: 7 * FPS,
  s3: 13 * FPS,
  s4: 6 * FPS,
  s5: 7 * FPS,
  s6: 7 * FPS,
  s7: 7 * FPS,
  s8: 11 * FPS,
  s9: 14 * FPS,
} as const;

export const MesaGoAdV3b: React.FC<AdProps> = (props) => {
  const merged = { ...defaultAdProps, ...props };
  const privacyFog = merged.privacyFog !== false;
  const voIn = 6;
  const agentVoAt = S.s9 + 5 * FPS + voIn;

  const voTracks = scheduleVoTracks(
    [
      { key: "vo1", sceneStart: S.s1 },
      { key: "vo2", sceneStart: S.s2 },
      { key: "vo3", sceneStart: S.s3 },
      { key: "vo4", sceneStart: S.s4 },
      { key: "vo5", sceneStart: S.s5 },
      { key: "vo6", sceneStart: S.s6 },
      { key: "vo7", sceneStart: S.s7 },
      { key: "voProof", sceneStart: S.s8 },
      { key: "vo8", sceneStart: S.s9 },
    ],
    voIn,
  );

  const lastVo = voTracks[voTracks.length - 1]!;
  const agentStart = Math.max(
    agentVoAt,
    lastVo.start + lastVo.durationInFrames + VO_GAP,
  );

  const voSrc: Record<keyof typeof VO_DUR_SEC, string> = {
    vo1: v3bAssets.vo1,
    vo2: v3bAssets.vo2,
    vo3: v3bAssets.vo3,
    vo4: v3bAssets.vo4,
    vo5: v3bAssets.vo5,
    vo6: v3bAssets.vo6,
    vo7: v3bAssets.vo7,
    voProof: v3bAssets.voProof,
    vo8: v3bAssets.vo8,
    voAgent: v3bAssets.voAgent,
  };

  return (
    <UiPrivacyContext.Provider value={privacyFog}>
    <AbsoluteFill style={{ backgroundColor: "#0F0E0C" }}>
      <Sequence from={S.s1} durationInFrames={D.s1} name="Cost">
        <V3S01Cost />
      </Sequence>
      <Sequence from={S.s2} durationInFrames={D.s2} name="Offline">
        <V3bS02Offline />
      </Sequence>
      <Sequence from={S.s3} durationInFrames={D.s3} name="Roles">
        <V3S03Roles />
      </Sequence>
      <Sequence from={S.s4} durationInFrames={D.s4} name="GuestNet">
        <V3bS04GuestNet />
      </Sequence>
      <Sequence from={S.s5} durationInFrames={D.s5} name="Devices">
        <V3S05Devices />
      </Sequence>
      <Sequence from={S.s6} durationInFrames={D.s6} name="Prices">
        <V3S06Prices />
      </Sequence>
      <Sequence from={S.s7} durationInFrames={D.s7} name="History">
        <V3S07History />
      </Sequence>
      <Sequence from={S.s8} durationInFrames={D.s8} name="Proof">
        <V3S08Proof clientVenue={merged.clientVenue} />
      </Sequence>
      <Sequence from={S.s9} durationInFrames={D.s9} name="End">
        <V3bS09End {...merged} />
      </Sequence>

      {/* VO tracks — sequential starts prevent overlap when v3b lines run long */}
      {voTracks.map(({ key, start, durationInFrames }) => (
        <Sequence
          key={key}
          from={start}
          durationInFrames={durationInFrames}
          name={key.toUpperCase()}
        >
          <Audio src={voSrc[key]} />
        </Sequence>
      ))}
      <Sequence from={agentStart} durationInFrames={Math.ceil(VO_DUR_SEC.voAgent * FPS)} name="VOAgent">
        <Audio src={v3bAssets.voAgent} />
      </Sequence>

      {/* whooshes */}
      <Sequence from={S.s2 - 2} name="W1">
        <Audio src={v3bAssets.whoosh} volume={0.16} />
      </Sequence>
      <Sequence from={S.s3 - 2} name="W2">
        <Audio src={v3bAssets.whoosh} volume={0.16} />
      </Sequence>
      <Sequence from={S.s5 - 2} name="W3">
        <Audio src={v3bAssets.whoosh} volume={0.16} />
      </Sequence>
      <Sequence from={S.s7 - 2} name="W4">
        <Audio src={v3bAssets.whoosh} volume={0.16} />
      </Sequence>
      <Sequence from={S.s8 - 2} name="W5">
        <Audio src={v3bAssets.whoosh} volume={0.16} />
      </Sequence>
      <Sequence from={S.s9 + 5 * FPS - 2} name="W6">
        <Audio src={v3bAssets.whoosh} volume={0.14} />
      </Sequence>

      {/* BGM loop */}
      <Audio
        src={v3bAssets.bgm}
        loop
        loopVolumeCurveBehavior="extend"
        volume={(f) =>
          interpolate(f, [0, 18, 74 * FPS, 80 * FPS], [0, 0.18, 0.16, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
    </AbsoluteFill>
    </UiPrivacyContext.Provider>
  );
};

export const MESAGO_AD_V3B_DURATION = 80 * FPS;

