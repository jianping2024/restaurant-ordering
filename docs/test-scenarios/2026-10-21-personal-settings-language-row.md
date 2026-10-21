# 本次改动业务场景测试报告：账号菜单「语言」整行可点

日期：2026-10-21  
分支：`fix/personal-settings-language-row-clickable`  
UAT base：`http://localhost:3002`

## 1. 本次修改

- **内容**：员工顶栏账号下拉里，「语言」整行（左侧「语言」、当前语言名、地球图标）点任意位置即可打开中/英/葡列表并切换；仍只有一套语言控件 `LanguageSwitcherIconChrome`（`layout="settings-row"`）。
- **文件**：`apps/web/src/components/ui/LanguageSwitcher.tsx`、`apps/web/src/components/staff/PersonalSettingsPanel.tsx`
- **角色 / 页面**：员工（店主）→ 楼面看板顶栏账号菜单
- **流程**：打开账号菜单 → 点语言行 → 选语种 → 界面文案随语言更新

## 2. 核心业务规则

1. 【本次新增】个人设置里语言只有一种点法：整行打开同一份语种列表。
2. 【已实现】语种写入仍走现有 `setLang`（cookie + localStorage）；不另存第二套语言状态。
3. 【已实现】Landing / 顾客顶栏语言仍是 `icon` / `segment`，与本次 settings 行共用同一组件与同一列表。
4. 【设计建议】「深色模式」本轮不改为整行可点（仅语言）。

## 3. 详细测试场景

### 场景 1：整行可点打开语种列表 【已验证】

- **前置状态**：已登录店主 `luckytea@gmail.com`；界面简体中文；打开账号菜单。
- **操作过程**：点账号菜单中语言行（a11y 为单一 button，文案含 Language/语言 + 当前语种名）。
- **预期结果**：打开中/英/葡列表；账号菜单不关。
- **数据验证**：无服务端写库。
- **异常恢复**：再点可收起/再开。
- **实际**：列表出现简体中文 / English / Português — **pass**

### 场景 2：切换到英文后菜单文案跟着变 【已验证】

- **前置状态**：语种列表已开，当前简体中文。
- **操作过程**：选 English。
- **预期结果**：行上显示 English；同菜单 Dark mode / Change password / Log out；楼面筛选等变英文。
- **数据验证**：`mesa-ui-lang=en`，`html.lang=en`。
- **异常恢复**：再切回简体中文成功。
- **实际**：**pass**

### 场景 3：不破坏深色模式与其它菜单项 【已验证】

- **前置状态**：账号菜单打开（英文）。
- **操作过程**：点 Dark mode；点 Change password；关对话框。
- **预期结果**：主题切到 dark；改密对话框标题 Change password；关闭后菜单可再开语言行。
- **数据验证**：`data-theme`/class 为 dark。
- **实际**：**pass**

### 场景 4：回归 — 登录页语言控件仍可点 【已验证】

- **前置状态**：`/auth/login`（葡语默认）。
- **操作过程**：点语言 segment → 选简体中文。
- **预期结果**：标题变为「欢迎回来」，登录按钮「登录」。
- **实际**：**pass**

### 不适用维度（本改动）

- 多用户并发、收款状态机、打印、Realtime：不触及。

## 4. 实际测试结果

| 项 | 结果 |
|---|---|
| mesa-local-uat stack-health | 【已验证】pass（ready；ops softMissing） |
| mesa-local-uat login owner | 【已验证】pass |
| 场景 1 整行可点 | 【已验证】pass |
| 场景 2 切语种文案 | 【已验证】pass |
| 场景 3 深色模式/改密 | 【已验证】pass |
| 场景 4 登录页语言 | 【已验证】pass |

## 5. 风险与待确认

- 无残留失败项。深色模式整行可点本轮未做。
