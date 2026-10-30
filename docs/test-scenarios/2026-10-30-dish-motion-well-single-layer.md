# 本次改动业务场景测试报告：菜品动图井唯一可见层

## 1. 本次修改

- **内容：** 缩略图 / 推荐栏 / 详情头图共用 `DishMotionVideo`：静图作 children；动图已能给客人看时（`dishMotionCoversStill`）藏静图，井内同一时间只露一层。
- **文件：** `DishMotionVideo.tsx`、`menu-dish-video-playback.ts`、`MenuItemCard.tsx`、`CustomerRecommendedRail.tsx`、`CustomerMenuItemDetailSheet.tsx`、sole 索引、单测。
- **角色 / 页面：** 客人点餐（推荐栏 + 列表 + 详情）；店开关「菜品动图 / 点餐列表动图」已开时可见。

## 2. 核心业务规则

1. 井内主视觉唯一：动图 covering → 静图不可见；否则只露静图。【本次新增】【已实现】
2. 排他 sole：`dishMotionCoversStill`；播放策略仍 `dishMotionVideoShouldPlay`。【本次新增 / 既有】
3. 列表与推荐栏共用 rail 片；详情用 detail 片；三处同一 children 写法。【本次新增】
4. 无片 / 设备不允许 / 失败 → 静图。【已实现】

## 3. 详细测试场景

### 场景 1：列表开列表动图后，播起来时底下静图不透

- **前置状态：** 白云 `menu_dish_video` + `menu_dish_list_video` 店开；客人桌开台；鸡尾酒有 `rail_video_url`（如 112/113）
- **操作过程：** 客人打开菜单 → 点鸡尾酒分类 → 看 112/113 缩略图（不悬停）
- **预期结果：** 动图播起来后，透过留白看不到底下另一张静图；邻卡中间缝仍在
- **数据验证：** DOM：covering 时 still `opacity-0`，video `opacity-100`
- **异常恢复：** 关列表动图后只剩静图
- **标签：** 【本次新增】

### 场景 2：推荐栏同样只露一层

- **前置状态：** 同上；推荐栏有带 rail 动图的菜
- **操作过程：** 客人菜单顶推荐栏看海报
- **预期结果：** 动图 ready 后静图不透
- **数据验证：** 同场景 1 DOM 规则
- **异常恢复：** 减少动态效果 / 省流量时只静图
- **标签：** 【本次新增】

### 场景 3：详情头图同样规则

- **前置状态：** 有 `video_url` 的菜
- **操作过程：** 点开详情
- **预期结果：** 详情动图 ready 后静图不透；关详情后推荐/列表恢复播控
- **标签：** 【本次新增】

### 场景 4：无动图或播不了时静图正常

- **前置状态：** 无 `rail_video_url` 的菜，或设备拒绝动图
- **操作过程：** 看列表缩略图
- **预期结果：** 只显示静图/emoji，布局与改前一致
- **标签：** 【已实现】回归

### 场景 5：目录闸仍正确

- **前置状态：** 列表动图店开
- **操作过程：** GET 客人 catalog
- **预期结果：** `guestListMotionEnabled=true`；有 rail 的项带 `rail_video_url`
- **标签：** 【已实现】回归

## 4. 实际测试结果

| 场景 | 结果 | 标签 |
|---|---|---|
| 1 列表 covering 不透静图 + 邻卡 gap | pass — 112/113 still opacity=0、video=1、gap=12px（:3002 Chrome） | 【已验证】 |
| 2 推荐栏单层 | pass — rail still=0、video=1 | 【已验证】 |
| 3 详情头图单层 | pass — detail still=0、video=1 | 【已验证】 |
| 4 无动图静图回归 | 未单独点无 rail 行肉眼；代码路径 src=null 只渲染 children | 【未验证】UI / 【已实现】代码 |
| 5 catalog 闸 | pass — `guestListMotionEnabled=true`，Tommy 有 `rail_video_url` | 【已验证】 |

机器证据：`.mesa-agent-gates/fix__dish-motion-thumb-single-layer/uat.md`（`MESA_UAT_BASE=http://127.0.0.1:3002`）。

## 5. 风险与待确认

- 动图未 ready 前仍短暂双层（静图可见、video opacity-0）属过渡，covering 后必须单层。【已验证】covering 后单层
- 详情与列表/推荐一并改，避免平行叠放写法残留。【已实现】
