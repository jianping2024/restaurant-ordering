import React from "react";
import { Interactive } from "remotion";
import { colors, fonts } from "../theme";

const shell: React.CSSProperties = {
  position: "absolute",
  left: 70,
  right: 70,
  top: 160,
  height: 620,
  borderRadius: 28,
  overflow: "hidden",
  border: `3px solid ${colors.goldDark}`,
  backgroundColor: "#0F0E0C",
  boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
  display: "flex",
  flexDirection: "column",
};

export const MockMenuUI: React.FC = () => (
  <Interactive.Div name="Mock menu UI" style={shell}>
    <div
      style={{
        padding: "18px 20px",
        borderBottom: `1px solid ${colors.line}`,
        fontFamily: fonts.zh,
        color: colors.gold,
        fontWeight: 800,
        fontSize: 32,
      }}
    >
      FARVOO · 扫码菜单
    </div>
    <div style={{ padding: 16, overflow: "hidden" }}>
      {[
        ["宫保鸡丁", "€8.90"],
        ["酸辣汤", "€4.50"],
        ["扬州炒饭", "€6.80"],
        ["春卷 (4pcs)", "€5.20"],
        ["芒果布丁", "€3.90"],
      ].map(([name, price]) => (
        <div
          key={name}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "18px 14px",
            marginBottom: 10,
            borderRadius: 14,
            backgroundColor: "#1A1814",
            border: `1px solid ${colors.line}`,
            fontFamily: fonts.zh,
            color: colors.text,
            fontSize: 30,
            fontWeight: 700,
          }}
        >
          <span>{name}</span>
          <span style={{ color: colors.gold }}>{price}</span>
        </div>
      ))}
    </div>
    <div
      style={{
        padding: 16,
        backgroundColor: colors.gold,
        color: colors.bg,
        fontFamily: fonts.zh,
        fontWeight: 800,
        fontSize: 34,
        textAlign: "center",
      }}
    >
      加入订单 · 无需下载 APP
    </div>
  </Interactive.Div>
);

export const MockBoardUI: React.FC = () => (
  <Interactive.Div name="Mock board UI" style={shell}>
    <div
      style={{
        padding: "18px 20px",
        borderBottom: `1px solid ${colors.line}`,
        fontFamily: fonts.zh,
        color: colors.gold,
        fontWeight: 800,
        fontSize: 32,
      }}
    >
      服务员看板 · 本地运行中
    </div>
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12,
        padding: 16,
        
      }}
    >
      {[
        ["A12", "用餐中", "#22c55e"],
        ["B03", "待结账", "#f59e0b"],
        ["A07", "空台", "#6b7280"],
        ["C02", "用餐中", "#22c55e"],
        ["B11", "开台中", "#D4A843"],
        ["A01", "用餐中", "#22c55e"],
      ].map(([id, st, c]) => (
        <div
          key={id}
          style={{
            borderRadius: 14,
            padding: 16,
            backgroundColor: "#1A1814",
            border: `1px solid ${colors.line}`,
            fontFamily: fonts.zh,
          }}
        >
          <div style={{ fontSize: 36, fontWeight: 800, color: colors.text }}>
            {id}
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: c, marginTop: 8 }}>
            {st}
          </div>
        </div>
      ))}
    </div>
    <div
      style={{
        padding: 14,
        textAlign: "center",
        fontFamily: fonts.zh,
        fontSize: 26,
        color: colors.success,
        borderTop: `1px solid ${colors.line}`,
      }}
    >
      ● 断网模式 · 点餐收银可用
    </div>
  </Interactive.Div>
);

export const MockBuffetUI: React.FC = () => (
  <Interactive.Div name="Mock buffet UI" style={shell}>
    <div
      style={{
        padding: "18px 20px",
        borderBottom: `1px solid ${colors.line}`,
        fontFamily: fonts.zh,
        color: colors.gold,
        fontWeight: 800,
        fontSize: 32,
      }}
    >
      Buffet 价格规则
    </div>
    <div style={{ padding: 20 }}>
      {[
        ["工作日", "€11.90", false],
        ["周末", "€14.90", true],
        ["节假日", "€16.90", false],
      ].map(([label, price, on]) => (
        <div
          key={String(label)}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "22px 18px",
            marginBottom: 14,
            borderRadius: 14,
            backgroundColor: on ? "rgba(212,168,67,0.18)" : "#1A1814",
            border: on
              ? `2px solid ${colors.gold}`
              : `1px solid ${colors.line}`,
            fontFamily: fonts.zh,
            color: colors.text,
          }}
        >
          <span style={{ fontSize: 34, fontWeight: 700 }}>{label}</span>
          <span
            style={{
              fontSize: 40,
              fontWeight: 800,
              color: on ? colors.goldLight : colors.text,
            }}
          >
            {price}
          </span>
        </div>
      ))}
      <div
        style={{
          marginTop: 20,
          fontFamily: fonts.zh,
          fontSize: 28,
          color: colors.success,
          fontWeight: 700,
          textAlign: "center",
        }}
      >
        ✓ 今日已自动切换为周末价
      </div>
    </div>
  </Interactive.Div>
);
