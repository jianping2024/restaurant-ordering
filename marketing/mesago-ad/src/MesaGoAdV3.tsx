import React from "react";
import { AbsoluteFill, Sequence, interpolate } from "remotion";
import { Audio } from "@remotion/media";
import {
  V3S01Cost,
  V3S02Offline,
  V3S03Roles,
  V3S04GuestNet,
  V3S05Devices,
  V3S06Prices,
  V3S07History,
  V3S08Proof,
  V3S09End,
} from "./scenes/v3/Scenes";
import { v3Assets } from "./components/V3Visuals";
import { AdProps, FPS, defaultAdProps } from "./theme";

/**
 * FARVOO buffet promo v3 — ~77s · 9:16 · 左右分屏对比
 *
 * S1  0–8    开店成本 €40k
 * S2  8–15   断网仍可营业
 * S3  15–26  角色权限与留痕
 * S4  26–33  顾客扫码不依赖 Wi-Fi
 * S5  33–41  电脑手机协同
 * S6  41–48  价格自动执行（老板后台）
 * S7  48–55  订单历史 001 桌
 * S8  55–63  已落地实拍 p1/p2/p3 + m1/m2
 * S9  63–77  闭环 + 预约演示 → 诚招代理（同联系方式）
 */
const S = {
  s1: 0,
  s2: 8 * FPS,
  s3: 15 * FPS,
  s4: 26 * FPS,
  s5: 33 * FPS,
  s6: 41 * FPS,
  s7: 48 * FPS,
  s8: 55 * FPS,
  s9: 63 * FPS,
} as const;

const D = {
  s1: 8 * FPS,
  s2: 7 * FPS,
  s3: 11 * FPS,
  s4: 7 * FPS,
  s5: 8 * FPS,
  s6: 7 * FPS,
  s7: 7 * FPS,
  s8: 8 * FPS,
  s9: 14 * FPS,
} as const;

export const MesaGoAdV3: React.FC<AdProps> = (props) => {
  const merged = { ...defaultAdProps, ...props };
  const voIn = 6;
  const agentVoAt = S.s9 + 5 * FPS + voIn;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0F0E0C" }}>
      <Sequence from={S.s1} durationInFrames={D.s1} name="Cost">
        <V3S01Cost />
      </Sequence>
      <Sequence from={S.s2} durationInFrames={D.s2} name="Offline">
        <V3S02Offline />
      </Sequence>
      <Sequence from={S.s3} durationInFrames={D.s3} name="Roles">
        <V3S03Roles />
      </Sequence>
      <Sequence from={S.s4} durationInFrames={D.s4} name="GuestNet">
        <V3S04GuestNet />
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
        <V3S08Proof />
      </Sequence>
      <Sequence from={S.s9} durationInFrames={D.s9} name="End">
        <V3S09End {...merged} />
      </Sequence>

      <Sequence from={S.s1 + voIn} name="VO1">
        <Audio src={v3Assets.vo1} />
      </Sequence>
      <Sequence from={S.s2 + voIn} name="VO2">
        <Audio src={v3Assets.vo2} />
      </Sequence>
      <Sequence from={S.s3 + voIn} name="VO3">
        <Audio src={v3Assets.vo3} />
      </Sequence>
      <Sequence from={S.s4 + voIn} name="VO4">
        <Audio src={v3Assets.vo4} />
      </Sequence>
      <Sequence from={S.s5 + voIn} name="VO5">
        <Audio src={v3Assets.vo5} />
      </Sequence>
      <Sequence from={S.s6 + voIn} name="VO6">
        <Audio src={v3Assets.vo6} />
      </Sequence>
      <Sequence from={S.s7 + voIn} name="VO7">
        <Audio src={v3Assets.vo7} />
      </Sequence>
      <Sequence from={S.s8 + voIn} name="VOProof">
        <Audio src={v3Assets.voProof} />
      </Sequence>
      <Sequence from={S.s9 + voIn} name="VO9">
        <Audio src={v3Assets.vo8} />
      </Sequence>
      <Sequence from={agentVoAt} name="VOAgent">
        <Audio src={v3Assets.voAgent} />
      </Sequence>

      <Sequence from={S.s2 - 2} name="W1">
        <Audio src={v3Assets.whoosh} volume={0.16} />
      </Sequence>
      <Sequence from={S.s3 - 2} name="W2">
        <Audio src={v3Assets.whoosh} volume={0.16} />
      </Sequence>
      <Sequence from={S.s5 - 2} name="W3">
        <Audio src={v3Assets.whoosh} volume={0.16} />
      </Sequence>
      <Sequence from={S.s7 - 2} name="W4">
        <Audio src={v3Assets.whoosh} volume={0.16} />
      </Sequence>
      <Sequence from={S.s8 - 2} name="W5">
        <Audio src={v3Assets.whoosh} volume={0.16} />
      </Sequence>
      <Sequence from={S.s9 + 5 * FPS - 2} name="W6">
        <Audio src={v3Assets.whoosh} volume={0.14} />
      </Sequence>

      <Audio
        src={v3Assets.bgm}
        loop
        loopVolumeCurveBehavior="extend"
        volume={(f) =>
          interpolate(f, [0, 18, 71 * FPS, 77 * FPS], [0, 0.18, 0.16, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
    </AbsoluteFill>
  );
};

export const MESAGO_AD_V3_DURATION = 77 * FPS;
