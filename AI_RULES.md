# AI 工作规则（Mesa）

本文件是 AI 代理的**项目整理与变更约束**，与 [`AGENTS.md`](./AGENTS.md) 互补：

- **`AGENTS.md`**：技术栈、命令、安全、token 节省、数据库上下文
- **本文件**：文档驱动开发、变更流程、业务边界
- **`.cursor/rules/project-rules.mdc`**：Cursor 自动加载的精简版

冲突时优先级见 `AGENTS.md`（安全与租户隔离最高）。

---

## 文档入口

修改功能前，先读对应文档：

| 类型 | 目录 |
|------|------|
| 产品与功能边界 | [`docs/product/`](./docs/product/) |
| 设计与 UI | [`docs/design/`](./docs/design/) |
| 技术与 API | [`docs/technical/`](./docs/technical/) |
| 架构决策 | [`docs/decisions/`](./docs/decisions/) |
| 数据库紧凑参考 | [`docs/ai-schema.md`](./docs/ai-schema.md) |
| 专题计划（历史） | [`docs/`](./docs/) 下 `*.zh.md` / `*-plan.md` |
| 整理阶段指挥 | [`docs/optimization.md`](./docs/optimization.md) |

---

## 八条强制规则

### 1. 修改前必须先读相关文档和代码

- 明确任务属于哪个产品模块（见 `docs/product/02-feature-map.md`）
- 涉及状态机时读 `docs/product/03-user-flows.md` 与 `04-business-rules.md`
- 读代码时严格限定文件范围，禁止无目的全库扫描

### 2. 修改前必须输出影响范围和方案

- 列出将改动的文件与模块
- 说明对结账、打印、会话、RLS 等高风险区的影响
- **非琐碎改动**：等用户确认后再写代码（见 `docs/optimization.md` 阶段 7）

### 3. 禁止无说明重写模块

- 不允许整文件重写或大规模重构，除非用户明确要求且有文档/方案支撑
- 优先最小 diff、沿用邻近文件模式

### 4. 禁止新增需求外功能

- 以 `docs/product/` 功能地图与业务规则为准
- 「当前不做」的事项不得悄悄实现

### 5. 禁止修改无关文件

- 不顺手格式化、不顺手「优化」未请求模块
- 默认最多检视 3–5 个相关文件（见 `AGENTS.md`）

### 6. 禁止临时补丁

- 不用 hack、硬编码、注释掉的逻辑绕过结构问题
- 若发现结构问题，记入文档或重构计划，不在业务改动里夹带大修

### 7. 涉及业务规则必须同步更新文档

- 状态、流程、口径变更时，更新 `docs/product/` 或 `docs/technical/` 对应章节
- 重大技术选型变更时，新增或更新 `docs/decisions/ADR-*.md`

### 8. 修改后必须输出测试结果

- Web：`npm run lint`；触及路由/服务端时 `npm run build`
- print-agent：Docker `go test` / `go vet` / Windows cross-build（见 `AGENTS.md`）
- 说明测了什么、未覆盖什么、剩余风险

---

## 整理阶段（optimization.md）

按 [`docs/optimization.md`](./docs/optimization.md) **每次只执行一个阶段**，完成后停止等确认。

当前进度：

- [x] 阶段 0：项目现状审计
- [x] 阶段 1：文档骨架与 AI 规则（本文件所在阶段）
- [x] 阶段 2：产品功能地图（[`docs/product/01-product-overview.md`](./docs/product/01-product-overview.md)、[`02-feature-map.md`](./docs/product/02-feature-map.md)）
- [x] 阶段 3：用户流程与业务规则（[`docs/product/03-user-flows.md`](./docs/product/03-user-flows.md)、[`04-business-rules.md`](./docs/product/04-business-rules.md)）
- [x] 阶段 4：设计规范（[`docs/design/`](./docs/design/)）
- [x] 阶段 5：技术架构审计（[`docs/technical/01-architecture.md`](./docs/technical/01-architecture.md)–[`05-deployment.md`](./docs/technical/05-deployment.md)）
- [x] 阶段 6：重构计划（[`docs/technical/06-refactoring-plan.md`](./docs/technical/06-refactoring-plan.md)）
- [ ] 阶段 7：小步重构（此时才允许改业务代码；任务清单见 [`06-refactoring-plan.md`](./docs/technical/06-refactoring-plan.md)）

---

## 高风险禁区（未经明确授权勿改）

- 桌位 / 订单 / 会话状态机
- 结账确认、分单金额、折扣审计
- 打印入队、claim、租户 JWT / RLS
- 数据库迁移与 RLS 策略
- 暴露 `table_id` 于纸面（只用 `display_name`）

---

## 输出模板（每次有代码变更时）

```markdown
## 修改文件
- ...

## 影响范围
- ...

## 测试结果
- ...

## 风险点
- ...
```
