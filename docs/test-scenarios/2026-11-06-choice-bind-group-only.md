# 口味挂菜只选分组 + UAT 实点门禁

## 本次修改

- 后台菜品编辑：口味只勾**分组** chip，不再展开勾组内单项；选上 = 该组全部（`option_ids: []`）
- 读写：`normalizeChoiceBindings` 允许空 `option_ids`；`resolveDishChoiceSections` 空 = 整组；打开编辑用 `choiceBindingsForDishForm`
- 规则：UAT 必须真实页面点击，禁止糊弄（`uat-before-delivery.mdc` 等）
- 角色/页面：店员 Dashboard → Menu → 编辑菜品「Grupos de escolha」

## 核心业务规则

1. 一道菜可挂多个口味分组；挂组不逐个勾选项
2. 空 `option_ids` = 该组全部启用选项
3. 顾客仍每组单选、必选一（本轮未改顾客交互）
4. 旧数据非空 `option_ids`：顾客仍按子集；店员打开再保存 → 写成整组

## 详细测试场景

### 场景 1：编辑页只见分组、不见组内项【已验证】

- **前置**：Washoku / luckytea 登录；菜单有分组「辣度」；Takoyaki 1402 曾挂口味
- **操作**：Menu → Pratos → 搜 Takoyaki → Editar → 滚到「Grupos de escolha」
- **预期**：说明写「选组即全部、不展开」；只有「辣度」等分组 chip；无「不辣/轻辣」等选项 chip
- **数据验证**：页面 DOM 无选项 chip；辣度 chip 为选中样式
- **异常恢复**：Cancelar 关闭弹窗可再开

### 场景 2：点分组再保存写成整组【已验证】

- **前置**：同场景 1；库里曾有非空 `option_ids`
- **操作**：确认勾选「辣度」→ Guardar
- **预期**：保存成功；`choice_bindings` 为 `[{ group_id, option_ids: [] }]`
- **数据验证**：Docker 本地库 `item_code=1402` 已查到空 `option_ids`
- **异常恢复**：再打开编辑仍只显示分组 chip

### 场景 3：浇头区回归【已验证】

- **前置**：同弹窗
- **操作**：查看 Coberturas
- **预期**：仍先选类别再勾（或「该类全部」）；与口味「只选组」并存、互不替代
- **数据验证**：UI 仍有类别下拉与「Todos os pratos desta categoria」
- **异常恢复**：不适用

### 场景 4：顾客每组单选【未验证】

- **前置**：桌台开台；顾客点 Takoyaki
- **操作**：详情选辣度一项再加入
- **预期**：仍单选必选；整组选项可见
- **说明**：本轮 UI 改动在后台；顾客逻辑未改。库已写成整组，选项应齐全。【未验证】实点顾客端

## 实际测试结果

| 场景 | 结果 |
|---|---|
| 1 后台只选分组 | 【已验证】pass · localhost:3002 实点 |
| 2 保存空 option_ids | 【已验证】pass · DB 核对 |
| 3 浇头回归 | 【已验证】pass · 同弹窗可见 |
| 4 顾客端 | 【未验证】 |

## 风险与待确认

- 顾客端整组选项展示未在本轮实点；合 main 前若要可补一次桌台点餐
- 规则侧「禁止糊弄」已写入 always-on UAT 规则
