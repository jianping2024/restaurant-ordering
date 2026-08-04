import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Video } from "@remotion/media";
import { colors, fonts } from "../theme";

export const DimOverlay: React.FC<{ opacity?: number }> = ({
  opacity = 0.45,
}) => (
  <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${opacity})` }} />
);

export const KenBurnsImage: React.FC<{
  src: string;
  name?: string;
}> = ({ src, name = "KenBurns" }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <Interactive.Div
      name={name}
      style={{
        position: "absolute",
        inset: 0,
        scale: interpolate(frame, [0, durationInFrames], [1, 1.12], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.linear,
          output: "perceptual-scale",
        }),
      }}
    >
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />
    </Interactive.Div>
  );
};

export const CoverVideo: React.FC<{
  src: string;
  muted?: boolean;
  startFrom?: number;
}> = ({ src, muted = true, startFrom = 0 }) => {
  return (
    <AbsoluteFill>
      <Video
        src={src}
        muted={muted}
        trimBefore={startFrom}
        objectFit="cover"
        style={{
          width: "100%",
          height: "100%",
        }}
      />
    </AbsoluteFill>
  );
};

export const BottomCaption: React.FC<{
  lines: string[];
  delay?: number;
}> = ({ lines, delay = 6 }) => {
  const frame = useCurrentFrame();
  return (
    <Interactive.Div
      name="Caption bar"
      style={{
        position: "absolute",
        left: 48,
        right: 48,
        bottom: 120,
        padding: "28px 32px",
        borderRadius: 20,
        backgroundColor: "rgba(15,14,12,0.78)",
        border: `1px solid rgba(212,168,67,0.35)`,
        opacity: interpolate(frame, [delay, delay + 10], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        translate: interpolate(
          frame,
          [delay, delay + 12],
          ["0px 24px", "0px 0px"],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          },
        ),
      }}
    >
      {lines.map((line) => (
        <Interactive.Div
          key={line}
          name={line}
          style={{
            fontFamily: fonts.zh,
            fontSize: lines.length > 1 ? 42 : 48,
            fontWeight: 800,
            color: colors.text,
            textAlign: "center",
            lineHeight: 1.45,
          }}
        >
          {line}
        </Interactive.Div>
      ))}
    </Interactive.Div>
  );
};

export const CheckLine: React.FC<{
  text: string;
  delay: number;
}> = ({ text, delay }) => {
  const frame = useCurrentFrame();
  return (
    <Interactive.Div
      name={text}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "22px 28px",
        marginBottom: 18,
        borderRadius: 18,
        backgroundColor: "rgba(15,14,12,0.82)",
        border: `1px solid ${colors.goldDark}`,
        opacity: interpolate(frame, [delay, delay + 10], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        translate: interpolate(
          frame,
          [delay, delay + 12],
          ["40px 0px", "0px 0px"],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          },
        ),
        fontFamily: fonts.zh,
        fontSize: 40,
        fontWeight: 700,
        color: colors.text,
      }}
    >
      <span style={{ color: colors.gold, fontSize: 36 }}>✅</span>
      {text}
    </Interactive.Div>
  );
};

export const assets = {
  imgBusy: staticFile("images/scene-busy-restaurant.png"),
  imgScan: staticFile("images/scene-scan-qr.png"),
  imgMenu: staticFile("images/scene-phone-menu.png"),
  imgKitchen: staticFile("images/scene-kitchen-print.png"),
  imgOwner: staticFile("images/scene-owner-phone.png"),
  vidWaiter: staticFile("video/waiter.mp4"),
  vidWok: staticFile("video/wok.mp4"),
  vo1: staticFile("audio/vo-01-hook.mp3"),
  vo2: staticFile("audio/vo-02-scan.mp3"),
  vo3: staticFile("audio/vo-03-features.mp3"),
  vo4: staticFile("audio/vo-04-results.mp3"),
  vo5: staticFile("audio/vo-05-cta.mp3"),
  bgm: staticFile("audio/bgm.mp3"),
  whoosh: staticFile("audio/whoosh.wav"),
  ding: staticFile("audio/ding.wav"),
};
