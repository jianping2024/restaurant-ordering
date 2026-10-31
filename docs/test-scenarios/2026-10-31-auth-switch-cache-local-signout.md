# 本次改动业务场景测试报告：换号登录两次 / 登出只踢本设备

## 本次修改

- **起因（已核实，云上日志）**：2026-10-31 08:58 UTC luckytea 登录两次。浏览器先登白云 `restaurant-mohnrib5`，登出后登录 luckytea；PWA shell Service Worker 导航「先画缓存页」，把上个账号的 `/dashboard/waiter` 画出来 → 页面用旧 slug 请求 `/api/restaurants/restaurant-mohnrib5/…` → 401 → 看板 auto-exit 调 `/api/auth/logout`（默认 global）把刚登上的会话吊销 → 第二次登录才进。10-28/29/30 同模式（登录后 1–2 秒被 logout）。
- **内容**
  1. 账号边界清 SW 缓存：sole `clearPwaShellCaches`（`lib/pwa/shell-sw.ts`），`useAuthLogin` 跳转前、`signOutAndRedirect` 跳转前各调一次
  2. 登出只吊销本设备：sole `signOutThisDevice`（`lib/supabase/sign-out.ts`，`scope:'local'`），替换 web 全部 `auth.signOut()`（logout 路由、login 失败分支 ×2、中间件、浏览器 fallback）
- **角色 / 页面**：店主、员工（所有走 `/auth/login` 或 `/{slug}/staff/login` 的账号）；后台、楼面看板、厨房屏、改密页的退出与 auto-exit
- **未改**：401/403 语义、中间件 redirect cookie、apps/ops 平台登录（独立账号，不在范围）

## 核心业务规则（不变量）

1. 换账号后的第一屏只能是新账号的页面，不得出现上个账号的店铺/数据（【本次新增】）
2. 一次正确登录即可进入，不得被旧页面的请求自动登出（【本次新增】）
3. 一台设备退出或被自动退出，不影响同账号其他设备在线（【本次新增】）
4. 本设备退出后，该会话在服务端被吊销，不是只删 cookie（【已实现】由 auth-js local scope 保证，本次验证）
5. 管理员重置员工密码仍踢掉该员工全部设备 —— 走 `kickStaffUserSessions`，不依赖登出 scope（【已实现】，代码已核实）

## 详细测试场景

### 场景 1：同账号两台设备，一台退出

- **前置状态**：luckytea 店主分别在设备 A、设备 B 登录（API jar devA / devB），两边楼面看板都能打开
- **操作过程**：设备 A 退出登录；随后两台设备各刷新楼面看板
- **预期结果**：A 需要重新登录（401）；B 继续正常使用（200）
- **数据验证**：`auth.sessions` 中 luckytea 近 10 分钟会话由 2 条变 1 条（只删 A）
- **异常恢复**：A 重新登录即可，B 全程无感

### 场景 2：同一浏览器跨店换号（今早现场复现路径）

- **前置状态**：浏览器缓存里留有上个账号的 `/dashboard/waiter` 页面（Cache Storage `mesa-pwa-shell:dev` 预置旧页模拟）；上个账号的会话已结束（API 登出，不经 UI，模拟过期/被踢）
- **操作过程**：在 `/auth/login` 输入 luckytea 账号密码，回车
- **预期结果**：一次进入 `/dashboard/waiter`；不再出现回到登录页
- **数据验证**：跳转后 `caches.keys()` 为空；页面只请求 `lucky-tea-mulcs62n` 的结账请求 / 楼面看板接口且均 200；登录后无 `/api/auth/logout`
- **异常恢复**：浏览器禁用存储时 `clearPwaShellCaches` 静默跳过，退化为现状（直接走网络）

### 场景 3：UI 退出登录清缓存

- **前置状态**：luckytea 已登录楼面看板；缓存里有一份旧页
- **操作过程**：右上角「后台管理员」→「退出登录」→ 确认
- **预期结果**：落到 `/auth/login`
- **数据验证**：`caches.keys()` 为空 —— 下一个人打开 PWA 不会先看到这一屏

### 场景 4：反方向跨店（店主 → 别店员工）

- **前置状态**：同一浏览器刚由 luckytea 退出
- **操作过程**：UI 登录白云前台 `qiantai1`
- **预期结果**：一次进入楼面看板
- **数据验证**：只请求 `restaurant-mohnrib5` 接口，均 200；无自动登出

### 场景 5：未登录直接打开后台

- **操作过程**：无 cookie 访问 `/dashboard/waiter`
- **预期结果**：307 到 `/auth/login`（回归）

### 不适用 / 未覆盖说明

- 多用户真正同时提交：本次不涉及业务写入
- 历史数据：无数据结构变更；已安装 PWA 的旧缓存会在下一次登录/登出时被清
- 邮件确认 / 注册后直接进入 onboarding 不经 `useAuthLogin`，不清缓存 —— 新账号无同 URL 缓存时无影响，未单测
- Service Worker 真实注册后的「先画缓存页」链路：内置浏览器无法注册 SW（register 挂起），以 Cache Storage 预置等价验证

## 实际测试结果

- 【已验证】场景 1：devA 登出后看板 401、devB 200；`auth.sessions` 2→1
- 【已验证】场景 2：一次登录进入，`caches` 清空，仅 `lucky-tea-mulcs62n` 接口 200，无自动登出
- 【已验证】场景 3：UI 退出后 `caches` 清空，回到 `/auth/login`
- 【已验证】场景 4：跨店登录 `qiantai1` 一次进入，仅 `restaurant-mohnrib5` 接口 200
- 【已验证】场景 5：未登录 307 → `/auth/login`
- 【未验证】真实 SW 控制页面下的端到端（需 Chrome 安装态 / 云上验证）；上线后看 Supabase edge logs：`token?grant_type=password` 后 1–2 秒不应再跟 `logout`，且 logout 应为 `scope=local`
- 【已验证】`@mesa/web` typecheck 通过；改动文件 eslint 通过；`shell-sw` / `middleware-session-policy` 单测 10/10
