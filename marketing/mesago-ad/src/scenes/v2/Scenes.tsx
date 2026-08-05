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
  BigNumber,
  Caption,
  ClickFlowUi,
  ContrastSplit,
  CoverVideo,
  assets,
} from "../../components/V2Visuals";
import { AdProps, colors, fonts } from "../../theme";

/** 经济：一块平板 €400 */
export const S01Price: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <CoverVideo src={assets.hallA} startFrom={30} dark={0.45} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 22 }}>
        <BigNumber label="现在一块平板" value="€400" delay={4} />
        <Interactive.Div
          name="Pillar"
          style={{
            fontFamily: fonts.zh,
            fontSize: 34,
            color: colors.goldLight,
            fontWeight: 700,
            opacity: interpolate(frame, [30, 44], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          经济
        </Interactive.Div>
      </AbsoluteFill>
      <Caption lines={["一块平板，四百欧"]} delay={14} />
    </AbsoluteFill>
  );
};

/** 经济：100 桌 ≈ €40,000 */
export const S02Total: React.FC = () => (
  <AbsoluteFill>
    <CoverVideo src={assets.hallB} startFrom={20} dark={0.5} />
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 16, padding: "0 48px" }}>
      <div
        style={{
          fontFamily: fonts.zh,
          fontSize: 42,
          color: colors.textMuted,
          fontWeight: 600,
        }}
      >
        Buffet · 100 桌起步
      </div>
      <BigNumber label="一桌一板 · 100 台" value="€40,000+" delay={12} />
    </AbsoluteFill>
    <Caption lines={["一百台板，四万欧起"]} delay={20} />
  </AbsoluteFill>
);

/** 便捷：实拍 hook → 中文菜单点击流 */
export const S03Menu: React.FC = () => {
  const frame = useCurrentFrame();
  const hookEnd = 7 * 30;
  const showApp = frame >= hookEnd;
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg }}>
      {!showApp ? (
        <>
          <Video
            src={assets.sy2Head}
            muted
            objectFit="cover"
            style={{ width: "100%", height: "100%" }}
          />
          <AbsoluteFill style={{ backgroundColor: "rgba(0,0,0,0.25)" }} />
          <Caption lines={["客人手机扫码点酒水"]} delay={12} size={34} />
        </>
      ) : (
        <>
          <CoverVideo src={assets.hallA} startFrom={180} dark={0.62} />
          <ClickFlowUi
            delay={hookEnd}
            cropTop={0.08}
            steps={[
              { src: assets.flowMenuHome, hold: 48, tap: { x: 0.55, y: 0.28 } },
              { src: assets.flowMenuDrinks, hold: 45, tap: { x: 0.88, y: 0.48 } },
              { src: assets.flowMenuAdded, hold: 70 },
            ]}
          />
          <ContrastSplit
            badTitle="旧做法"
            badBody="平板墙 €40,000+"
            goodTitle="FARVOO"
            goodBody="客人手机扫码点"
            delay={hookEnd + 6}
          />
          <Caption lines={["点一下 · 菜单跟着变 · 不用买平板"]} delay={hookEnd + 10} size={32} />
        </>
      )}
    </AbsoluteFill>
  );
};

/** 稳定：楼面看板 */
export const S04Local: React.FC = () => (
  <AbsoluteFill>
    <CoverVideo src={assets.hallB} startFrom={140} dark={0.58} />
    <ClickFlowUi
      delay={2}
      cropTop={0.02}
      steps={[
        { src: assets.flowBoardIdle, hold: 50 },
        { src: assets.flowBoardOpen, hold: 80 },
      ]}
    />
    <ContrastSplit
      badTitle="云点餐"
      badBody="外网一断就停"
      goodTitle="本地部署"
      goodBody="断网继续营业"
      delay={14}
    />
    <Caption lines={["稳定：数据在店里 · 外网挂了店不挂"]} delay={20} size={32} />
  </AbsoluteFill>
);

/** 安全：开台点击流 */
export const S05OpenTable: React.FC = () => (
  <AbsoluteFill>
    <CoverVideo src={assets.hallA} startFrom={360} dark={0.55} />
    <ClickFlowUi
      delay={2}
      cropTop={0.02}
      steps={[
        { src: assets.flowBoardIdle, hold: 42, tap: { x: 0.5, y: 0.58 } },
        { src: assets.flowOpenDialog, hold: 40, tap: { x: 0.82, y: 0.42 } },
        { src: assets.flowOpenAdult, hold: 42, tap: { x: 0.5, y: 0.72 } },
        { src: assets.flowBoardOpen, hold: 70 },
      ]}
    />
    <Caption lines={["安全：开台后，二维码才生效"]} delay={10} size={34} />
  </AbsoluteFill>
);

/** Buffet 价：设置页 → 时段 → 价目 */
export const S06Buffet: React.FC = () => (
  <AbsoluteFill>
    <CoverVideo src={assets.hallB} startFrom={280} dark={0.55} />
    <ClickFlowUi
      delay={2}
      cropTop={0.02}
      steps={[
        { src: assets.flowSettingsHub, hold: 40, tap: { x: 0.5, y: 0.38 } },
        { src: assets.uiBuffetSlots, hold: 48, tap: { x: 0.62, y: 0.18 } },
        { src: assets.uiBuffet, hold: 90 },
      ]}
    />
    <Caption lines={["工作日 / 周末 / 节假日，自动切换"]} delay={14} size={34} />
  </AbsoluteFill>
);

/** 便捷：手机看板全流程 */
export const S07MobileOps: React.FC = () => (
  <AbsoluteFill>
    <CoverVideo src={assets.hallA} startFrom={480} dark={0.62} />
    <ClickFlowUi
      delay={2}
      cropTop={0.02}
      steps={[
        { src: assets.flowDash, hold: 45, tap: { x: 0.5, y: 0.55 } },
        { src: assets.flowBoardIdle, hold: 45, tap: { x: 0.5, y: 0.58 } },
        { src: assets.flowBoardOpen, hold: 75 },
      ]}
    />
    <Caption lines={["便捷：手机点一下就能管店", "开台到收款，一部搞定"]} delay={10} size={32} />
  </AbsoluteFill>
);

/** 社会证明 — 不提具体店名 */
export const S08Proof: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        justifyContent: "center",
        alignItems: "center",
        padding: "0 48px",
        gap: 22,
      }}
    >
      <Interactive.Div
        name="Logo"
        style={{
          fontFamily: fonts.display,
          fontSize: 88,
          color: colors.gold,
          fontWeight: 700,
          letterSpacing: "0.06em",
          opacity: interpolate(frame, [0, 12], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        FARVOO
      </Interactive.Div>
      <div
        style={{
          fontFamily: fonts.zh,
          fontSize: 38,
          fontWeight: 800,
          color: colors.text,
          textAlign: "center",
          lineHeight: 1.45,
          opacity: interpolate(frame, [12, 24], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        葡萄牙大型中餐自助
        <br />
        已入住 · 稳定使用中
      </div>
      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 8,
          opacity: interpolate(frame, [22, 34], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        {(["经济", "安全", "稳定", "便捷"] as const).map((pill) => (
          <div
            key={pill}
            style={{
              padding: "12px 20px",
              borderRadius: 999,
              border: `2px solid ${colors.goldDark}`,
              backgroundColor: "rgba(212,168,67,0.12)",
              fontFamily: fonts.zh,
              fontSize: 28,
              fontWeight: 800,
              color: colors.goldLight,
            }}
          >
            {pill}
          </div>
        ))}
      </div>
      <Caption lines={["专为大型 Buffet 餐厅打造"]} delay={30} size={34} />
    </AbsoluteFill>
  );
};

/** CTA */
export const S09End: React.FC<AdProps> = ({ ctaLine, whatsapps, wechats }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        justifyContent: "center",
        alignItems: "center",
        padding: "0 48px",
        gap: 12,
      }}
    >
      <Interactive.Div
        name="Glow"
        style={{
          position: "absolute",
          top: -100,
          width: 900,
          height: 900,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(212,168,67,0.32) 0%, transparent 65%)",
        }}
      />
      <Interactive.Div
        name="Logo"
        style={{
          fontFamily: fonts.display,
          fontSize: 92,
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
        name="Tag"
        style={{
          fontFamily: fonts.zh,
          fontSize: 30,
          color: colors.text,
          fontWeight: 700,
          textAlign: "center",
          opacity: interpolate(frame, [10, 22], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        葡萄牙大型中餐自助 · 专业运营系统
      </Interactive.Div>
      <Interactive.Div
        name="Bars"
        style={{
          marginTop: 4,
          fontFamily: fonts.zh,
          fontSize: 24,
          color: colors.textMuted,
          textAlign: "center",
          lineHeight: 1.6,
          opacity: interpolate(frame, [20, 32], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        经济 · 安全 · 稳定 · 便捷
        <br />
        已入住大型自助餐厅 · 稳定使用中
      </Interactive.Div>

      <Interactive.Div
        name="CTA"
        style={{
          marginTop: 16,
          padding: "20px 40px",
          borderRadius: 999,
          backgroundColor: colors.gold,
          color: colors.bg,
          fontFamily: fonts.zh,
          fontSize: 36,
          fontWeight: 800,
          opacity: interpolate(frame, [32, 44], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        {ctaLine}
      </Interactive.Div>

      <Interactive.Div
        name="Contacts"
        style={{
          marginTop: 14,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          opacity: interpolate(frame, [28, 40], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div style={{ fontFamily: fonts.zh, fontSize: 24, color: colors.textMuted, fontWeight: 600 }}>
          微信
        </div>
        <div style={{ display: "flex", gap: 28 }}>
          {wechats.map((c) => (
            <div
              key={c.display}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Img
                src={staticFile(c.qrFile)}
                style={{
                  width: 148,
                  height: 148,
                  borderRadius: 12,
                  border: `2px solid ${colors.goldDark}`,
                }}
              />
              <div
                style={{
                  fontFamily: fonts.zh,
                  fontSize: 30,
                  fontWeight: 800,
                  color: colors.goldLight,
                }}
              >
                {c.display}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 2, fontFamily: fonts.zh, textAlign: "center" }}>
          <div style={{ fontSize: 24, color: colors.textMuted, marginBottom: 8, fontWeight: 600 }}>
            WhatsApp
          </div>
          {whatsapps.map((n) => (
            <div
              key={n}
              style={{
                fontSize: 30,
                fontWeight: 800,
                color: colors.text,
                lineHeight: 1.45,
              }}
            >
              {n}
            </div>
          ))}
        </div>
      </Interactive.Div>
    </AbsoluteFill>
  );
};

export const S08End = S09End;
export const S07Devices = S07MobileOps;
