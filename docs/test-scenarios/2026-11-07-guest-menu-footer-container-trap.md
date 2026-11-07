# 2026-11-07 顾客菜单购物车底栏贴底（container 不包 dock）

## 本次修改

- 内容：把量菜单壳宽的 `mesa-menu-shell` 从整页根挪到内容宿主；购物车/送厨底栏仍在内容宿主外、相对视口 `fixed bottom-0`
- 文件：`customer-menu-chrome-layout.ts` / `.test.ts`、`globals.css`、`CustomerStorefrontMenuPreview.tsx`、`docs/agent-sole-index.zh.md`
- 角色/页面：顾客扫码菜单（经典 demo + 寿司租户）、店招预览

## 核心业务规则

1. 底栏贴屏幕内容区底，底下不能空出大块页面底色
2. 宽屏时左边分类栏仍可按壳宽 76→112
3. 底栏祖先链上不能有 `mesa-menu-shell`（避免 iOS WebKit 把 fixed 锚错）

## 详细测试场景

### 场景 1：演示菜单底栏贴底

- **前置状态**：feature web `:3002`；打开 `/demo/menu`；手机视口 390×844
- **操作过程**：关掉欢迎弹窗；看底栏「Ver carrinho」
- **预期结果**：底栏贴视口底；`gapFromViewportBottom=0`；祖先无 `mesa-menu-shell`
- **数据验证**：`contentHostContainsDock=false`；内容区仍有 `.mesa-menu-shell`
- **异常恢复**：不适用
- **结果**：【已验证】pass

### 场景 2：寿司租户菜单 + 送厨条

- **前置状态**：`/lucky-tea-mulcs62n/menu?table_id=A-01`；有送厨 guidance
- **操作过程**：打开菜单；量 `[data-mesa-bottom-dock]`
- **预期结果**：同样 `fixed` + `bottom:0` + gap=0；祖先无 shell；`hasGuidance=true`
- **结果**：【已验证】pass

### 场景 3：点开购物车抽屉（回归）

- **前置状态**：场景 1
- **操作过程**：点「Ver carrinho」
- **预期结果**：抽屉可打开（不因挪 container 坏掉）
- **结果**：【已验证】pass（点击成功）

### 场景 4：宽屏分类栏变宽（回归 · 代码断言）

- **前置**：unit `customer-menu-chrome-layout.test.ts`
- **预期**：shell 只在 content host；根上没有
- **结果**：【已验证】pass

### 不适用并说明

- 多用户并发 / 结账付款：本次只动布局挂载点，无写路径
- 真机 iPhone Chrome 复现原图：本机 DevTools 已验证结构不变量；真机待 Will 看生产/打包后

## 实际测试结果

| 项 | 结果 |
|---|---|
| stack-health `:3002` | pass |
| demo 底栏 DOM | pass |
| sushi 底栏 DOM | pass |
| 点开购物车 | pass |
| unit chrome layout | pass |

## 风险与待确认

- 真机 iPhone（原事故浏览器）未在本线程复测；结构上已去掉导致贴错的祖先 container
