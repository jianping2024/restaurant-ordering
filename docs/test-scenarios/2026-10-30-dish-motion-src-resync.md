# 本次改动业务场景测试报告：推荐栏动图随目录换源

日期：2026-10-30  
分支：`feat/dish-motion-src-resync`  
UAT 基址：`http://127.0.0.1:3002`（feature + `.next-uat`）

## 1. 本次修改

- **内容：** 目录里的视频地址一变，`<video>` 必须换成新地址再播（修推荐栏门铃后仍播旧 mp4）；推荐栏静图 `Image` 用 `key={imageSrc}` 跟目录走。
- **文件：** `DishMotionVideo.tsx`、`menu-dish-video-playback.ts`（`applyDishMotionVideoElementSrc`）、`CustomerRecommendedRail.tsx`、单测、sole-index、本场景文档
- **角色 / 页面：** 客人菜单推荐栏 + 详情

## 2. 核心业务规则

1. 播放元素 `src` 必须等于当前目录 URL；变了就换，禁止「挂过一次就永不更新」。【本次修复】【已实现】
2. 换源唯一入口：`applyDishMotionVideoElementSrc`。【本次新增】【已实现】
3. 可见性 / 详情优先规则不变（`dishMotionVideoShouldPlay`）。【已实现】

## 3. 详细测试场景

### 场景 1：纯函数 — URL 变则写属性

- **前置：** 单测
- **操作：** `menu-dish-video.test.ts`「resyncs video element src…」
- **预期：** 同 URL 返回 false；新 URL 写入并返回 true
- **数据验证：** exit=0

### 场景 2：门铃换 `rail_video_url` 后推荐栏元素跟上

- **前置：** 客人页开着推荐栏；记下 101 的 rail `src`
- **操作：** DB/API 把 101 的 `rail_video_url` 换成另一合法地址并 bump 目录版本（门铃）；页保持前台
- **预期：** 推荐栏对应 `<video>` 的 `src` 变为新地址（不整页强刷）
- **数据验证：** evaluate DOM；目录 API 新 URL
- **异常恢复：** 换源瞬间可先露静图再播

### 场景 3：详情仍用新地址

- **前置：** 场景 2 后
- **操作：** 点开 101 详情
- **预期：** 详情播当前 `video_url`（与目录一致）
- **数据验证：** detail video src

### 场景 4：回归 — 多路同时播 / 开详情 rail 让路仍成立

- **前置：** 推荐栏多道有动图
- **操作：** 不点详情观察；再点开详情
- **预期：** 在屏可多路播；详情打开 rail 停
- **数据验证：** evaluate

## 4. 实际测试结果

| 场景 | 标签 | 结果 |
|---|---|---|
| 1 纯函数换源 | 【已验证】 | pass — 单测 9/9 |
| 2 门铃换 rail 后 DOM src 跟上 | 【已验证】 | pass — catalog+video 均为 Mojito rail 后缀；页保持 visible |
| 3 详情播当前 detail | 【已验证】 | pass — detail 未 pause、opacity=1 |
| 4 多路播 + 开详情让路 | 【已验证】 | pass — railPlayingBefore=5；开详情 railPlaying=0 |

测后已把 101 的 `rail_video_url` 写回原地址并 bump。

机器证据：`.mesa-agent-gates/feat__dish-motion-src-resync/uat.md`。

## 5. 风险与待确认

- 换源瞬间 opacity 回 0 再等 `playing`，可能短闪静图。【已实现】
