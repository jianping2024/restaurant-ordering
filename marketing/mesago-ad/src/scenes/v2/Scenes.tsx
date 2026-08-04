import React from "react";
import {
  AbsoluteFill,
  Img,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import {
  BigNumber,
  Caption,
  ContrastSplit,
  CoverVideo,
  DualDevice,
  FullUi,
  assets,
} from "../../components/V2Visuals";
import { AdProps, colors, fonts } from "../../theme";

/** 算账：一块平板 €400 — 厅面实拍 */
export const S01Price: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <CoverVideo src={assets.hallA} startFrom={30} dark={0.45} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 22 }}>
        <BigNumber label="现在一块平板" value="€400" delay={4} />
        <Interactive.Div
          name="Sub"
          style={{
            fontFamily: fonts.zh,
            fontSize: 40,
            color: colors.text,
            fontWeight: 700,
            opacity: interpolate(frame, [36, 50], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          配件价格疯涨
        </Interactive.Div>
      </AbsoluteFill>
      <Caption lines={["一块平板，四百欧"]} delay={14} />
    </AbsoluteFill>
  );
};

/** 算账：一桌一板 · 150 台 ≈ €60,000 */
export const S02Total: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      <CoverVideo src={assets.hallB} startFrom={20} dark={0.5} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", gap: 16, padding: "0 48px" }}>
        <Interactive.Div
          name="Tables"
          style={{
            fontFamily: fonts.zh,
            fontSize: 42,
            color: colors.textMuted,
            fontWeight: 600,
            opacity: interpolate(frame, [0, 10], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          Buffet · 150 桌起步
        </Interactive.Div>
        <BigNumber label="一桌一板 · 150 台" value="€60,000+" delay={12} />
      </AbsoluteFill>
      <Caption lines={["一百五十台板，六万欧起"]} delay={20} />
    </AbsoluteFill>
  );
};

/** 客人手机扫码菜单（中文真实界面） */
export const S03Menu: React.FC = () => (
  <AbsoluteFill>
    <CoverVideo src={assets.hallA} startFrom={180} dark={0.58} />
    <FullUi src={assets.uiMenu} delay={2} cropTop={0.18} />
    <ContrastSplit
      badTitle="旧做法"
      badBody="平板墙 €60,000+"
      goodTitle="MesaGo"
      goodBody="客人手机扫码"
      delay={20}
    />
    <Caption lines={["扫码菜单 · 不用买平板 · 不必连店 Wi‑Fi"]} delay={28} size={34} />
  </AbsoluteFill>
);

/** 本地部署 / 断网 — 楼面看板 */
export const S04Local: React.FC = () => (
  <AbsoluteFill>
    <CoverVideo src={assets.hallB} startFrom={140} dark={0.58} />
    <FullUi src={assets.uiBoard} delay={2} cropTop={0.16} />
    <ContrastSplit
      badTitle="云点餐"
      badBody="外网一断就停"
      goodTitle="本地部署"
      goodBody="断网继续营业"
      delay={18}
    />
    <Caption lines={["数据在自己店里 · 外网挂了店不用挂"]} delay={26} size={34} />
  </AbsoluteFill>
);

/** 开台后才能点 — 看板「开台」 */
export const S05OpenTable: React.FC = () => (
  <AbsoluteFill>
    <CoverVideo src={assets.hallA} startFrom={360} dark={0.55} />
    <FullUi src={assets.uiBoard} delay={2} cropTop={0.2} />
    <ContrastSplit
      badTitle="普通桌码"
      badBody="带走也能点"
      goodTitle="MesaGo"
      goodBody="开台后才能点"
      delay={12}
    />
    <Caption lines={["开台后，二维码才生效"]} delay={18} />
  </AbsoluteFill>
);

/** Buffet 价目 / 时段设置（下半价目表模糊，避免露出演示价） */
export const S06Buffet: React.FC = () => (
  <AbsoluteFill>
    <CoverVideo src={assets.hallB} startFrom={280} dark={0.55} />
    <FullUi src={assets.uiBuffet} delay={2} cropTop={0.06} blurBottom={0.48} />
    <Caption lines={["工作日 / 周末 / 节假日，一次设置自动切换"]} delay={16} size={34} />
  </AbsoluteFill>
);

/** 电脑 + 手机都能管 */
export const S07Devices: React.FC = () => (
  <AbsoluteFill>
    <CoverVideo src={assets.hallA} startFrom={480} dark={0.62} />
    <DualDevice
      phoneSrc={assets.uiDashMobile}
      desktopSrc={assets.uiBoardDesktop}
      delay={2}
    />
    <Caption lines={["电脑、手机都能管", "开台到收款，一部手机就能做完"]} delay={14} size={34} />
  </AbsoluteFill>
);

/** CTA */
export const S08End: React.FC<AdProps> = ({
  contactLine,
  ctaLine,
  whatsapps,
  wechats,
}) => {
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
        MesaGo
      </Interactive.Div>
      <Interactive.Div
        name="Tag"
        style={{
          fontFamily: fonts.zh,
          fontSize: 32,
          color: colors.text,
          fontWeight: 700,
          textAlign: "center",
          opacity: interpolate(frame, [10, 22], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        葡萄牙华人餐厅专用点餐系统
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
        不用平板 · 本地部署 · 断网可营业
        <br />
        手机电脑都能管 · 开台才能点
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
          gap: 16,
          opacity: interpolate(frame, [28, 40], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div
          style={{
            fontFamily: fonts.zh,
            fontSize: 24,
            color: colors.textMuted,
            fontWeight: 600,
          }}
        >
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

        <div
          style={{
            marginTop: 4,
            fontFamily: fonts.zh,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 24,
              color: colors.textMuted,
              marginBottom: 8,
              fontWeight: 600,
            }}
          >
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

        <div
          style={{
            fontFamily: fonts.zh,
            fontSize: 20,
            color: colors.textMuted,
            textAlign: "center",
            maxWidth: 920,
            lineHeight: 1.4,
          }}
        >
          {contactLine}
        </div>
      </Interactive.Div>
    </AbsoluteFill>
  );
};
