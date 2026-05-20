# 店内打印代理：实施计划（应用端 vs 安装包端）

目标：浏览器/Mesa **只负责入队**；收银机 **常驻代理** 拉取任务并发送到热敏（优先 **网口 RAW 9100**）。店员侧以 **配对码** 为主，避免手写 `.env`。**订单小票、各档口出品联（`station_ticket`）、预结单** 三类 **`print_jobs.type` 一律经自建代理出纸**（同一队列、同一消费协议；**加单每批**、**每档口** 可各对应 **`station_ticket` 任务**，见 **已确认 · 出品与加单批次**；**谁看哪张票** 见 **票据受众**）；**有代理且已配对** 时 **不**把 **`window.print()` HTML** 作为上述票据的 **目标态主路径**。**无代理 / 未配对**（或代理不可用）时 **保留 `window.print()` 兜底**（见 **已确认 · 无代理时打印**）。现有 `OrdersHistoryManager` 等 HTML 打印在代理落地后 **与入队并存**：**优先队列**，**无代理则降级浏览器打印**。

**角色边界**：平台管理员（`ADMIN_BOOTSTRAP_SECRET` / 开新店）与店主/店内入口 **勿混为一谈**，见 `research.md` §1.1。

### 已确认产品与场景（需求口径）

| 项 | 决策 |
|----|------|
| **谁可发起打印（入队）** | **店长**（店内管理侧）。**实现衔接**：当前代码库尚无独立「店长」Supabase 账号与角色表；**第一期**可先 **仅 `restaurants.owner_id` 登录 `/dashboard` 可操作入队**（产品口径仍称店长），后续再拆 **`restaurant_staff` + `role`** 或等价方案，并把 RLS 从「仅 owner」扩展到店长账号。 |
| **多收银机 / 多代理** | **允许**同一店多台收银机各装代理；任务消费采用 **乐观锁**（`pending`→`processing` 条件更新）；**接受**偶发抢同一单失败，**客户端提示重试** 即可。**新设备 `claim` 不吊销、不踢同店已有设备的 token**（**各 `device_id` 凭证独立有效**）；离职/丢机在 **吊销能力上线后** 靠 **`print_agent_devices.revoked_at`**（dashboard **按设备吊销**）或 **`valid_until` 满期**，见 **已确认代理 token 生命周期 · 多设备** 与 **实施顺序**。 |
| **`print_jobs` 类型（第一期）** | **共三种**：**`order_receipt`**（**顾客向订单小票 / 结账小票**：汇总、离桌或结账时给顾客的 **最终纸本**，见 **票据受众**）、**`station_ticket`**（**档口出品联**；**每条任务**唯一 **`payload.print_station_id` + `batch_id`** 锚定行集，行项目仅为 **该档口、该批**；**店内出品用**，见 **票据受众**）、**`pre_bill`**（预结单；**核对用**，见 **票据受众**）。**刻意不设** **`kitchen_ticket` / `beverage_ticket`**，避免 N 个窗口时 **`type` 枚举爆炸**；**版式**由 **`print_stations.ticket_layout`**（`kitchen` \| `beverage` \| `standard`）区分 **ESC/POS**（**仅为模板枚举**，**不**再推导「打后厨 / 打酒水」等业务分流；**分流**一律看 **`print_station_id` / `effective_station_id`**），值在 **入队时写入 `payload` 快照**（与 `station_display_name` 等一并冻结）。**同一订单**：按 **`print_station_id`** 分组后 **每个有行的档口各 `insert` 一条** `station_ticket`（**下单/加单提交后自动入队**，见 **出品与加单批次**）。代理对三 `type` 各一套模板入口；**有代理时** **不**再依赖浏览器 **`window.print()`** 作上述三类的 **主路径**（**无代理** 见 **无代理时打印**）。**不**增加 **`agent_test`**。**试打**：仍用 **`type: order_receipt`** + **`payload.connection_test: true`**，见 P0-3。**类目与档口绑定** 见 **出品分流与 `print_stations`**。 |
| **出品分流与 `print_stations`（第一期）** | **不靠类目名推断窗口**。**（1）`print_stations`**（每店多行）：`id`、`restaurant_id`、**展示名**（如 `name_zh` / `name_pt`）、**`sort_order`**、**`ticket_layout`**（`check in ('kitchen','beverage','standard')`，决定 **`station_ticket`** 用哪套 **80mm** 模板；**`standard`** 为通用出品联）。**（2）`menu_categories.print_station_id`**：**可空** `uuid` FK → `print_stations`；**有值**则该品类订单行进入对应档口出品联，**`NULL`** 表示 **不出档口纸**（仍可在小票/预结出现，如包装费）。**（3）品级覆盖（建议第一期一并做）**：**`menu_items.print_station_id`** 可空，**非空则覆盖类目**。**新建店**：onboarding / migration **预置 1～2 条 `print_stations`**（示例：**展示名**「后厨」+ **`ticket_layout=kitchen`**、「吧台」+ **`ticket_layout=beverage`**），**既有类目** 默认绑 **首条 station** 或 **`NULL`** 待店主在 Dashboard 配置。**入队解析**：每行 **`effective_station_id` = COALESCE(品.print_station_id, 类目.print_station_id)**；按 station 分组写 **`station_ticket`**。**不推荐**主路径依赖 **固定类目名**。**后续**：**`print_agent_devices.subscribed_station_ids`**（可空=**拉全店**档口任务）、**类目多对多**、**沿 `parent_id` 继承** 等迭代补充。 |
| **实施顺序（当前迭代）** | **优先**：**`print_stations` 模型与 migration**（**已落地**：`supabase/migrations/20260512160000_print_stations_and_menu_bindings.sql` + **新建店种子** `20260513110000_restaurants_seed_print_stations.sql`，见 **六（附）·实施进度**）、**Dashboard 档口配置**（**已落地**：`/dashboard/settings/print-stations` + 菜单页绑定）、**类目/品 `print_station_id` 绑定**（**已落地**：菜单设置 UI）、**`station_ticket` 入队分组与 `payload`（`batch_id`、`ticket_layout`、行快照）** — **直接决定后续打单**。**暂缓**：**吊销后 JWT 立即失效的 RLS 全路径验收**、**店主按设备吊销 UI**（技术方案见 **吊销后 JWT…**，**不**删；**不**阻塞 `print_stations`）。**`print_agent_devices`** migration **可预留** `revoked_at` / `valid_until` / `device_id`。**硬底线**：**代理持 `agentjwt` 拉生产 `print_jobs` 对外上线前**须完成吊销闭环与 **REST + Realtime 验收**。 |
| **出品联入队（已落地 · 仅自动）** | **已确认**：**不**在厨房/服务员页提供「手动打印出品」按钮。**主路径**：顾客或服务员 **提交订单/加单** 后 → **`POST .../orders/append`** 返回 **`enqueue_token`** → **`POST .../station-tickets/auto`**（校验 token + **`batch_id`**）→ 服务端按 **`effective_station_id`** 分组，**每个有行档口各 `insert` 一条** **`station_ticket`**。**「仅重打某一档口/批次」**：列 **P2**（无首期 UI）。 |
| **出品与加单批次** | **受众**：**分批、按档口的 `station_ticket` 给店内出品人员看**（见 **票据受众**）。顾客 **多次下单 / 加单** 时，订单行按 **`batch_id`** 分批（见 `research.md`）。**已确认**：**每新提交一批**，**各相关 `print_station`** 自动打出品联（**一条任务 = 一个 `print_station` + 一个 `batch_id` 内的行**）。**`payload` 须含 `batch_id`**，**`lines` 仅该批、且归属本档口**。**防重复**：若已有同 **`order_id` + `batch_id` + `print_station_id`** 且 **`status in ('pending','processing')`** 则 **跳过**（`station-tickets/auto` 限流 + 客户端不重试）。**全单重打**：列 **P2**（`reprint_scope: full_order` 等）。 |
| **票据受众（顾客 vs 店内）** | **已确认**：**`station_ticket`**（档口出品联）为 **店内出品岗** 的 **内部按批出菜单**（**按 `print_station` / 展示名** 区分窗口，**不**依赖「厨房 / 吧台」等固定页面名）。**`order_receipt`** 为 **顾客向最终订单小票**（汇总整单或结账快照，**离桌 / 结账时** 打印即可；**不必**随每次加单给顾客一张热敏出品联）。**`pre_bill`** 为 **预结 / 核对**（服务员与顾客对账），**非**「每批必给顾客」的出品联。**Mesa 顾客端**：**不**用分批出品联替代「最终小票」心智；顾客屏若展示加单过程，可走 **电子 UI**，与 **给顾客的纸本 `order_receipt`** 分离。 |
| **门店国家 `country_code`** | **`restaurants.country_code`**（**ISO 3166-1 alpha-2**）在 **注册 / 开建新门店时必填**（店主 onboarding / 公开注册、平台管理员代建）；**dashboard 餐厅设置** 可改。用途：**门店所在地 / 合规与分区等**；**不**用于推导票面语言（见 **`print_locale`**）。第一期 migration；**既有门店** 回填默认（如 `PT`）再 `NOT NULL`，或分步迁移。 |
| **默认打印语言 `print_locale`** | **`restaurants.print_locale`**，取值 **`zh` | `en` | `pt`**（`check` + **`not null`**，默认 **`pt`**）。**语义**：**`pt` = 欧洲葡萄牙语**（与 BCP 47 **`pt-PT`** 对齐，**非** 巴西葡语 **`pt-BR`**）；票面文案、热敏模板用词均按 **欧洲葡** 维护，与 Mesa **`pt` → `pt-PT`**（如 `src/lib/i18n/messages.ts`）一致。**唯一**决定小票 / **档口出品联** / 预结的 **`payload.locale`**：`payload.locale = print_locale`（入队时复制进快照）。**不与** `country_code` 做映射表。注册 / onboarding **三选一**，未选时默认 **`pt`（欧洲葡）**；**dashboard 餐厅设置** 随时修改，无需改国家。 |
| **票面语言（多语言小票）** | **第一期：整张票单一语言**（`payload` 须含 **`locale`（或 `lang`）** 一种，与 `print_locale` 一致）。**同一票面中英葡并列 / 双语对照** **不做**（列 **P2**）。**不**用操作员 Mesa 界面语言、**不**用浏览器语言、**不**用 GPS/IP。 |
| **入队幂等（`print_jobs`）** | **第一期**：**`order_receipt` / `pre_bill`**：**每次点击「打印」新建一条** `print_jobs`。**`station_ticket`**：**下单/加单自动入队**时 **同一 `batch_id` 请求内 `insert` 多条**（每档口一条）；**pending/processing** 重复则跳过。**「仅重打单一 `print_station`」**：列 **P2**。**不**要求 `client_request_id`；**`station-tickets/auto`** 有 **按 IP/单批** 限流。**若日后**需更强去重，再引入 **`Idempotency-Key`**（**P2**）。 |
| **无代理时打印（兜底）** | **已确认**：本店 **尚未配对打印助手 / 无可用代理**（或代理离线、队列失败等，具体触发条件产品可收窄）时 **保留现有 `window.print()` HTML 出纸**，**避免**完全无法打印；**有代理且链路可用** 时 **仍以 `print_jobs` → 代理热敏为主路径**。**Mesa** 可提示：「未连接打印助手，已使用浏览器打印」。**不**把「无兜底」列为第一期选项。 |

### 已确认技术选型

| 项 | 决策 |
|----|------|
| **代理实现语言** | **Go**（单文件 exe、易交叉编译；Realtime 可用官方/社区 **Supabase Go 客户端** 或 **REST + Realtime WebSocket** 自接，见实现时选型）。 |
| **任务投递** | **第一期即上 Supabase Realtime**（`postgres_changes` on `print_jobs`）；**轮询仅作断线补偿 / 低频兜底**，不作为主路径 MVP。 |
| **仓库位置** | **与 Mesa 同一 Git 仓库**，路径 **`apps/print-agent`**；CI 用 `paths` 过滤；将来若拆库再迁。 |
| **P0 打印相关 API 落点** | **Next.js `app/api`（Route Handlers）为主**：`pairing`（`POST`）/**`pairings`（`GET` 只读列表，已定）** /**`print-jobs/recent`（`GET` 最近条数，已定）** / `claim` / `print-jobs` 入队、设备吊销等 **业务、限流、审计** 与 Mesa **同仓同部署**；密钥与观测走 **现有 Next 托管栈**（如 **`SUPABASE_SERVICE_ROLE_KEY` 仅服务端 env**，不进浏览器）。**刻意避免与 Supabase 过多耦合**：**不**把第一期主路径放在 **Supabase Edge Functions**（免增 Deno **另一套发布、日志、排障**）；Supabase 承担 **Postgres + RLS + Realtime（及 Auth）** 的 **数据与订阅** 即可。Edge Functions **仅在未来个案**（强隔离、重计算）再评估。 |

### 已确认网络与打印机

| 项 | 决策 |
|----|------|
| **第一期主路径** | **网口热敏**，代理 **`TCP` → `主机:9100`（RAW / JetDirect）**，与 Go `net.Dial` 方案一致。 |
| **「固定 IP」含义** | 店内 **RFC1918 私网地址**（常见 **`192.168.*.*`**，亦可能 `10.*` / `172.16–31.*`），**每店、每台打印机不同**，不是全球写死常数。 |
| **如何固定** | **优先路由器 DHCP 保留**（按打印机 MAC 总是分配同一地址）；次选打印机面板设静态 IP。 |
| **配置落点** | `printer_host`（及端口，默认 9100）写在 **代理本机配置**（配对向导或 `config.json`），**不进 Mesa 仓库**；换路由或改网段时 **改一次配置**即可。 |
| **纯 USB** | **不作为第一期**；多收银、SaaS 与自建代理解耦成本高，列入 **P2 或兼容项**（若做，再走系统打印队列等单独路径）。 |
| **热敏纸宽（ESC/POS 模板）** | **第一期锁定 80mm**（标称 80mm，实际纸宽约 **79.5±0.5mm**；葡/EU 餐饮收银最常见）。代理与模板 **仅按 80mm 行宽/字号实现**，**不**做 58mm 分支。**58mm 便携机** 若出现，列 **P2**（再增加 `paper_width_mm` 与第二套模板）。 |
| **第一期参考样机（验收基准）** | **UNYKA UK56009**（铭牌型号 **UK56009**）：**80mm** 热敏收据机、**ESC/POS**、**USB+LAN**（**第一期代理主路径**：**LAN → TCP RAW `IP:9100`**；**USB** 直连列 **P2**，与文首「纯 USB」一致）。铭牌标称 **约 230mm/s**、**钱箱 24V** 等 **不**改变首期队列协议；**字符编码 / 中欧葡重音** 以 **本机打样** 为 **首期定稿依据**。仓库内参考图：**[`docs/assets/reference-printer-unyka-uk56009.png`](./assets/reference-printer-unyka-uk56009.png)**。**官方技术页 PDF**（Unykach，文件名 *Ficha-Impresora-Termica-POS5-UK56009*）：[`https://unykach.com/wp-content/uploads/2024/09/Ficha-Impresora-Termica-POS5-UK56009.pdf`](https://unykach.com/wp-content/uploads/2024/09/Ficha-Impresora-Termica-POS5-UK56009.pdf) — 在 **「CARACTERES」** 段列出 **PC347 / PC850 / PC860(Portuguese) / … / WPC1252 / PC852 / Pc858 / …** 等 **Code Page 类**字符集；**该 PDF 全文未出现 UTF-8**（是否仍可通过 ESC/POS 指令切 UTF-8 须 **编程手册或实机打样** 核实）。若日后换主力型号，在本表 **追加行** 或维护 **`docs/` 样机对照表**，**不**删本行历史基准。 |
| **字符编码 / 中文** | **`locale` 含 `zh`** 时须选用 **打印机支持** 的编码路径（**UTF-8 机型**优先 UTF-8；否则 **Epson/Star 等** 按手册 **Code Page / 汉字模式**，常见涉及 **GB18030 / CP936** 等——**首期以参考样机 UNYKA UK56009 打样定稿**，见上表）。**`pt`（欧洲葡）/ `en`** 与葡语重音：官方 UK56009 技术页 **已列** **PC860(Portuguese)**、**WPC1252**、**PC850(Multilingual)** 等，**宜**与打样结果对照；**UTF-8** 若实机可用再选，**未**在技术页中作为 advertised 项。**趋势说明**：近年 **网口热敏新机** 提供 **UTF-8 或可切换 UTF-8** 的越来越多，但 **存量与低端机型** 仍常见 **仅 Code Page**；**未打样前不得**假设「全店 UTF-8」，代理侧宜 **可配置编码**（如 `utf8` / `cp1252` / …）与 **样机对照表**。 |

### 已确认店内公网出口

| 项 | 决策 |
|----|------|
| **收银机出网** | 可稳定访问 **公网 HTTPS**（**Supabase REST/Realtime/WSS**、Mesa **claim / 业务 API**）；按此假设做 **第一期**（默认直连，无 `HTTP_PROXY`）。 |
| **企业代理 / 封闭网络** | **第一期不兼容**（不实现 PAC、MITM 企业根证书、CONNECT 隧道等）；若某店仅有代理出网，列为 **例外支持 / P2**：放行域名 + 可选 `HTTPS_PROXY` 或现场网络整改。 |

### 已确认安装包分发

| 项 | 决策 |
|----|------|
| **渠道** | **仅 GitHub Releases**（`action-gh-release` 上传 **Inno Setup 安装包**、**便携 zip**、`SHA256SUMS`）；Mesa 后台下载链指向 **`https://github.com/<org>/<repo>/releases/...`**（**主链见「安装形态」**）。 |
| **代理语言（Windows 端）** | **已定 Go**（见 **已确认技术选型 · 代理实现语言**）；与 Mesa **TypeScript** 分栈，**不**改为 Node/Electron 作为第一期 Windows 代理实现。 |
| **Windows 代码签名（Authenticode）** | **已定不买签名（第一期）**（**不购买**证书、CI 不跑签名）；店长安装时可能出现 **SmartScreen /「未知发布者」**，靠 **固定 GitHub URL** + **`SHA256SUMS` 人工核对** + **打印助手内简短说明**（如「仍要运行」、属性中解除锁定）缓解；**后续再评估** 购买 OV 等证书并接入发布流水线，以改善 SmartScreen 与防冒名。 |
| **安装形态（第一期）** | **双产物（已定）**：① **Inno Setup 向导安装包**（每架构一枚 **`MesaPrintAgent-Setup-<ver>-<arch>.exe`**，或单盘内 **显式选 x64 / ARM64** — 实现期定）：开始菜单快捷方式、**控制面板卸载**、**「用户登录 Windows 时自动启动代理」（开机自启）安装步骤内默认勾选**（店主可取消；实现以 **`HKCU`…`Run` 或「当前用户」任务计划** 为宜，**避免**无必要写 **`HKLM`**）。② **便携 zip**（`MesaPrintAgent-windows-<arch>.zip`，内含 `exe` + 说明）：**免安装**双击，供排障与不愿写注册表场景。**Mesa「打印助手」主下载按钮**：**默认指向 amd64 的 Inno 安装包**；zip 为 **次要链接**（「免安装 / 高级」）。**P0 联调**可先用 zip；**P1 对外交付**须含 **Inno + 自启**（见 **§二 · P1-4**）。 |
| **Windows 架构** | **必达、必测**：**amd64（x64）**。**尽力兼容 ARM64**：与 **zip** 相同，**Inno Setup** 须 **分架构各一 Setup** 或 **安装向导内选择/检测架构**，**禁止**在 ARM64 Windows 上静默装错 x64 二进制。CI：**`GOOS=windows` + `GOARCH` 矩阵** 双编 `exe`，再各打 **zip** 与 **Setup**。 |
| **自有域名 / OSS / CDN / 备案** | **第一期不做**；若国内访问 GitHub 不稳或合规要求自建分发，再列 **P2** 同步到 R2/OSS 并配置 `NEXT_PUBLIC_PRINT_AGENT_DOWNLOAD_URL`。 |

### 已确认配对码与安全参数（与 §5.1 一致）

| 项 | 第一期推荐 | 理由 |
|----|------------|------|
| **形态** | **6 位数字**（`crypto` 随机；**禁止**弱码如 `000000`、`111111` 等可配置黑名单） | 易口述、易输入；空间仅 **10⁶**，**必须**靠 TTL + **claim 强限流** + **生成频率** 补安全。升级路径（P2）：**8 位**不含混字符集（去 `0`/`O`、`1`/`I`）提高熵。 |
| **有效期 TTL** | **10 分钟**（可配置 **5～15 分钟**） | 平衡「店员走到收银机」与「缩短枚举窗口」；**不宜**超过 15 分钟。 |
| **生成频率（网络安全）** | **按店 `restaurant_id` 滑动窗口**：例如 **最多 6 条有效配对/小时**（成功写入 `pairings` 即计数）；**按操作者**：同一登录用户 **最多 10 次/小时**；**防抖**：两次点击间隔 **≥ 60s（1 分钟）** | 防盗刷、防误触连点；**1 分钟**比 30 秒更压脚本/连点，仍远小于 TTL（10 分钟），正常「生成 → 走去输入」几乎不受影响。 |
| **配对码并行条数（单店，未过期窗口）** | 同一 `restaurant_id` 下，**仍未过期**（`expires_at > now()`）的 `print_agent_pairings` **总行数上限为 3**，**含已核销**（已写 `consumed_at`）与 **未核销**（`consumed_at` 为空）**一并计数**。已核销行 **不可再次 claim**，但在 **过期前仍占一格**；**过期后**不再计入本上限，无需手动作废 pairing 行。**再 `create`**：若 **未过期行数 ≥ 3** → **不** insert、返回 **409 Conflict**（不用 429）；**少于 3 条** → 正常 insert。**不**为腾格子而自动删除或改最旧行。Mesa：**只读列出** 当前所有 **未过期** 行（最多 3，可标「待使用 / 已使用」）；**未过期且已达 3 行** 时禁用「生成」或点击即提示（仍以服务端校验为准）。 |
| **`claim` 限流** | **按客户端 IP**：例如 **30 次/分钟**（全路径合计）；**错误码惩罚**：同一 IP **连续 5 次错误** → **15 分钟内拒绝 claim**（HTTP 429 + `Retry-After`） | 防对公网 `claim` **撞码**；与 TTL 叠加控制暴力枚举成本。 |
| **核销语义** | **仅成功 claim 写 `consumed_at`**；错误尝试 **不消费** 码但 **计失败次数**（可对「单码」设每码每 IP 5 次/分钟） | 防「试到锁死合法用户」：单码限次要略宽松于全局限流。 |
| **`GET .../pairings` 与 `POST .../pairing` 的码展示（已定）** | **`GET` 响应**：每条仅 **`code_mask`**（**禁止**字段名 **`code`** 或 **6 位明文**）。**`code_mask` 规则**（`code` 为 **6 位数字**）：① **`consumed_at` 为空**（待使用）：**前 4 位为 `*`，后 2 位为原码第 5–6 位** → 固定 **6** 字符，例 **`****56`**。② **`consumed_at` 非空**（已核销）：**`******`**（全掩）。**`POST` `create` 成功**：响应体 **须含** **`code` 完整 6 位** + `expires_at` 等（**仅此一次**明文出网；供店长当次口述/复制）；Mesa **须**显著弹层/横幅展示；**再次 `GET` 列表**时该行仅以 **`code_mask`** 出现。 | 列表防 shoulder surfing / 截图泄露；仍能在最多 3 条待使用中区分「后两位不同」；漏记依赖 **新码**（受并行条数与限流约束）。 |

### 已确认代理 token 生命周期（与 §5.2 一致）

| 项 | 第一期推荐 | 说明 |
|----|------------|------|
| **最长使用期** | **90 天（3 个自然月）** 自 **claim 成功** 起算；期满 **必须重新配对**（旧凭证作废，API 返回明确错误码） | 与 **第一期凭证形态**（单条 JWT）一致：即 **`exp` = claim_time + 90d**。 |
| **第一期凭证形态** | **单条 scoped JWT**（**不**在第一期实现 **access + refresh** 双票轮换）：**`exp` = claim_time + 90d**；**`POST .../claim` 成功响应 JSON** 中 JWT 字段 **唯一写死为 `agentjwt`**（**禁止**同响应再出现 `token` / `agent_jwt` 等别名，代理与 OpenAPI/实现 **一律读 `agentjwt`**）+ `supabase_url` + **`valid_until`**（与 `exp` 对齐供 UI）；代理 **本地持久化 `agentjwt`**，**无** refresh HTTP 流程 | **省事**：代理无定时换票、无 refresh 失败重试分支。**隐患**：① **泄露窗口长**（最长至过期或 **`revoked_at`**），靠 **RLS 最小权限**、**`device_id` claim**、**按设备吊销** 补；② **90 天内无法静默轮换**同一 JWT（除非服务端发新 JWT 并推送——本期不做），**签名密钥轮换** 将导致全体重配；③ **设备时钟** 偏差过大时 `exp` 判定异常，代理应 **NTP 或** 对 `exp` 留 **±几分钟 skew**。**演进（P2）**：可改为 **短 access + refresh**，且 **refresh 链总寿命仍 ≤ 90d**。 |
| **强制重新配对** | 满 90 天 **仅能通过新配对码** 换新凭证；代理检测到 401/过期后弹 **「请重新配对」** | 降低设备丢失后长期有效风险。 |
| **提前提醒** | **双通道（均建议保留）**：① **Mesa 功能端（Next.js / Node：`app/dashboard`、Route Handlers、`createClient` 等）— 必做（P0-D）**：**到期前 15 天**起，须 **两处 UI**（**缺一不算达标**）：**（a）`/dashboard` layout 顶栏全局 Alert/条（已定）**，**任意 dashboard 子页**可见，文案含 **日期** 与 **重新配对** 指引（可链至 **「打印助手」**）；**（b）「打印助手」** 区块内 **Alert / 横幅 + 具体日期**（如「将于 yyyy-mm-dd 需重新配对」）。数据来自本店 **`print_agent_devices`** 中 **`valid_until` 将至** 的设备。**店主开浏览器即可看到**，不依赖 Windows 代理是否运行。② **代理托盘（已定 P1，§二 · P1-3）**：本地 **`valid_until`**，**每次启动**一次 + **每日至多一次** 托盘气泡 / Toast；**未进 15 天窗口不弹**。**托盘不替代** ①；两路 **互补**，覆盖「只开浏览器 / 只开收银代理」两类习惯。 | 避免到期当日才发现停打。 |
| **多设备 / 不互踢** | **新 `device_id` 成功 claim** 时：**仅**为该设备签发/登记 token 与 `print_agent_devices` 行；**不** `update` 同店其它设备的 `revoked_at`、**不**使旧机 token 失效 | 与「多收银机」一致；**离职/丢机** 必须依赖 **显式吊销**（`revoked_at`）或 **90 天满期**，不得依赖「新配对自动踢旧机」。 |
| **吊销后 JWT 立即失效（方案已定、实现顺延）** | **【当前迭代】**：与 **实施顺序** 一致 — **先** 完成 **`print_stations` 与出品入队主线**，**吊销 RLS + dashboard 吊销操作流** **顺延**，**不**挡表结构与打单逻辑定稿。**方案不变**（**不**删）：代理经 `agentjwt` 访问的 **`print_jobs`（及 Realtime）** 须 **RLS** 子查询 **`print_agent_devices`**：**`revoked_at is null`** 且 **`valid_until > now()`** 且 **`device_id` / `restaurant_id` 与 JWT 对齐**（伪码同前表版本）。**不**以 **`jti` 黑名单表** 为默认首期实现。**`print_agent_devices`**：**migration 预留列**即可。**硬底线**：**代理拉生产 `print_jobs` 对外上线前**须完成 **写 `revoked_at` 后立即失 DB 访问** 与 **REST + Realtime 验收**。**运营代客吊销** 仍为 **P2 UI**。 |

---

## 阶段划分总览

| 阶段 | 应用端（Mesa + Supabase） | 安装包端（打印代理） |
|------|---------------------------|----------------------|
| **P0** | **`print_stations` + 类目/品绑定**、`print_jobs` 入队（`station_ticket` 分组）、**Realtime**；配对码与下载入口；**`print_agent_devices` 可建表预留吊销列**（**吊销 RLS 验收顺延**，见 **实施顺序**）；**凭证 `valid_until` 到期前 15 天：`/dashboard` 顶栏 +「打印助手」双处提醒（必做，见 P0-D）**；**「打印助手」最近 5 条 `print_jobs` 排障列表（必做，见 P0-D + `GET .../print-jobs/recent`）** | **`apps/print-agent`（Go）**：配对 + **Realtime 为主** + 补偿 `select` + TCP 打印 + 日志 |
| **P1** | 订单历史「打印」写入队列；任务状态/失败原因展示 | **Inno Setup 安装包 + 用户登录时自动启动（开机自启，默认勾选，已定，见 P1-4）** + **便携 zip** 同 Release；**托盘到期提醒**（`valid_until` 前 15 天，**已定**，见 **P1-3**） |
| **P2** | 多打印机、**仅重打单一 `print_station`（UI + 入队）**、速率限制与审计 | 自动更新提示；可选 Mac 包 |

以下步骤按 **P0 → P1** 展开；P2 为扩展。

---

## 0. 实时拉取（第一期：Realtime 为主）

| 方式 | 说明 |
|------|------|
| **Supabase Realtime（postgres_changes）** | **主路径**：`INSERT print_jobs` 后代理 **立即** 收到；须在控制台对 `print_jobs` **打开 Realtime 发布**；代理 JWT + RLS 仅本店。 |
| **轮询** | **兜底**：WebSocket 断线重连后 `select pending`；可选每 60s 低频轮询防漏；**不作为第一期主实现**。 |

**应用端**：为 `print_jobs` 启用 Realtime；RLS 保证代理身份只能读/写本店任务行。

**代理端（Go）**：使用 **Supabase Realtime**（例如 `github.com/supabase-community/realtime-go` 或与 **官方 Realtime 协议** 兼容的 WebSocket 客户端）订阅 `INSERT`；收到事件后 **乐观锁 `pending`→`processing`** → 组 ESC/POS → `net.Dial` + `Write` 至 `PRINTER_HOST:9100` → PostgREST/`PATCH` 更新 `done`/`failed`；连接错误时 **指数退避重连** 并执行一次 **补偿查询**。

（纯轮询 MVP 已 **不采用**；仅作历史对比时可提及。）

---

## 一、应用端（我们程序）— 具体步骤

### P0-A：数据库与 RLS

1. **新建表 `print_agent_pairings`（或合并进单表）**  
   - 字段建议：`id`、`restaurant_id`、`code`（6 位数字或短码）、`expires_at`、`consumed_at`、`device_label`（可选）、`created_by`（owner user id）。  
   - 索引：`code` + `expires_at` 用于核销；`restaurant_id`。

2. **新建表 `print_jobs`**  
   - `id`（uuid）、`restaurant_id`、`type`（**`order_receipt` | `station_ticket` | `pre_bill`**，第一期三值）、`payload`（jsonb：**创建任务时写入的冻结快照**——须含 **`order_id`**（**试打**见 P0-3：**占位 UUID**，不指向真实订单）、**`locale`（或 `lang`）** = 入队时 **`restaurants.print_locale`**，以限定 **全票单一语言**（见 **已确认产品与场景**）；**`type=station_ticket`** 时还须含 **`print_station_id`**、**`batch_id`**（见 **已确认 · 出品与加单批次**）、**`ticket_layout` / 档口展示名** 等 **快照字段**；可选 **`connection_test: true`** 表示连接试打；行项目、价、合计等按类型与纸面一致，**不可变**）、`status`（`pending` | `processing` | `done` | `failed`）、`claimed_by`（代理设备 id，可选）、`attempts`、`error_message`、`created_at`、`updated_at`。  
   - 索引：`restaurant_id` + `status` + `created_at` 供代理拉取。

3. **RLS**  
   - `print_jobs`：**餐厅 owner**（或未来员工角色）可 `insert` / `select` 本店；**代理**不直接用 anon 写 raw key 拉全库——见 P0-B。  
   - `pairings`：仅本店 owner 可 `insert`/`select` 未过期记录。

4. **迁移文件**  
   - `supabase/migrations/..._print_jobs_and_pairings.sql` + policy + `grant` 若需 service role 仅服务端使用。  
   - **`restaurants.country_code`**：若尚无，在同一批或前置 migration 增加 **`country_code char(2) not null`**（ISO 3166-1 alpha-2）；**存量** 行须先 `UPDATE` 回填再 `NOT NULL`（见 **已确认产品与场景 · 门店国家**）。**店主注册 / 管理员代建** 表单必填。  
   - **`restaurants.print_locale`**：若尚无，增加 **`print_locale text not null default 'pt' check (print_locale in ('zh','en','pt'))`**（**`pt` 表示欧洲葡萄牙语 `pt-PT` 语义**）；注册/设置可选显式选择，否则默认 **`pt`**；dashboard **餐厅设置** 可改。**打印入队**时 **`payload.locale = print_locale`**（见 **已确认产品与场景 · 默认打印语言**）。

### P0-B：配对与「代理凭证」（避免把 service_role 塞进安装包）

**落点**：**Next.js `app/api`**（见 **已确认技术选型 · P0 打印相关 API 落点**），**不**以 Edge Functions 为主路径。

**推荐（第一期）**：代理持有 **单条 scoped JWT**（**90d `exp`**），由 **`claim` 下发**；形态见文首 **「已确认代理 token 生命周期 · 第一期凭证形态」**。（历史备选：短 access + refresh，列 **P2**。）

1. **Route：`POST /api/print-agent/pairing`**（需登录 dashboard）  
   - Body：`{ "action": "create" }` → 统计本店 **`expires_at > now()`** 的 `print_agent_pairings` **总行数**（含已核销）；**少于 3** 则生成 `code`、`expires_at` 并写入；**已达 3** → **不写入**，**409** + 文案（见 **已确认配对码与安全参数 · 配对码并行条数**）。**成功 `200`**：JSON **须含** **`code`（6 位明文，仅此响应）**、`id`、`expires_at` 等（见 **已确认配对码与安全参数 · `GET` 与 `POST` 的码展示**）；**不**依赖后续 `GET` 取明文。

2. **Route：`GET /api/print-agent/pairings`（已定，只读）**（需登录 dashboard）  
   - 返回本店 **`expires_at > now()`** 的 `print_agent_pairings` 行（**最多 3 条**，含已核销），每条含 **`code_mask`**（**掩码规则见文首「已确认配对码与安全参数 · `GET` 与 `POST` 的码展示」**；**禁止**返回 **`code`** 明文）、**`expires_at`**、**`consumed_at`**（判待使用/已使用）、**`id`** 等；**不**经浏览器直连表拉列表（统一走 **Next** 便于脱敏、审计与限流）。**打印助手**进入区块时 **调用此 `GET`** 刷新列表。

3. **Route：`GET /api/print-agent/print-jobs/recent`（已定，只读）**（需登录 dashboard）  
   - Query：默认 **`limit=5`**（上限例如 **20**，防刷）。返回本店 **`print_jobs`**，**`ORDER BY created_at DESC`**；字段至少 **`id`、`type`、`status`、`created_at`、`error_message`**（可空）；**不**默认返回完整 **`payload`**（体积与敏感快照；若需可另加 **截断摘要** 字段 — 实现期定）。**「打印助手」** 内 **排障列表** **仅经此 `GET`**（与 **`GET .../pairings`** 一致，**不**经浏览器直连表）。

4. **Route：`POST /api/print-agent/claim`**（**无需**登录；HTTPS + 限流）  
   - Body：`{ "code": "123456", "device_id": "uuid", "label": "收银台1" }`。  
   - 校验码未过期且未消费 → 标记 `consumed_at` → **为该 `device_id` 登记/更新 `print_agent_devices`**（**不**吊销同店其它 `device_id`）→ 返回：`supabase_url`、**`agentjwt`**（字符串，单条 scoped JWT，**`exp` = claim + 90d**，见文首 **第一期凭证形态**）、**`valid_until`**（与 `exp` 一致即可）、**无** `refresh_token`（第一期）；由服务端用 **service role** 签发或等价机制；凭证 **提前提醒** 见文首 **「已确认代理 token 生命周期」**。

5. **文档**：说明代理 **只持久化 `claim` 响应中的 `agentjwt`**，不写 `service_role` 到磁盘明文（可加密写本地 store）。

> **不推荐（第一期）**：将配对 / `claim` / 入队 **整套** 迁入 **Supabase Edge Functions**——与 **已确认技术选型 · P0 打印相关 API 落点** 相悖，且加深与 Supabase **运行时与发布** 的耦合。

### P0-C：代理拉任务与确认（服务端）

1. **任务获取**：代理 **以 Supabase Realtime 为主**（用 **`agentjwt`** 订阅 `print_jobs`，`restaurant_id` 过滤、`INSERT` 事件）。**补偿**：重连或启动时 `GET` PostgREST / `select` 未处理 `pending`；可选低频轮询。  
   - ~~仅 REST 轮询~~：不作为第一期主路径。

2. **`PATCH /api/print-agent/jobs/:id`**（或 Supabase `update`）  
   - 代理：`pending` → `processing`（乐观锁 `id + status`）；完成后 `done`；失败写 `failed` + `error_message`。

### P0-D：后台 UI（Mesa）

1. **餐厅设置**（或桌位旁）新增 **「打印助手」** 区块：  
   - 按钮：**生成配对码**；**成功创建后** 以 **`POST` 响应中的 `code`（6 位明文，仅此一次）** 做 **显著弹层/可复制**；**进入区块或打开弹层时** 调用 **`GET /api/print-agent/pairings`** 拉列表，行内 **仅展示 `code_mask`**（见 **已确认配对码与安全参数**）。若 **未过期行数已达 3**：**禁用「生成」** 或点击即 **客户端提示**（与 **409** 文案一致）；**少于 3** 时可继续生成。  
   - 链接：**下载 Windows 打印助手** — **主：Inno 安装包（amd64）**；**次：便携 zip**（见 **已确认安装包分发**）。  
   - 短文：**安装 → 打开助手 → 输入码 → 填打印机局域网 IP（建议路由器 DHCP 保留）→ 点试打**。  
   - **默认打印语言**：由 **`print_locale`**（`zh` / `en` / **`pt` = 欧洲葡 `pt-PT`**）决定（见 **已确认产品与场景**）；在 **餐厅设置** 中展示并允许修改。  
   - **凭证将到期（必做）**：**到期前 15 天**起，凡本店存在已配对设备且 **`valid_until` 进入提醒窗口**（与文首 **已确认代理 token 生命周期** 一致），须在 **Mesa 功能端（Next.js / Node）** 展示 **不可忽视的提醒**，**且须包含**：**（1）`/dashboard` layout 顶栏全局条（已定）** — **任意子页**可见，含 **日期** 与 **重新配对** 指引（可附「打开打印助手」链）；**（2）「打印助手」** 区块内 **Alert / 横幅 + 具体日期**。**数据**来自 **`print_agent_devices`**（经 **RLS + owner** 的 `select`，或 **`app/api` 聚合** 后由客户端展示）。**与 Windows 代理托盘（P1-3）为双通道**，**功能端提醒不因「未装代理」而省略**。  

2. **最近 `print_jobs` 排障（已定，必做）**：在 **「打印助手」** 内展示本店 **按 `created_at` 倒序最近 5 条**（**条数 5** 为文档约定，实现可配置 **≤20** 不改变语义）；**进入区块或定时刷新** 时调用 **`GET /api/print-agent/print-jobs/recent`**（见 **P0-B**）。列 **至少**：**`type`、`status`、`created_at`**；**`failed` 时 `error_message`**；**`id`**（与代理日志对照）。**不**在列表中展开完整 **`payload`**（见 **P0-B** 该 Route 说明）。

### P1-E：业务接入

1. **`OrdersHistoryManager`、账单（预结）** 等（**`station_ticket` 已由下单自动入队**，**无**厨房/服务员手动打印入口）  
   - **三类 `print_jobs` 同一套路径**（**有代理时**）：**`station_ticket`** → **`station-tickets/auto`**（订单提交后）；**`order_receipt` / `pre_bill`** → 点击「打印」→ **`insert print_jobs`**，**`locale`** = **`print_locale`**，**payload** 冻结快照。代理 **RAW 热敏**出纸；**无代理** 时 **`window.print()` 兜底**（见 **无代理时打印**）。  
   - **档口出品联**：按 **`batch_id` + `effective_station_id`** 分组（见 **出品与加单批次**）；版式 **`payload.ticket_layout`**。

2. **幂等与重复打印**（见 **已确认产品与场景 · 入队幂等**）  
   - **第一期**：**`order_receipt` / `pre_bill`**：**每次点击** 一条；**`station_ticket`**：**每批提交自动** 多条（每档口一条），**pending 重复跳过**。  
   - **`client_request_id` / 服务端去重**：**不做**（列 **P2**，待产品明确防重复需求再上）。  

3. **权限**  
   - 第一期：**仅 owner（dashboard 登录）** 可创建 `print_jobs` / pairing；与「店长」产品口径对齐后，再改为 owner **或** `restaurant_staff` 中带店长角色者。

---

## 二、安装包端（打印代理）— 具体步骤

### P0-1：运行时与仓库结构

1. **选型（已锁定）**：**Go**，目录 **`apps/print-agent`**（与 Mesa **同一仓库**）；`go.mod` 模块名建议 `github.com/<org>/restaurant-ordering/apps/print-agent` 或独立 module 路径按你们 Git 托管定。  
2. **版本**：与 Git tag `print-agent-v*` 对齐（见 §四 CI）。

### P0-2：核心流程

1. **首次启动**  
   - 若无本地配置：展示 **仅一个输入框「配对码」** + 按钮「连接」。  
   - 调用 `POST .../claim` → 得到 `restaurant_id`、**`agentjwt`**、`supabase_url`、`printer_hint`（可选）。

2. **持久化**  
   - 将 **`agentjwt`** 等写入 `%APPDATA%/MesaPrintAgent/config.json`（Windows）或 `~/.config/...`；文件权限仅当前用户。

3. **主循环（Realtime 为主 + 兜底）**  
   - **主路径**：Realtime 订阅本店 `print_jobs` 的 `INSERT`（必要时含 `UPDATE`）；事件入本地 **单线程打印队列**，避免并发抢 USB/网口。  
   - **兜底**：重连后 `select` 一次 `pending`；可选每 60s 低频轮询。  
   - 处理单条：`update` → `processing`；组 ESC/POS；`TCP` 写 `PRINTER_HOST:9100`；`update` → `done`/`failed`。

4. **配置项（有默认值，小白可不改）**  
   - `printer_host` + `printer_port`（默认 **9100**）：若 claim 未带，由 **向导输入**（即该店打印机在局域网中的地址，见 **已确认网络与打印机**）。后台「打印助手」说明里附带 **DHCP 保留** 图文链接。  
   - **纸宽**：第一期 **固定 80mm**，**不写**可配项；模板与 ESC/POS 按 **80mm** 实现（见 **已确认网络与打印机**）。  
   - 兜底轮询间隔（若启用）：默认 60s。

5. **日志与排障**  
   - 滚动日志文件 + 托盘菜单「打开日志目录」。

### P0-3：试打

1. **不增加** 单独 **`agent_test`** 等试打用 `type` 枚举；与 **已确认产品与场景** 一致。  
2. **推荐**：**应用端**在 **`claim` API 成功** 后 `insert` 一条 **`print_jobs`**：`type` = **`order_receipt`**，`payload` 含 **`connection_test: true`**、**`order_id`** = **占位 UUID**（全库统一常量，**不** `join orders`）、**`locale`** = 本店 `print_locale`，行项目等为 **固定最小结构**（或空数组 + 一行说明文案）。代理消费时：若 **`payload.connection_test === true`**，则组 **固定 ESC/POS 测试条**（一两行字即可），**不**按真实订单渲染。  
3. **备选**：不配库、由代理在 claim 成功后 **本地直接 TCP 写测试字节**——与「队列驱动主路径」略不一致；**优先** 走 **(2)** 以便验证 Realtime / 乐观锁全链路。

### P1-3：代理托盘到期提醒（已定）

1. **触发条件**：已配对且本地可读 **`valid_until`**；当 **`now` ≥ `valid_until` − 15d`** 且凭证仍有效时进入提醒窗口（与文首 **已确认代理 token 生命周期 · 提前提醒** 对齐）。  
2. **形态**：**系统托盘**图标存在时，使用 **气泡或 Windows 10+ Toast**（实现选型以 Go 生态为准）；文案含 **失效日期** 与 **「请到 Mesa 打印助手生成配对码并重新连接」** 指引。  
3. **频率**：**每次代理进程启动**若处于窗口内则提示 **一次**；常驻运行则 **每自然日至多一次**（避免连弹）。  
4. **与 Mesa（功能端）关系**：**Mesa / Next（Node）侧** 须 **顶栏 +「打印助手」** 双处 **15 天到期提醒（必做，P0-D）**；本 **托盘** 为 **补充（P1）**，覆盖「收银机常开、浏览器不常开 Mesa」场景；**两路并行**，文案对齐。

### P1-4：Windows 安装包（Inno Setup + 开机自启，已定）

1. **产物**：每架构 **`MesaPrintAgent-Setup-<ver>-amd64.exe`** / **`...-arm64.exe`**（或与 **zip** 同版的 **单文件名**，以 CI 为准）+ **便携 zip**（见 **已确认安装包分发**）。**安装器选型**：**已定 Inno Setup**（脚本、开始菜单、卸载、**登录启动** 一体化）；**NSIS / WiX** 仅作团队已有资产时的备选，**不**与「已定 Inno」并行维护多套脚本（除非后续产品要求）。  
2. **安装步骤**：选路径 → 创建开始菜单快捷方式 → **「安装完成后，用户登录 Windows 时自动运行 MesaPrintAgent」默认勾选**（**开机自启**；用户可取消）— 实现为 **`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`** 或 **当前用户**任务计划（**优先**不写 **`HKLM`**，免管理员提权）。  
3. **卸载**：Inno 卸载程序移除 **Run / 任务计划** 项 + 开始菜单；**可选**保留 `%APPDATA%\MesaPrintAgent\config.json`（提示用户）。  
4. **代码签名**：与 **已确认安装包分发** 一致——**第一期不签**；安装文档 / 打印助手内提示 **SmartScreen** 操作；**后续** 再接入 **Authenticode**。

### P1-5：分发（已确认：GitHub Releases）

1. **GitHub Releases** 挂 **每架构 zip + Inno Setup** + `SHA256SUMS`（见 §4.2）。  
2. Mesa 后台下载链接指向 **同一 GitHub 仓库 Releases**（`latest` 或固定 tag）。  
3. **（可选）** 安装包内嵌 **当前 Supabase 项目 URL**，减少 claim 返回字段（仍建议 claim 动态返回 **`agentjwt`**）。

### P2-6：扩展（后续）

1. 启动时请求 `https://.../print-agent/version.json` 比对版本，提示下载。  
2. macOS：`.pkg` 或 notarized `.app`（签名与公证成本更高）。  
3. 多打印机：`config.json` 里 `printers[]` + `print_jobs` 带来 `printer_slot` 字段。  
4. **纯 USB 打印机**：系统队列 / 驱动路径（与网口 RAW 分离实现）。  
5. **平台运营后台**（与 **店主 Mesa `/dashboard`** **分系统、分鉴权**，见 `research.md` §1.1）：**跨店**只读 **`print_agent_devices`** 元数据（`restaurant_id`、`device_id`、`label`、`paired_at`、`valid_until`、`revoked_at`、代理版本等）、**代客吊销**（写 **`revoked_at`**；**底层拒绝逻辑** 与 **店主 dashboard 吊销** 相同，见文首 **吊销后 JWT…（方案已定、实现顺延）**）、只读 **`print_jobs`** 排障。**不宜**在运营页长期展示完整 **`agentjwt` 明文**；若需极端排障，用 **一次性、可审计** 的替代方案（短期 support token 等），另开权限与日志。  
6. **短 access + refresh**（refresh 总寿命仍 **≤90d**）：见文首 **第一期凭证形态** 演进说明。  
7. **58mm 热敏**：代理 **`paper_width_mm`** + **第二套 ESC/POS 行宽**（第一期仅 **80mm**，见 **已确认网络与打印机**）。

---

## 三、联调顺序（建议）

1. 应用端：表 + RLS + **claim 假数据**（硬编码返回测试 **`agentjwt`**）验证代理能连 Supabase。  
2. 代理：`apps/print-agent` 下 `go run` / `go build` CLI，如 `agent -code=123456` 打通 Realtime（或补偿 `select`）+ 打 `nc -l 9100` 假打印机。  
3. 接上真机或网口热敏。  
4. Mesa 订单历史写入 `print_jobs` 端到端。  
5. 打包安装程序 + 给一家店试点。

---

## 四、仓库布局与一键发布（已确认：`apps/print-agent` 同库）

### 4.1 仓库策略

| 方案 | 状态 |
|------|------|
| **`apps/print-agent` 与 Mesa 同库** | **已采用**：单 PR 可改 API + 代理；CI `paths` 过滤仅代理变更时构建。 |
| **独立 Git 仓库** | **不采用**（第一期）；若日后拆库，Release 与 claim URL 策略可迁移。 |

### 4.2 「一键打包 + 可下载」推荐做法（GitHub Actions + Releases）

1. **工作流**（`.github/workflows/print-agent-release.yml`）：  
   - 触发：`push` tags 匹配 `print-agent-v*` **或** `workflow_dispatch`（手动一键）。  
   - Job：在 `apps/print-agent` 下 **`GOOS=windows`** **`go build`**，**矩阵**：**`GOARCH=amd64`（必达）** + **`GOARCH=arm64`（尽力）**；每架构产出 **`MesaPrintAgent.exe`** → 打 **`zip`** → 用 **Inno Setup（`iscc`）** 打 **`MesaPrintAgent-Setup-<ver>-<arch>.exe`**（脚本在仓库内，如 `apps/print-agent/installer/*.iss`）；汇总 **`SHA256SUMS`**（**含 zip 与 Setup**）。与 **已确认安装包分发 · 安装形态** 一致。  
   - **上传**：`softprops/action-gh-release` 或 `actions/upload-artifact` + Release，附件挂 **各架构 zip + 各架构 Setup** + `SHA256SUMS`。  
2. **Mesa 后台下载链接**：**主按钮** → **amd64 Inno 安装包**（如 `.../latest/download/MesaPrintAgent-Setup-*-amd64.exe`）；**次链** → 同版 **amd64 zip**；ARM PC → Release 页选 **arm64 Setup** 或 **arm64 zip**（日后可加 Mesa **架构检测 + 双链**，见 **P1** 其它项）。与 **已确认安装包分发** 一致。  
3. **代码签名**：**第一期跳过**；与 **已确认安装包分发** 一致。**后续** 若采购证书，再在 workflow 中增加 **Authenticode** 签名 Step（减少 SmartScreen 拦截）。

> **P2**：若需自有 OSS/CDN（备案、国内加速），在 workflow 中增加同步上传步骤，并改 Mesa 环境变量下载基址（见 **已确认安装包分发**）。

### 4.3 与 Mesa 主站 CI 的关系

- **路径过滤**：`paths: ['apps/print-agent/**', '.github/workflows/print-agent-*']`，避免改菜单也触发代理构建。  
- **版本号**：`apps/print-agent` 内 **`VERSION` 文件或 `-ldflags -X main.version=`** 与 **git tag** 对齐，便于排障。

---

## 五、安全威胁与加固（漏洞面与缓解）

以下按 **攻击面** 归纳；实施时按优先级落在 **API、RLS、代理、发布** 四层。

### 5.1 配对码与 `claim` 接口

**默认数值与形态**以文首 **「已确认配对码与安全参数」** 为准；本节为威胁归纳。**`POST .../claim` 成功体**：JWT 字段名 **唯一** **`agentjwt`**（见文首 **第一期凭证形态**），**禁止**与 `token` / `agent_jwt` 等混用。

| 风险 | 说明 | 缓解 |
|------|------|------|
| **暴力枚举** | 6 位数字空间小 | **短 TTL**；**claim 按 IP 限流 + 错误冷却**；**生成按店/按用户限流**；码 **一次性成功核销**（`consumed_at`） |
| **弱码 / 可预测** | 非随机或规律码 | **CSPRNG**；弱码黑名单 |
| **重放 claim** | 截获请求重复换 token | 成功 **单次核销**；token **绑定 `device_id`**；设备吊销见 §5.2 |
| **无 HTTPS** | 中间人 | **仅 HTTPS**；生产 **HSTS** |
| **刷配对行 / 滥用 owner 会话** | 高频点「生成码」 | **每店每小时上限**、**每用户每小时上限**、**最短间隔**；**未过期配对总行数（含已核销）达 3 时 create 返回 409**（见文首 **配对码并行条数**），**不**叠新行 |

### 5.2 代理凭证（JWT）

**凭证最长寿命、第一期单条 JWT 形态、重新配对、提前提醒** 以文首 **「已确认代理 token 生命周期」** 为准。**多设备是否互踢** 以同表 **「多设备 / 不互踢」** 为准。

| 风险 | 说明 | 缓解 |
|------|------|------|
| **service_role 进安装包** | 等同全库钥匙泄露 | **禁止**；仅用 **`claim` 响应中的 `agentjwt`**（scoped JWT；自定义 claim：`print_agent: true`、`restaurant_id`） |
| **权限过大** | token 能读订单表等 | RLS + **专用 role** 仅 `print_jobs` 的 `select/update`（及必要视图）；**禁止** `*` schema |
| **磁盘明文** | 机器被盗直接读 token | Windows **DPAPI** 或 OS keychain 加密本地配置；日志 **不打完整 token** |
| **无法吊销 / 长期有效** | 员工离职、机器报废 | 表 **`print_agent_devices`**：`revoked_at`、`paired_at`、`valid_until`（= paired_at + **90d**）；**满期强制重配对**；**提前 15 天** dashboard **`/dashboard` 顶栏（已定）** + **「打印助手」** + **代理托盘（已定 P1，见 P1-3）** 提醒；**按设备吊销**（写 `revoked_at`），**不**依赖新配对踢旧机；**立即失效** 见文首 **吊销后 JWT…（方案已定、实现顺延）**（RLS） |
| **多机 claim 与旧 token** | 新装一台是否踢掉旧收银机 | **不踢**（见文首 **多设备 / 不互踢**）：每台 **`device_id`** 独立凭证，直至 **`revoked_at` 或 `valid_until`** |
| **单 JWT 被复制多进程** | 窃听后在第二进程复用同一凭证 | JWT **绑定 `device_id` claim**；服务端校验；异常 **单设备 `revoked_at`** |

### 5.3 多租户隔离（RLS 与业务逻辑）

| 风险 | 说明 | 缓解 |
|------|------|------|
| **claim 时改 `restaurant_id`** | 信任客户端字段 | **`restaurant_id` 只从配对行读出**，请求体不允许覆盖 |
| **RLS 写错** | A 店看到 B 店任务 | 所有 policy **显式** `restaurant_id = auth.jwt()->restaurant_id`（或等价）；**集成测试**跨店各一条 |
| **Realtime filter 注入** | 恶意 filter 串 | 代理侧 **只拼 UUID**，不信任用户输入构造 filter |

### 5.4 `print_jobs` 与 `payload`

**原则**：各 `type` 均以 **入队瞬间的冻结快照** 为主（行项目、价、合计等与将来印在纸上的范围一致），并 **始终带 `order_id`**（`pre_bill` 等若用 `bill_split_id` 须在 `payload` 内一并写入可关联 id，实现期定）便于关联与排障；**不**采用「仅 `order_id`、打印时再拉整单」作为默认——否则订单事后被改，纸面可能与点打印时不一致（对账/纠纷不利）。**`station_ticket`**：**还须带 `batch_id`（或等价行集锚点）**，**`lines` 仅含该批、该档口**（见 **已确认 · 出品与加单批次**），以支持 **加单多次、每批各档口出联**。**语言**：**第一期全票单一 `locale`**（见 **已确认产品与场景**），由 **`restaurants.print_locale`** 在**服务端入队时**写入 `payload`；模板按该 `locale` 选文案，**不**在同一张票上中英葡并列。

| 风险 | 说明 | 缓解 |
|------|------|------|
| **超大 payload** | DoS 数据库/代理内存 | **行大小上限**（如 payload 64KB）；`check` 约束或应用层校验 |
| **恶意内容打印** | 控制字符、无限长 ESC | 代理内 **长度上限**、**禁止 NUL/异常控制序列**（按 ESC/POS 白名单或模板渲染） |
| **伪造任务来源** | 匿名 insert | **仅已登录 owner**（或 Server Action + session）创建；RLS **禁止** anon insert |
| **敏感数据落库** | payload 复制整份用户档案、明文手机号等 | **只收录纸上会出现的字段**；电话等若必须上纸，在 **服务端入队时** 写入 **脱敏片段**（如后四位），**不**把完整 PII 或无关档案塞进 `print_jobs` |
| **快照与主库不一致** | 订单后续编辑 | 以 **`print_jobs.payload` 为准** 出纸；业务上改单依赖 **新任务 / 补打**，而非静默改写旧 `payload` |

### 5.5 传输与 Realtime

| 风险 | 说明 | 缓解 |
|------|------|------|
| **WSS 被企业代理断** | 无实时 | **轮询兜底**（计划已有） |
| **订阅越权** | 订阅到别店 channel | JWT claim 与 **服务端发布规则**一致；不在客户端传 `restaurant_id` 作为唯一凭据 |

### 5.6 供应链与安装包

**Windows 是否 Authenticode** 以文首 **「已确认安装包分发」** 为准（第一期：**不签名**，靠 URL + 哈希 + 用户说明；后续再评估证书）。

| 风险 | 说明 | 缓解 |
|------|------|------|
| **假冒安装包** | 钓鱼站挂木马 | **GitHub 固定下载 URL** + Release **`SHA256SUMS` / 单文件哈希** 供核对（见 **已确认安装包分发**）；**后续** 再增 **Authenticode** 降低冒名与误报 |
| **CI 泄露密钥** | Actions 日志打印 secret | **OIDC + 短期 token** 上传 Release；secret 仅 **Environment**；禁止 `echo $KEY` |
| **依赖投毒** | npm/go 供应链 | **lockfile**、**dependabot**、发布前 **`npm audit` / `govulncheck`** |

### 5.7 滥用与审计

| 风险 | 说明 | 缓解 |
|------|------|------|
| **刷队列** | 打满 `pending` | **每店每分钟创建上限**；单订单重复打印冷却（产品规则） |
| **无法追责** | 纠纷 | `print_jobs` 记 **`created_by`**；代理回写 **`device_id` / 版本号**；后台只读列表 |

### 5.8 与「业务身份」的关系

- **Mesa 登录**：谁有权 **创建** 打印任务。  
- **配对 + 代理 token**：谁有权 **消费** 队列、连打印机。  
两层都要硬，**不能互相替代**。

---

## 六、其他运营风险（简表）

| 风险 | 缓解 |
|------|------|
| 代理未运行 / 断网 | UI 提示；`pending` 超时告警；Realtime 重连 + 补偿 `select` |
| 封闭网络 / 仅代理出网 | **默认不覆盖**（见 **已确认店内公网出口**）；文档列 **需放行域名**；P2 再考虑 `HTTPS_PROXY` |

---

## 六（附）、实施进度（DB / 代码落地）

| 日期 | 内容 |
|------|------|
| **2026-05-12** | **`print_stations`** 表（`ticket_layout`、`name_pt/en/zh`、`sort_order`）、**`menu_categories.print_station_id`**、**`menu_items.print_station_id`**（FK → `print_stations`，`on delete set null`）、**同店校验 trigger**、**RLS**（与 `menu_categories` 一致：公开 `select` + owner `all`）、**每店预置** `kitchen`「后厨」与 `beverage`「吧台」各一行（幂等：按店 + `ticket_layout` 去重）。**文件**：`supabase/migrations/20260512160000_print_stations_and_menu_bindings.sql`。 |
| **2026-05-14** | **`print_jobs` 表**（`station_ticket` / 预留 `order_receipt`·`pre_bill`）、**`restaurants.print_locale`**（默认 `pt`）、**Realtime 发布**；**下单后自动入队** → `POST /api/restaurants/[slug]/station-tickets/auto`；入队逻辑见 `src/lib/station-ticket-enqueue.ts`（**无**厨房/服务员手动「打印出品」）。 |

---

## 七、交付物清单（Checklist）

**应用端**  
- [x] **`print_stations` +（`menu_categories` / `menu_items` 的 `print_station_id`）迁移与 RLS** — `supabase/migrations/20260512160000_print_stations_and_menu_bindings.sql`；**新建店种子** — `20260513110000_restaurants_seed_print_stations.sql`（**2026-05-12～13**）  
- [x] **Dashboard**：`/dashboard/settings/print-stations`（档口 CRUD、排序、`ticket_layout`）+ **菜单设置** 内分类/菜品绑定与列表展示 **有效出品档口**（`COALESCE(品, 类目)`）  
- [x] **`print_jobs`（首期：`station_ticket` 入队 + `print_locale`）** — `20260514120000_print_jobs_and_print_locale.sql`；**`station-tickets/auto`**（订单提交后自动入队；**无**手动出品打印 UI）  
- [ ] **`print_agent_pairings`**（配对码表）及 **`POST/GET` 打印助手 API**（见下行 checklist）  
- [ ] **`app/api`（Next）**：`POST .../print-agent/pairing`（`create`，**成功体含 `code` 明文一次**）、**`GET .../print-agent/pairings`（只读列表，仅 `code_mask`，掩码见文首已确认表）**、**`GET .../print-agent/print-jobs/recent`（`limit` 默认 5，已定）**、`POST .../print-agent/claim`；打印助手 **经 `GET` 拉 pairing 与最近 `print_jobs`**（**文首「已确认配对码与安全参数」**；满 3 条时 create → **409**；凭证 **90 天**、**提前 15 天** 见「已确认代理 token 生命周期」；**主落点见已确认技术选型 · P0 打印相关 API 落点**）  
- [ ] `print_agent_devices`（或等价）：`paired_at`、`valid_until`（**+90d**）、`revoked_at`、`device_id`（**列可先预留**）；**claim 仅影响本行、不踢同店其它设备**（见 **已确认代理 token 生命周期 · 多设备**）；**`print_jobs` 代理 RLS + `revoked_at` 即时失效** — **在 `print_stations` 与出品入队主线之后**闭环（见 **实施顺序**、**吊销后 JWT…**）
- [ ] **到期前 15 天（必做，Next/Mesa 功能端）**：**`print_agent_devices`** 驱动 — **`/dashboard` layout 顶栏全局条（已定）** + **「打印助手」** 区块强提示 + 日期（见 **P0-D**，**两处缺一不可**）；**已配对设备列表**；**按设备吊销（`revoked_at`）** — **UI 与 RLS 验收** 与上条 **同期或略晚**（不挡 `print_stations`）；**claim** 在 `valid_until` 后拒绝并提示重新配对。**与代理托盘（P1-3）双通道**，功能端 **不因未装代理而省略**
- [ ] **无代理 / 未配对**：Mesa **保留 `window.print()` HTML 兜底**；**有代理** 以 **`print_jobs`** 为主路径（见 **无代理时打印**）
- [ ] **§五 安全**：配对限流、HTTPS、claim 只信服务端 `restaurant_id`、scoped JWT、payload 大小限制、创建任务限流  
- [ ] 后台「打印助手」UI + **下载链接（主：Inno amd64 Setup；次：zip）** + **最近 5 条 `print_jobs` 排障表（已定，见 P0-D）**（**SHA256**；**未签名** 时附 **SmartScreen /「仍要运行」** 等简短安装说明，与 **已确认安装包分发** 一致）  
- [ ] **`restaurants.country_code`**（ISO 3166-1 alpha-2，`NOT NULL`）迁移 + **注册/代建开店表单必填** + dashboard **餐厅设置** 可编辑（与 **票面语言解耦**，见 **已确认产品与场景**）  
- [x] **`restaurants.print_locale`**（`zh`|`en`|`pt`，默认 **`pt`**）迁移已含于 **`20260514120000_print_jobs_and_print_locale.sql`**；**Dashboard 餐厅设置三选一** 仍待接 UI（入队已读库字段）  
- [ ] **订单小票** + **预结单** 入队入口与代理模板（**`station_ticket` 已**由下单自动入队；**全票单一 `locale`**）  
- [x] **入队策略（出品联）**：**每批提交自动** `insert`（按档口多条）；**pending 重复跳过** + **`station-tickets/auto` 限流**；**无** `client_request_id`（见 **入队幂等**）  
**安装包端**  
- [ ] **`apps/print-agent`（Go）**：配对、Realtime（主）+ 补偿查询、TCP RAW、状态回写  
- [ ] **§五 安全**：本地 token 加密存储、日志脱敏、设备/版本回写；**解析 `valid_until`，到期前 15 天托盘到期提醒**（**已定 P1**，见 **§二 · P1-3**；与文首生命周期一致）  
- [ ] Windows：**Inno Setup 安装包 + 登录时自动启动（默认勾选）** + **便携 zip**（见 **P1-4**、**已确认安装包分发**）  
- [ ] 试打链路：**`claim` 成功后** 插入 **`print_jobs`**，`type=order_receipt` 且 **`payload.connection_test`**（**无 `agent_test` 枚举**），代理走与生产相同的拉取/确认路径
- [ ] **采购/文档**：热敏机 **带网口**；**首期参考样机 UNYKA UK56009**（见 **`docs/assets/reference-printer-unyka-uk56009.png`**；官方技术页 PDF：Unykach *Ficha-Impresora-Termica-POS5-UK56009*）上完成 **zh / pt / en** ESC/POS **打样与编码定稿**；实施说明含 **DHCP 保留** 与私网 IP 说明（见已确认网络与打印机）  
- [ ] **GitHub Actions** → **GitHub Releases**：**每架构 zip + Inno Setup** + `SHA256SUMS`；Mesa **主下载链** 指向 **amd64 Setup**（见 **已确认安装包分发**）  
- [ ] （**P2**）自有 OSS/CDN 镜像（若 GitHub 访问或合规有问题再加）  

---

*本计划与 `docs/receipt-printing-research.md` 中的路线一致；实施时可按迭代裁剪 P2。*
