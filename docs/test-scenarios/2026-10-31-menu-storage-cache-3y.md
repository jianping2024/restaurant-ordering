# 菜品图/视频 Storage 缓存三年

## 本次修改

- 内容：`menu-images` 桶上传时的 `Cache-Control` 从 1 年改为 3 年（sole 常量 `MENU_STORAGE_CACHE_CONTROL`）
- 文件：`apps/web/src/lib/menu-image.ts`、`menu-dish-video.ts` 注释、`docs/agent-sole-index.zh.md`
- 角色/页面：店主或有菜单/店面设置权限的员工上传菜品图、菜品视频、店面 logo/封面
- 流程：上传 → Storage 对象带新缓存时长 → 浏览器按公开 URL 缓存

## 核心业务规则

1. 全仓只有一个缓存时长常量；图、视频、店面图共用
2. 每次上传使用新对象路径；换图换 URL，长缓存不会显示旧文件
3. 改常量后，仅新上传对象为三年；已有对象保持上传时写入的时长，直到被替换

## 详细测试场景

### 场景 1：新上传店面图，响应头为三年

- **前置状态**：本地 web 跑本分支；能用店主账号登录
- **操作过程**：店主上传一张很小的店面 logo；记下返回的 `url`；对该 URL（或 `/storage/...`）发 GET，看 `Cache-Control`
- **预期结果**：`max-age=94608000`（或等价的三年秒数）
- **数据验证**：库里 logo URL 更新为新路径
- **异常恢复**：上传失败则库与 Storage 不留下半截成功状态（既有逻辑）

### 场景 2：换图后立刻显示新图

- **前置状态**：场景 1 已有 logo
- **操作过程**：再上传另一张图
- **预期结果**：返回新 URL；页面/请求立刻指向新地址，不是旧地址
- **数据验证**：旧对象可被清理；新对象仍为三年缓存头

### 不适用说明

- 多用户并发改同一菜图：本次未改写路径锁，不单测
- 客人点餐 API 轮询：无关
- Realtime：无关

## 实际测试结果

- 【已验证】`MESA_UAT_BASE=http://localhost:3003` stack-health + luckytea owner 登录
- 【已验证】场景 1：`POST /api/restaurant/storefront-image`（kind=logo）后，公开 URL 响应头 `cache-control: max-age=94608000`
- 【已验证】场景 2：第二次上传得到新 URL，新对象仍为 `max-age=94608000`
- lint + typecheck `@mesa/web` 通过（既有 hooks warning，与本次无关）
