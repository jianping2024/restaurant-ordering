# 本次改动业务场景测试报告：菜品动图按可见性播放（详情优先）

日期：2026-10-30  
分支：`feat/dish-motion-visibility-playback`  
UAT 基址：`http://127.0.0.1:3002`（feature + `.next-uat`）

## 1. 本次修改

- **内容：** 去掉「最多同时播 4 路」硬限制；唯一规则 `dishMotionVideoShouldPlay`：在屏且标签页可见才播；打开详情时推荐栏让路，详情动图优先；切到后台标签页全停。
- **文件：** `DishMotionVideo.tsx`、`menu-dish-video-playback.ts`、`CustomerMenuItemDetailSheet.tsx`、`CustomerRecommendedRail.tsx`、`menu-dish-video.ts`（删并发常量）、单测、`docs/agent-sole-index.zh.md`
- **角色 / 页面：** 客人扫码菜单推荐栏 + 菜品详情

## 2. 核心业务规则

1. 客人动图播放唯一组件 `DishMotionVideo`；策略唯一函数 `dishMotionVideoShouldPlay`。【本次新增/收紧】【已实现】
2. 推荐栏 `layer=rail`，详情 `layer=detail`；详情挂载期间推荐栏不播。【本次新增】【已实现】
3. 滑出屏幕（≥50% 不可见）或标签页不可见 → 停。【已实现】
4. 禁止全局并发上限挤掉详情。【本次修复】【已实现】
5. 省流 / 弱网 / 减动效仍不播，只留静图。【已实现】

## 3. 详细测试场景

### 场景 1：推荐栏多道在屏可同时播（不再被 4 卡死）

- **前置状态：** 白云客人菜单；推荐栏多道有 `rail_video_url`
- **操作过程：** 打开菜单，不点详情，观察推荐栏
- **预期结果：** 露在屏上的推荐位可播动图（可多于 4）
- **数据验证：** DOM 中 `*-rail.mp4` 且 `paused=false` 的数量可 ≥5（若有 ≥5 道在屏）
- **异常恢复：** 滑走后对应 video 暂停

### 场景 2：开详情后推荐栏停、详情播

- **前置状态：** 推荐栏多路在播；点开有 `video_url` 的菜（如 103 Pina Colada）
- **操作过程：** 点推荐位打开详情；不人为 blur/focus 整页
- **预期结果：** 详情主图播 `*-detail.mp4`（有 src、未 pause、opacity 可见）；推荐栏 rail 全部 pause
- **数据验证：** evaluate 核对 video 状态
- **异常恢复：** 关详情后，仍在屏的推荐位恢复播放

### 场景 3：策略纯函数

- **前置状态：** 单测
- **操作过程：** `node --import tsx --test src/lib/menu-dish-video.test.ts`
- **预期结果：** 含「rail + detailOpen → false；detail + detailOpen → true」等用例通过
- **数据验证：** exit=0
- **异常恢复：** 不适用

### 场景 4：回归 — 目录 API 仍带视频字段

- **前置状态：** Pro + 店开着菜品动图
- **操作过程：** `GET …/customer/menu-catalog` 查 Pina Colada
- **预期结果：** `video_url` 与 `rail_video_url` 非空
- **数据验证：** JSON 字段
- **异常恢复：** 不适用

## 4. 实际测试结果

| 场景 | 标签 | 结果 |
|---|---|---|
| 1 推荐栏多路同时播 | 【已验证】 | pass — 5 路 `rail.mp4` 同时 `paused=false`（基址 `:3002`） |
| 2 开详情 rail 停 / detail 播 | 【已验证】 | pass — detail 有 src、未 pause、opacity=1；railPlayingWhileDetail=0 |
| 2b 关详情 rail 恢复 | 【已验证】 | pass — detail 停后 rail 恢复 5 路在播 |
| 3 策略单测 | 【已验证】 | pass — `menu-dish-video.test.ts` 8/8 |
| 4 目录仍带视频字段 | 【已验证】 | pass — Pina Colada `video_url`/`rail_video_url` 非空 |

机器证据：`.mesa-agent-gates/feat__dish-motion-visibility-playback/uat.md`。

## 5. 风险与待确认

- 详情无图时不挂 `DishMotionVideo`，推荐栏在弹层下可能仍播（无图详情少见）。【未验证】
- 滑出后只 pause、不卸 `src`（与改前相同）。【已实现】
