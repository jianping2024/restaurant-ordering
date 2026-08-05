# PWA / 添加到主屏幕 — 图标尺寸与设计规范

> **状态**：2026-07-15  
> **读者**：设计、前端、AI 图像生成  
> **用途**：生成 FARVOO Web App 在 iOS / Android「添加到主屏幕」所需的全部图标资产

关联文档：[`01-design-principles.md`](./01-design-principles.md)、[`04-mobile-rules.md`](./04-mobile-rules.md)

---

## 1. 产品背景

| 项 | 值 |
|---|---|
| 产品名 | **FARVOO** |
| 定位 | 葡萄牙餐厅点餐 SaaS（扫码点餐、厨房显示、分单结账） |
| 主屏入口角色 | 服务员 `/waiter`、厨房 `/kitchen`、老板 `/dashboard` |
| 技术栈 | Next.js Web App（非 App Store 原生应用） |
| 离线 | **不支持**离线；图标仅用于桌面快捷方式与全屏打开 |

### 门店安装（install-only，无离线）

- **要做什么：** 桌面壳（无浏览器顶栏、无「不安全」提示）。**仅员工登录页**（`AuthLoginForm` → `StaffPwaInstallPrompt`）：有浏览器安装信号时显示「安装到桌面」；否则短句 +「如何安装？」打开步骤 Modal。Chrome 步骤唯一源是 `staffPwaInstall.steps`：⋮ →「Cast, save and share / 投射、保存和分享」→「Install page as app…」；备选 ⋮ →「More tools / 更多工具」→「Create shortcut…」并勾选「Open as window」。请用 localhost/HTTPS（局域网 `http://IP` 常无安装项）。iOS：分享 →「添加到主屏幕」。装完后从桌面图标打开，勿继续用浏览器标签。
- **不要做什么：** Service Worker、离线缓存、断网点餐。勿在代码里试图隐藏浏览器「Not secure」——只有 standalone 或 HTTPS 能解决。已登录 dashboard **不**挂安装提示。
- **谁看到安装提示：** 仅员工登录表单（`AuthLoginForm`，含 `StoreStaffLoginClient` 门店登录）；顾客扫码菜单与 `DashboardShell` 不挂。
- **链接打开：**
  - 从浏览器 / 扫码打开同站 URL：manifest `handle_links: not-preferred`，应留在浏览器，不自动跳进已装 App。已安装用户若仍被劫持：`chrome://apps` 卸载重装，或在该应用设置里关闭「用应用打开链接」。
  - **在已装 App 内**点「打开点餐页 / 打开登录页」：不得再开第二个 App 窗。唯一写法 → `openHttpUrlPreferBrowser` + `PreferBrowserHttpLink`（非 standalone 新开浏览器标签；standalone 只复制链接并 toast 提示去浏览器粘贴）。
- **实现唯一源：** manifest → `lib/pwa/site-manifest.ts`（含 `PWA_START_URL=/dashboard`、主题/启动底色、`PWA_ICON_PATHS`）；是否已安装 / 展示哪类 CTA → `lib/pwa/install-display.ts`（`STANDALONE_DISPLAY_MEDIA_QUERIES` + `hidden` | `browser_prompt` | `manual_entry`）+ `use-pwa-install.ts`；冷启动品牌壳 → `lib/pwa/launch-shell.ts`（style/boot：`off→in→hold→out`，`PWA_LAUNCH_FADE_MS` / `PWA_LAUNCH_HOLD_MS` / `PWA_LAUNCH_MARK_PX` 各一份）+ `app/layout.tsx` 唯一 DOM（深底+大号 `PWA_ICON_PATHS.any192`，仅 standalone；无第二套 splash 色/图/时长常量）；安装 UI → `components/pwa/StaffPwaInstallPrompt.tsx`（仅登录页）；步骤文案 → `staffPwaInstall.steps`（无并行 `authLogin.pwaInstall` / `manualHint`）；App 内打开顾客/扫码 URL → `lib/pwa/open-prefer-browser.ts` + `components/pwa/PreferBrowserHttpLink.tsx`。
- **冷启动入口：** `start_url` 为 `/dashboard`（未登录 middleware 进登录；已登录少一次 login→工作台跳转）。系统 splash 与 HTML 首绘壳共用 `PWA_BACKGROUND_COLOR`（`#0F0E0C`）。HTML 到达后品牌层为加载仪式：淡入 → 停留 → 淡出（约 1.6s），不是闪一下。网页未到之前的系统启动页（尤其 iOS）仍可能是纯色——要系统级带图需另做 `apple-touch-startup-image`。

---

## 2. 设计风格要求（给 AI 的硬性约束）

### 2.1 整体方向

- **风格**：现代、专业、餐馆 SaaS；偏 **极简几何** 或 **字母标（F）**，不要复杂插画
- **气质**：可靠、高效、略具葡萄牙/欧式餐馆的 **金色点缀**；避免卡通、渐变霓虹、3D 拟物
- **识别性**：在 **48×48** 缩略图下仍可辨认；不要细线、小字、复杂纹理
- **禁止**：真实食物摄影、过多文字（除单个字母外）、透明背景、设计稿预加圆角/阴影

### 2.2 品牌色（须严格使用）

图标 **背景** 与 **前景** 从下列色板选取；推荐 **深底 + 金标**（与 App 默认暗色主题一致）。

#### 暗色主题（推荐作为图标主方案）

| 令牌 | RGB | HEX | 用途 |
|------|-----|-----|------|
| `brand-bg` | 15, 14, 12 | `#0F0E0C` | 图标背景（主推） |
| `brand-gold` | 212, 168, 67 | `#D4A843` | Logo 图形 / 字母主色 |
| `brand-gold-light` | 232, 192, 106 | `#E8C06A` | 高光、渐变上限（可选） |
| `brand-gold-dark` | 184, 144, 47 | `#B8902F` | 阴影、渐变下限（可选） |
| `brand-text` | 245, 240, 232 | `#F5F0E8` | 若用白色系字母替代金色 |

#### 浅色备选方案（可选第二套）

| 令牌 | HEX | 用途 |
|------|-----|------|
| `brand-bg` | `#F7F4ED` | 浅底图标（部分 Android 启动页） |
| `brand-gold` | `#8E660B` | 浅底上的 Logo 色 |

**默认只交付暗色方案即可**；浅色为可选。

### 2.3 构图规则

| 规则 | 说明 |
|------|------|
| 画布比例 | **1:1 正方形** |
| 安全区（普通 icon） | 图形主体占画布 **~80%**，四边各留 **~10%** 呼吸空间 |
| 安全区（maskable） | 图形主体仅占中心 **~60%**（直径圆内），**四周 20%** 可能被 Android 裁成圆/方/水滴形 |
| 圆角 | **导出文件必须为直角正方形**；iOS/Android 系统自动加圆角 |
| 背景 | **必须不透明**（PNG，无 alpha 透明底） |
| 格式 | **PNG-24**，sRGB，无 interlacing |
| 边缘 | 无描边光晕；避免贴边 |

### 2.4 Logo 创意方向（三选一，AI 生成时指定）

**方案 A — 字母标（推荐）**  
- 深底 `#0F0E0C` + 金色 `#D4A843` 粗体 **「M」** 或 **「MG」**  
- 字形：几何无衬线，略宽，类似 Jost 气质（不必完全一致）

**方案 B — 符号标**  
- 深底 + 金色 **餐盘 + 简笔叉** 或 **二维码角标 + 圆盘** 组合  
- 线宽 ≥ 画布 8%，避免细线

**方案 C — 文字标**  
- 深底 + 金色 **「FARVOO」** 仅在小尺寸（≥512）可读；192/180 需仍能用 **「F」** 识别  
- 若选 C，须同时交付 **字母标变体** 供小尺寸使用

### 2.5 交付前视觉 QA

- [ ] 48×48 预览仍可识别  
- [ ] 192×192 预览清晰无锯齿  
- [ ] maskable 512 在 **圆形遮罩** 内完整（见 §6 测试法）  
- [ ] 与浏览器 favicon 小图标风格一致  
- [ ] 无透明像素、无预圆角、无 drop shadow  baked in  

---

## 3. 尺寸总览（按优先级）

### 3.1 必做 — 最小可上线集（7 个文件）

| 文件名 | 尺寸 (px) | 平台 | 用途 |
|--------|-----------|------|------|
| `favicon.ico` | 16, 32, 48（多尺寸 ICO） | Web | 浏览器标签页 |
| `icon-180.png` | **180 × 180** | iOS | Safari「添加到主屏幕」 |
| `icon-192.png` | **192 × 192** | Android | 主屏幕、Chrome 安装提示 |
| `icon-512.png` | **512 × 512** | Android / PWA | 安装横幅、启动图、manifest |
| `icon-512-maskable.png` | **512 × 512** | Android | 自适应图标（maskable） |
| `icon-1024.png` | **1024 × 1024** | 母版 | 设计源、将来 App Store / 营销 |
| `icon.svg` | 矢量（可选） | Web | Next.js `icon.svg` 自动生成 favicon |

> **实践建议**：从 `icon-1024.png` 等比缩小生成 512 / 192 / 180；maskable 单独构图（§6）。

### 3.2 推荐 — iOS 全尺寸（Web App / Apple 生态）

iOS 从 `apple-touch-icon` 自动缩放，但 **全尺寸交付** 可避免极端设备模糊。

| 文件名 | 尺寸 (px) | 设备/场景 |
|--------|-----------|-----------|
| `apple-icon-180.png` | **180 × 180** | iPhone @3x（**最重要**） |
| `apple-icon-167.png` | **167 × 167** | iPad Pro |
| `apple-icon-152.png` | **152 × 152** | iPad @2x |
| `apple-icon-120.png` | **120 × 120** | iPhone @2x（旧款/兼容） |
| `apple-icon-76.png` | **76 × 76** | iPad 非 Retina（兼容） |
| `apple-icon-60.png` | **60 × 60** | iPhone 非 Retina（兼容） |

**iOS 系统 UI 小图标（可选，原生 App 才常用；Web 一般可跳过）**

| 尺寸 | 场景 |
|------|------|
| 87 × 87 | iPhone Settings |
| 80 × 80 | iPad Settings @2x |
| 58 × 58 | Settings @2x |
| 40 × 40 | Spotlight @2x |
| 29 × 29 | Settings @1x |
| 20 × 20 | Notification |

**Web PWA 实际上 iOS 只强依赖 180×180**；上表「推荐」段覆盖常见 iPad/iPhone。

### 3.3 推荐 — Android 全尺寸（密度桶 + PWA）

#### PWA Manifest（Chrome 安装）

| 文件名 | 尺寸 | `purpose` | 说明 |
|--------|------|-----------|------|
| `icon-192.png` | 192 × 192 | `any` | **manifest 必填** |
| `icon-512.png` | 512 × 512 | `any` | **manifest 必填** |
| `icon-512-maskable.png` | 512 × 512 | `maskable` | 自适应图标，强烈推荐 |

#### Android 启动器密度桶（原生 APK 标准；PWA 可选）

从 xxxhdpi 192 可向下缩放；若只做 PWA，**192 + 512 足够**。

| 密度 | 比例 | 尺寸 (px) | 文件名示例 |
|------|------|-----------|------------|
| mdpi | 1× | 48 × 48 | `android-mdpi-48.png` |
| hdpi | 1.5× | 72 × 72 | `android-hdpi-72.png` |
| xhdpi | 2× | 96 × 96 | `android-xhdpi-96.png` |
| xxhdpi | 3× | 144 × 144 | `android-xxhdpi-144.png` |
| xxxhdpi | 4× | 192 × 192 | `android-xxxhdpi-192.png` |

#### Google Play / TWA（若将来上架）

| 尺寸 | 用途 |
|------|------|
| 512 × 512 | Play Store 高清图标 |
| 1024 × 500 | Feature Graphic（横幅，非图标） |

### 3.4 Web 通用补充

| 文件名 | 尺寸 | 用途 |
|--------|------|------|
| `favicon-16.png` | 16 × 16 | 标签页 |
| `favicon-32.png` | 32 × 32 | 标签页 Retina |
| `icon-384.png` | 384 × 384 | 部分 Android 启动页 |
| `icon-256.png` | 256 × 256 | Windows pinned tile（可选） |

---

## 4. 与 Next.js 项目文件映射（已落地）

```
apps/web/src/app/
  favicon.ico
  icon.png                 ← 512×512
  apple-icon.png           ← 180×180
  manifest.ts              ← 入口
apps/web/src/lib/pwa/
  site-manifest.ts         ← manifest 字段单一来源
apps/web/public/icons/
  icon-192.png
  icon-512.png
  icon-512-maskable.png
```

`manifest.ts` 最小配置：

```typescript
icons: [
  { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
  { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
  { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
]
```

---

## 5. AI 生成提示词模板

复制以下模板，替换 `{方案}` 为 A / B / C。

### 5.1 母版 1024×1024（普通 icon）

```text
Design a square app icon for "FARVOO", a professional restaurant ordering SaaS for Portuguese restaurants.

Style: minimal, flat, modern B2B SaaS. No photorealistic food, no 3D, no neon gradients, no cartoon.
Logo direction: {方案 — e.g. bold geometric letter "M" in gold on dark background}.

Colors (exact):
- Background: solid #0F0E0C (dark warm black), fully opaque
- Foreground/logo: #D4A843 (warm gold)

Composition:
- 1:1 square canvas
- Logo centered, occupying ~80% of canvas with ~10% padding on each side
- NO rounded corners in the export (system will clip)
- NO transparency, NO drop shadow baked in
- Thick shapes readable at 48px thumbnail

Output: 1024×1024 PNG, sRGB, crisp edges, app icon for iOS and Android home screen.
```

### 5.2 Maskable 512×512（Android 自适应）

```text
Same FARVOO app icon as before, but for Android adaptive icon (maskable).

Background: solid #0F0E0C full bleed to all edges.
Logo: gold #D4A843, centered in the middle 60% only — keep all important shapes inside a centered circle of 60% diameter.
Outer 20% margin on each side must be empty or solid background only (will be cropped to circle/squircle).
512×512 PNG, opaque, no rounded corners, no shadow.
```

### 5.3 批量缩小（给 AI 或脚本）

若 AI 支持「从 1024 导出全尺寸」，追加：

```text
From the approved 1024×1024 master, export these exact PNG sizes with Lanczos/bicubic downscale, no redesign per size:
180, 192, 512, 167, 152, 120, 96, 72, 48, 32, 16.
Also export favicon.ico containing 16, 32, 48.
Generate separate 512×512 maskable variant with 60% safe zone.
```

---

## 6. Maskable 安全区检测

Android 自适应图标切 **圆形 / 圆角矩形 / 水滴形** 时，边缘会被裁切。

```
┌────────────────────────────── 512px ──────────────────────────────┐
│                     ← 20% (~102px) 可能被裁掉 →                    │
│    ┌─────────────────────────────────────────────────────┐      │
│    │           中心 60% 直径圆（~307px）                    │      │
│    │              ★ Logo 主体必须在此内 ★                   │      │
│    └─────────────────────────────────────────────────────┘      │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

验收：将 512 maskable 预览叠加上 **圆形遮罩**（直径 60%），Logo 不得被切到。

在线工具：https://maskable.app/editor

---

## 7. 平台行为速查

| 平台 | 用户操作 | 依赖图标 |
|------|----------|----------|
| iPhone Safari | 分享 → 添加到主屏幕 | `apple-icon` **180×180** |
| iPad Safari | 同上 | 180 或 167/152 |
| Android Chrome | 菜单 → 安装应用 / 添加到主屏幕 | manifest **192 + 512** |
| Android Chrome | 自适应形状 | **512 maskable** |
| 桌面 Chrome | 地址栏安装 ⊕ | manifest 192 + 512 |
| 浏览器标签 | 自动 | `favicon.ico` 16/32 |

---

## 8. 导出清单（打印勾选）

### 第一批 — 上线必需

- [ ] `icon-1024.png` — 母版
- [ ] `icon-512.png`
- [ ] `icon-512-maskable.png`
- [ ] `icon-192.png`
- [ ] `icon-180.png` / `apple-icon.png`
- [ ] `favicon.ico`（含 16、32、48）

### 第二批 — 全平台清晰（推荐）

- [ ] `apple-icon-167.png`
- [ ] `apple-icon-152.png`
- [ ] `apple-icon-120.png`
- [ ] `android-xxhdpi-144.png`
- [ ] `android-xhdpi-96.png`
- [ ] `favicon-32.png`、`favicon-16.png`

### 第三批 — 兼容/可选

- [ ] `apple-icon-76.png`、`apple-icon-60.png`
- [ ] `android-mdpi-48.png`、`android-hdpi-72.png`
- [ ] `icon-384.png`、`icon-256.png`

---

## 9. 常见错误

| 错误 | 后果 | 正确做法 |
|------|------|----------|
| 透明背景 PNG | 主屏幕出现黑/白块 | 实心背景 `#0F0E0C` |
| 设计稿带圆角 | 双重圆角、边缘露底 | 导出直角正方形 |
| maskable  logo 太大 | Android 图标被切头 | 主体在 60% 圆内 |
| 只有 512 无 192 | Chrome 安装提示异常 | manifest 至少 192+512 |
| 复杂细线 logo | 48px 糊成一片 | 加粗几何、单字母 |

---

## 10. 参考

- [Web App Manifest — Icons](https://developer.mozilla.org/en-US/docs/Web/Manifest/icons)
- [Apple — Configuring Web Applications](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)
- [Maskable.app Editor](https://maskable.app/editor)
- 项目品牌令牌：`apps/web/src/app/globals.css`
- 产品边界（非离线 PWA）：`docs/product/01-product-overview.md`
