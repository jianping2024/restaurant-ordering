# MesaGo 30s 短视频广告（竖屏）

严格按分镜：高峰痛点 → 扫码点餐 → 后台功能 → 厨房出单 → CTA。  
含实景/分镜画面、中文口播、BGM、转场音效。

## 成片

`out/mesago-ad.mp4`（1080×1920，约 30 秒）

## 分镜对照

| 时间 | 画面 | 字幕 / 口播 |
|------|------|-------------|
| 0–5s | 高峰厅面 + 服务员实拍 | 还在靠服务员一个个点餐？ |
| 5–10s | 扫桌边二维码 → 手机菜单 | 扫一扫，立即点餐 / 无需下载 APP |
| 10–18s | 老板手机后台 | ✅ Buffet 自动切换 / 开台后才能点 / 老板随时查看 |
| 18–25s | 炒锅实拍 + 出单票 | 减少人工 · 减少漏单 · 提高翻台率 |
| 25–30s | MesaGo Logo | 葡萄牙华人餐厅专用…预约免费演示 |

## 预览 / 导出

```bash
cd marketing/mesago-ad
npm run dev          # http://localhost:3333/MesaGoAd
npm run render       # → out/mesago-ad.mp4
```

联系方式：改 Studio 右侧 `contactLine`，或 `src/theme.ts` 的 `defaultAdProps`。

口播用 Edge TTS（`zh-CN-YunyangNeural`），素材在 `public/audio|images|video/`。
