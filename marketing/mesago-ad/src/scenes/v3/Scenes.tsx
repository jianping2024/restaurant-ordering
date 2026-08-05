import React from "react";
import {
  AbsoluteFill,
  Img,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { Video } from "@remotion/media";
import {
  BottomCaption,
  BulletStack,
  PhoneProof,
  VsSplit,
  v3Assets,
} from "../../components/V3Visuals";
import { DualDevice } from "../../components/V2Visuals";
import { AdProps, colors, fonts } from "../../theme";

/** 0–8s 开店成本 */
export const V3S01Cost: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg }}>
      <VsSplit
        leftSrc={v3Assets.plateTablets}
        rightSrc={v3Assets.plateScan}
        leftLabel="传统平板方案"
        leftBody="100桌 × €400 = €40,000"
        rightLabel="本地安装方案"
        rightBody="顾客扫码 · 无需每桌平板"
        delay={0}
      />
      <Interactive.Div
        name="Cost calc"
        style={{
          position: "absolute",
          left: 40,
          right: 40,
          top: 420,
          padding: "22px 20px",
          borderRadius: 18,
          backgroundColor: "rgba(15,14,12,0.88)",
          border: `1px solid ${colors.goldDark}`,
          opacity: interpolate(frame, [40, 55], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: fonts.zh,
            fontSize: 28,
            color: colors.textMuted,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          仅设备采购
        </div>
        <div
          style={{
            fontFamily: fonts.display,
            fontSize: 92,
            color: colors.gold,
            fontWeight: 700,
          }}
        >
          €40,000
        </div>
        <div
          style={{
            marginTop: 10,
            fontFamily: fonts.zh,
            fontSize: 26,
            color: colors.danger,
            fontWeight: 700,
          }}
        >
          + 支架 · 充电 · 备用 · 维修 · 更换
        </div>
      </Interactive.Div>
      <BottomCaption lines={["左：约四万欧平板墙", "右：无需每桌专用平板"]} delay={18} />
    </AbsoluteFill>
  );
};

/** 8–15s 断网仍可营业 */
export const V3S02Offline: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: colors.bg }}>
    <VsSplit
      leftSrc={v3Assets.plateOffline}
      rightSrc={v3Assets.flowBoardOpen}
      leftLabel="完全依赖外网"
      leftBody="断网：下单结账中断"
      rightLabel="本地系统"
      rightBody="外网挂了，店照常营业"
      delay={0}
    />
    <PhoneProof src={v3Assets.flowBoardOpen} delay={18} label="本地看板" side="right" />
    <BottomCaption lines={["左：营业流程中断", "右：照常下单结账"]} delay={10} />
  </AbsoluteFill>
);

/** 15–26s 角色权限与留痕 */
export const V3S03Roles: React.FC = () => {
  const frame = useCurrentFrame();
  const showGood = frame >= 55;
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg }}>
      {!showGood ? (
        <>
          <Img
            src={v3Assets.plateOffline}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <AbsoluteFill style={{ backgroundColor: "rgba(40,10,10,0.55)" }} />
          <BulletStack
            tone="bad"
            delay={8}
            items={[
              "换桌靠口头通知",
              "并台写在纸上",
              "结账对不上账",
              "出了问题难追查",
            ]}
          />
          <BottomCaption lines={["靠口头沟通，难追责"]} delay={6} />
        </>
      ) : (
        <>
          <Img
            src={v3Assets.plateStaffPhone}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
          <AbsoluteFill style={{ backgroundColor: "rgba(8,20,14,0.55)" }} />
          <BulletStack
            tone="good"
            delay={58}
            items={[
              "服务员：开台 · 转台 · 并台 · 点单",
              "收银员：核单 · 收款 · 结账",
              "每步记录员工 · 时间 · 内容",
            ]}
          />
          <BottomCaption lines={["分角色操作，全流程有记录"]} delay={60} />
        </>
      )}
    </AbsoluteFill>
  );
};

/** 26–33s 顾客扫码不依赖 Wi-Fi */
export const V3S04GuestNet: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: colors.bg }}>
    <VsSplit
      leftSrc={v3Assets.fallbackBusy}
      rightSrc={v3Assets.plateGuestPhone}
      leftLabel="依赖餐厅 Wi-Fi"
      leftBody="先问密码 · 再等加载"
      rightLabel="顾客自己的网络"
      rightBody="4G / 5G 扫码即开"
      delay={0}
    />
    <PhoneProof src={v3Assets.flowMenuHome} delay={20} label="扫码菜单" side="right" />
    <BottomCaption lines={["左：先连 Wi-Fi", "右：扫码即开，流畅快速"]} delay={10} />
  </AbsoluteFill>
);

/** 33–41s 电脑手机协同 */
export const V3S05Devices: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: colors.bg }}>
    <Img
      src={v3Assets.plateStaffPhone}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
    <AbsoluteFill style={{ backgroundColor: "rgba(10,10,8,0.55)" }} />
    <DualDevice
      phoneSrc={v3Assets.uiBoard}
      desktopSrc={v3Assets.uiBoardDesktop}
      delay={6}
    />
    <BottomCaption
      lines={["左：反复跑前台排队", "右：现场手机直接处理"]}
      delay={12}
    />
  </AbsoluteFill>
);

/** 41–48s 价格自动执行（老板后台真实设置） */
export const V3S06Prices: React.FC = () => {
  const frame = useCurrentFrame();
  const showUi = frame >= 40;
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg }}>
      {!showUi ? (
        <>
          <VsSplit
            leftSrc={v3Assets.fallbackBusy}
            rightSrc={v3Assets.uiBuffet}
            leftLabel="每天人工改价"
            leftBody="漏改 · 错价 · 各端不一致"
            rightLabel="系统自动切换"
            rightBody="提前设置，到点执行"
            delay={0}
          />
          <BottomCaption lines={["提前设置，自动准确执行"]} delay={12} />
        </>
      ) : (
        <>
          <Img
            src={v3Assets.flowBuffetHub}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "top",
            }}
          />
          <AbsoluteFill style={{ backgroundColor: "rgba(10,8,6,0.35)" }} />
          <PhoneProof src={v3Assets.uiBuffet} delay={42} label="Buffet 价目" />
          <BottomCaption
            lines={["工作日 / 周末 / 节假日 / 分时段"]}
            delay={44}
          />
        </>
      )}
    </AbsoluteFill>
  );
};

/** 48–55s 订单历史可追溯 */
export const V3S07History: React.FC = () => {
  const frame = useCurrentFrame();
  const showDetail = frame >= 70;
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg }}>
      {!showDetail ? (
        <>
          <VsSplit
            leftSrc={v3Assets.fallbackBusy}
            rightSrc={v3Assets.flowOrderHistory}
            leftLabel="纸质 / 口头记录"
            leftBody="事后对不上 · 难追查"
            rightLabel="订单历史"
            rightBody="开台到关台，列表可查"
            delay={0}
          />
          <PhoneProof
            src={v3Assets.flowOrderHistory}
            delay={18}
            label="历史列表"
            side="right"
          />
          <BottomCaption lines={["点进任意记录，查看完整详情"]} delay={12} />
        </>
      ) : (
        <>
          <Img
            src={v3Assets.flowOrderHistory}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "top",
              filter: "brightness(0.45)",
            }}
          />
          <PhoneProof
            src={v3Assets.flowOrderHistoryDetail}
            delay={72}
            label="历史详情"
          />
          <BottomCaption
            lines={["桌 001 · 开台到结账 · 全程留痕"]}
            delay={76}
          />
        </>
      )}
    </AbsoluteFill>
  );
};

/** 55–63s 已落地大型 Buffet — 真实店面 p1/p2/p3 + 实拍剪辑 */
export const V3S08Proof: React.FC = () => {
  const frame = useCurrentFrame();
  const photo =
    frame < 28 ? v3Assets.proofP1 : frame < 56 ? v3Assets.proofP2 : v3Assets.proofP3;
  const showVideo = frame >= 72;
  const showM2 = frame >= 150;
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg }}>
      {!showVideo ? (
        <Img
          src={photo}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
            scale: interpolate(frame, [0, 70], [1.04, 1.12], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              output: "perceptual-scale",
            }),
          }}
        />
      ) : (
        <Video
          key={showM2 ? "m2" : "m1"}
          src={showM2 ? v3Assets.proofM2 : v3Assets.proofM1}
          muted
          objectFit="cover"
          style={{ width: "100%", height: "100%" }}
        />
      )}
      <AbsoluteFill style={{ backgroundColor: "rgba(8,6,4,0.42)" }} />
      <Interactive.Div
        name="Proof copy"
        style={{
          position: "absolute",
          left: 40,
          right: 40,
          top: 200,
          textAlign: "center",
          opacity: interpolate(frame, [6, 18], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div
          style={{
            fontFamily: fonts.zh,
            fontSize: 28,
            color: colors.goldLight,
            fontWeight: 700,
            marginBottom: 14,
          }}
        >
          已落地 · 稳定使用中
        </div>
        <div
          style={{
            fontFamily: fonts.zh,
            fontSize: 44,
            color: colors.text,
            fontWeight: 900,
            lineHeight: 1.35,
          }}
        >
          葡萄牙大型中餐自助
          <br />
          真实门店在用
        </div>
      </Interactive.Div>
      <div
        style={{
          position: "absolute",
          left: 36,
          right: 36,
          bottom: 280,
          display: "flex",
          gap: 10,
          opacity: interpolate(frame, [18, 30], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        {[v3Assets.proofP1, v3Assets.proofP2, v3Assets.proofP3].map((src) => (
          <Img
            key={src}
            src={src}
            style={{
              flexGrow: 1,
              height: 160,
              objectFit: "cover",
              borderRadius: 12,
              border: `2px solid ${colors.goldDark}`,
            }}
          />
        ))}
      </div>
      <BottomCaption lines={["少投入 · 不断网 · 流程可追溯"]} delay={24} />
    </AbsoluteFill>
  );
};

/**
 * End CTA — two phases:
 * A (~0–5s) product close + 预约演示
 * B (~5–14s) 诚招代理 + same contact channels
 */
export const V3S09End: React.FC<AdProps> = ({
  ctaLine,
  agentLine,
  agentSubline,
  whatsapps,
  wechats,
}) => {
  const frame = useCurrentFrame();
  const pillars = [
    "减少数万欧元设备投入",
    "数据本地掌控 · 断网继续营业",
    "员工权限清晰 · 全程可追溯",
    "价格自动执行 · 订单历史可追溯",
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
          background:
            "radial-gradient(circle, rgba(212,168,67,0.3) 0%, transparent 65%)",
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
        为大型 Buffet 设计的
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
            <div
              key={n}
              style={{ fontSize: 26, fontWeight: 800, color: colors.text }}
            >
              {n}
            </div>
          ))}
        </div>
        <div
          style={{
            fontFamily: fonts.zh,
            fontSize: 22,
            color: colors.textMuted,
            textAlign: "center",
            marginTop: 4,
          }}
        >
          本地安装为主 · 另提供云端方案
        </div>
      </Interactive.Div>
    </AbsoluteFill>
  );
};
