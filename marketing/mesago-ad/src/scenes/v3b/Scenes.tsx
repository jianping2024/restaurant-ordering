import React from "react";
import { AbsoluteFill, staticFile } from "remotion";
import {
  BottomCaption,
  PhoneProof,
  VsSplit,
  v3Assets,
} from "../../components/V3Visuals";
import { AdProps, colors, fonts } from "../../theme";
import { Interactive, Img, interpolate } from "remotion";

/**
 * V3b: only custom the frames that you asked to change:
 * - S02: offline -> add "断网后可接入店内 Wi-Fi 继续扫码点餐"
 * - S04: guest scan -> add "灵活安全：可切换网络/断网后可连店内 Wi-Fi"
 * - S09: end -> last add "经典 Buffet / 寿司自助"
 *
 * Keep the rest segments reused from v3 Scenes to avoid duplicating storyboard.
 */

/** 8–15s 断网后可加入店内 Wi‑Fi 继续扫码点餐 */
export const V3bS02Offline: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: colors.bg }}>
    <VsSplit
      leftSrc={v3Assets.plateOffline}
      rightSrc={v3Assets.flowMenuHome}
      leftLabel="只靠外网"
      leftBody="断网：下单结账中断"
      rightLabel="断网兜底（可连店内Wi‑Fi）"
      rightBody="继续扫码点餐"
      delay={0}
    />
    {/* Use "menu list" evidence that is stable and renders fully in local capture. */}
    <PhoneProof src={v3Assets.flowMenuDrinks} delay={18} label="扫码菜单" side="right" />
    <BottomCaption
      lines={["断网也能继续扫码点餐", "可连店内 Wi‑Fi 兜底"]}
      delay={10}
    />
  </AbsoluteFill>
);

/** 26–33s 顾客扫码：灵活安全（4G/5G + 断网后可连店内Wi‑Fi） */
export const V3bS04GuestNet: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: colors.bg }}>
    <VsSplit
      leftSrc={v3Assets.fallbackBusy}
      rightSrc={v3Assets.plateGuestPhone}
      leftLabel="只靠餐厅Wi‑Fi"
      leftBody="断网/信号弱就卡住"
      rightLabel="灵活安全"
      rightBody="4G/5G扫码即开；断网可连店内Wi‑Fi"
      delay={0}
    />
    <PhoneProof src={v3Assets.flowMenuDrinks} delay={20} label="扫码菜单" side="right" />
    <BottomCaption
      lines={["左：只靠Wi‑Fi易卡", "右：可切换网络更稳"]}
      delay={10}
    />
  </AbsoluteFill>
);

/**
 * End CTA — change only the Title + pillars (last add classic buffet & sushi buffet)
 * Keep the same contact + agent recruit sections as v3.
 */
export const V3bS09End: React.FC<
  AdProps
> = ({ contactLine: _contactLine, ctaLine, agentLine, agentSubline, whatsapps, wechats }) => {
  void _contactLine;
  return (
    <V3bS09EndImpl
      contactLine={_contactLine}
      ctaLine={ctaLine}
      agentLine={agentLine}
      agentSubline={agentSubline}
      whatsapps={whatsapps}
      wechats={wechats}
    />
  );
};

// ---- Copied end logic from v3, only changing Title and pillars ----
import { useCurrentFrame } from "remotion";

const V3bS09EndImpl: React.FC<
  AdProps
> = ({ contactLine: _contactLine, ctaLine, agentLine, agentSubline, whatsapps, wechats }) => {
  void _contactLine;
  const frame = useCurrentFrame();
  const pillars = [
    "减少数万欧元设备投入",
    "数据本地掌控 · 断网继续营业",
    "员工权限清晰 · 全程可追溯",
    "支持经典/寿司自助 · 价格自动执行",
  ];
  const phaseB = 150;
  const productOpacity = interpolate(frame, [phaseB - 12, phaseB + 6], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const agentOpacity = interpolate(frame, [phaseB, phaseB + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const contactOpacity = interpolate(
    frame,
    [88, 100, phaseB - 8, phaseB + 10],
    [0, 1, 1, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        justifyContent: "center",
        alignItems: "center",
        padding: "0 40px",
        gap: 10,
      }}
    >
      <Interactive.Div
        name="Glow"
        style={{
          position: "absolute",
          top: -80,
          width: 900,
          height: 900,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(212,168,67,0.3) 0%, transparent 65%)",
        }}
      />
      <Interactive.Div
        name="Logo"
        style={{
          fontFamily: fonts.display,
          fontSize: 84,
          color: colors.gold,
          fontWeight: 700,
          letterSpacing: "0.06em",
          opacity: interpolate(frame, [0, 10], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        FARVOO
      </Interactive.Div>

      <Interactive.Div
        name="Title"
        style={{
          fontFamily: fonts.zh,
          fontSize: 34,
          fontWeight: 800,
          color: colors.text,
          textAlign: "center",
          lineHeight: 1.4,
          opacity: interpolate(frame, [8, 20], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        经典 Buffet & 寿司自助
        <br />
        本地餐厅管理系统
      </Interactive.Div>

      {/* Phase A — product pillars + demo CTA */}
      <div
        style={{
          position: "absolute",
          left: 40,
          right: 40,
          top: 380,
          opacity: productOpacity,
          pointerEvents: productOpacity < 0.05 ? "none" : "auto",
        }}
      >
        {pillars.map((p, i) => {
          const t0 = 18 + i * 10;
          return (
            <Interactive.Div
              key={p}
              name={p}
              style={{
                marginTop: 8,
                padding: "12px 16px",
                borderRadius: 12,
                backgroundColor: "rgba(34,31,26,0.9)",
                border: `1px solid ${colors.goldDark}66`,
                fontFamily: fonts.zh,
                fontSize: 26,
                fontWeight: 700,
                color: colors.goldLight,
                textAlign: "center",
                opacity: interpolate(frame, [t0, t0 + 8], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              {p}
            </Interactive.Div>
          );
        })}

        <Interactive.Div
          name="CTA"
          style={{
            marginTop: 16,
            padding: "18px 36px",
            borderRadius: 999,
            backgroundColor: colors.gold,
            color: colors.bg,
            fontFamily: fonts.zh,
            fontSize: 34,
            fontWeight: 800,
            textAlign: "center",
            opacity: interpolate(frame, [70, 82], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          {ctaLine}
        </Interactive.Div>
      </div>

      {/* Phase B — agent recruit */}
      <Interactive.Div
        name="Agent"
        style={{
          position: "absolute",
          left: 40,
          right: 40,
          top: 420,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          opacity: agentOpacity,
          transform: `translateY(${interpolate(frame, [phaseB, phaseB + 14], [24, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })}px)`,
        }}
      >
        <div
          style={{
            width: "100%",
            padding: "28px 24px",
            borderRadius: 20,
            background:
              "linear-gradient(180deg, rgba(212,168,67,0.22) 0%, rgba(34,31,26,0.95) 100%)",
            border: `2px solid ${colors.gold}`,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: fonts.zh,
              fontSize: 52,
              fontWeight: 900,
              color: colors.gold,
              letterSpacing: "0.08em",
            }}
          >
            {agentLine}
          </div>
          <div
            style={{
              marginTop: 10,
              fontFamily: fonts.zh,
              fontSize: 28,
              fontWeight: 700,
              color: colors.text,
            }}
          >
            {agentSubline}
          </div>
        </div>
      </Interactive.Div>

      <Interactive.Div
        name="Contacts"
        style={{
          position: "absolute",
          left: 40,
          right: 40,
          bottom: 120,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          opacity: contactOpacity,
        }}
      >
        <div style={{ display: "flex", gap: 22 }}>
          {wechats.map((c) => (
            <div
              key={c.display}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
              }}
            >
              {/* We keep the same behavior as v3 (qrFile points to public/contact/*). */}
              <Img
                src={staticFile(c.qrFile)}
                style={{
                  width: 110,
                  height: 110,
                  borderRadius: 10,
                  border: `2px solid ${colors.goldDark}`,
                }}
              />
              <div
                style={{
                  fontFamily: fonts.zh,
                  fontSize: 24,
                  fontWeight: 800,
                  color: colors.goldLight,
                }}
              >
                {c.display}
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: fonts.zh, textAlign: "center" }}>
          {whatsapps.map((n) => (
            <div key={n} style={{ fontSize: 26, fontWeight: 800, color: colors.text }}>
              {n}
            </div>
          ))}
        </div>
      </Interactive.Div>
    </AbsoluteFill>
  );
};

