# 葡萄牙餐饮与小型零售 POS 合规开票软件 — 需求文档

| 项 | 内容 |
|----|------|
| 版本 | **0.17** · Agent 可配置局域网访问版（**口径已按统一开票入口修订**） |
| 日期 | 2026-07-23（口径统一 2026-07-24；B1/B2/B3 需求口径同日） |
| 状态 | 路线 A · FT/FS/FR/NC/ND 均须完整实现 · 同一开票入口 · 日常默认 FT/NC |

> **P0 / 产品口径（2026-07-24 统一）：** 认证完整支持 FT、FS、FR、NC、ND。**Mesa 桌台 API 只开 FT**；**NC 及其他类型须登录 Agent 本地 UI**。不设高级税务入口。日常销售默认 FT。已签发类型均须进入 SAF-T。详见对接说明 [`technical/mesa-fiscal-agent-integration.zh.md`](./technical/mesa-fiscal-agent-integration.zh.md) §4。

> 本需求以本 Markdown 为唯一正文。下文若与文首 / 对接说明定稿冲突，**以文首与对接说明为准**（含：正式票本地队列、五类型认证、Mesa 三角色、PIN 与查票 ACL）。

---

## 目录

- 本版变更重点
- [0. 术语、对象命名与字段命名规范](#0-术语对象命名与字段命名规范)
- [1. 背景与目标](#1-背景与目标)
- [2. 合规要求（硬性约束）](#2-合规要求硬性约束)
- [3. 系统架构](#3-系统架构)
- [4. 用户角色](#4-用户角色)
- [5. AT 凭证管理](#5-at-凭证管理)
- [6. 核心功能范围](#6-核心功能范围)
- [7. 非功能要求](#7-非功能要求)
- [8. 技术栈](#8-技术栈)
- [9. 明确排除](#9-明确排除)
- [10. 开放问题](#10-开放问题)
- [11. 官方文档核验清单](#11-官方文档核验清单)
- [12. 首版认证与 Agent 架构阻塞项](#12-首版认证与-agent-架构阻塞项)

---

## 本版变更重点（相对 v0.16）

### v0.17 本次修订

- Agent Local API 默认仅监听本机回环地址，但支持管理员启用“门店局域网模式”。
- 局域网模式下，监听网卡、服务端口、公布地址和允许访问网段均为可配置项，禁止硬编码 192.168.1.10 或固定端口。
- 一个门店仍只允许一个 Agent；多台 Windows 收银终端通过局域网访问同一个 Agent，不新增第二个税务权威节点。
- 移动端、手机和平板仍不进入 P0 的正式签发范围。
- 开放局域网访问时，必须启用终端配对、设备鉴权、允许网段限制和并发签发控制。
- 修改 bind_host、port、advertised_host 或 allowed_subnets 后，必须重新执行连接测试、设备配对校验和测试打印。
- 建议通过路由器 DHCP Reservation 固定 Agent 主机地址，但产品不得依赖某个固定私网 IP。
- **Hash / Despacho 8632（B1 需求关闭）：** 算法与拼接规则以 Despacho 为准；官方 PDF 示例私钥故意截断，**不作**「复现附录 Base64」验收。验收改为自生成钥 + 签验通过 + Go 与同环境 OpenSSL 字节一致。实现 PoC 另排期，不属本条关闭范围。
- **Series SOAP / WS-Security（B2 需求口径）：** 证书三层、`at_env=test|prod`、系列状态机与重试写入 §5 / §6.5；真 AT 联调依赖官方测试材料（见 §5）；无材料期间允许 mock，不关闭功能需求。
- **设备私钥封装（B3 需求口径）：** 无 TPM 允许 SOFTWARE+DPAPI 降级并标记；换机必须人审后下发 `wrapped_fiscal_key`；产品钥仅运营方托管。见 §6.12。

## 本版变更重点（相对 v0.15）

### v0.16 本次修订

- 架构统一为每个门店仅部署一个 Mesa Local Fiscal Agent；该 Agent 是门店唯一税务签发、SQLite、系列编号、Hash 链和正式打印队列权威节点。
- P0 正式签发限于：Agent 主机，以及门店局域网模式下已登记的 Windows 开票终端；手机和平板不直连 Agent 做签发 / NC/ND / 重打 / 正式打印。
- 废除 PWA 与 Agent 的直接通信方案，删除手机端 mDNS、本地域名发现、本地 CA 安装、移动端设备配对和局域网 HTTPS 依赖。
- 收银台电脑上的 Mesa 收银端始终调用 Agent Local API；在线与离线使用同一条签发链路。
- Agent Local API 默认只监听 127.0.0.1；需要多台 Windows 收银终端访问时，管理员可启用门店局域网模式。公网暴露始终禁止。
- 首次签发必须由 Agent 在同一 SQLite 事务中完成税务文档、系列 last_number/last_hash 与 ORIGINAL 本地打印任务的写入。
- 云端及 Supabase 不参与 InvoiceNo、Hash、ATCUD、QR、系列分配或正式打印队列，只保存业务数据和同步副本。
- 首版认证范围包含 FT、FS、FR、NC、ND；日常默认 FT/NC；**不设高级税务入口**——FS/FR/ND 与 FT/NC 同一开票 UI 可选，并受系列与业务校验。
- 产品定位从餐饮扩展为餐饮与小型零售，Fiscal Core 使用通用 sale、product/service、customer、payment 和 document 模型，餐饮桌台和分单字段留在业务扩展层。
- Agent 主程序继续使用 Go；本地税务权威存储使用 SQLite；打印使用 ESC/POS；本地管理界面使用静态前端嵌入 Go，不运行完整 Next.js 服务端。
- 产品级税务签名私钥由软件运营方控制。每台 Agent 首次激活时生成设备级不可导出密钥，优先使用 TPM/CNG；产品私钥按 installation_id 和设备公钥单独封装后下发。
- Agent 仅保存设备绑定的 wrapped_fiscal_key；换机时由新设备生成新密钥，经运营方审核后重新封装并下发同一 signing_key_version。
- 数据库恢复和签名密钥恢复分开处理；恢复后必须校验系列、最后序号、最后 Hash 和完整 Hash 链，无法确认时禁止继续旧系列。

## 本版变更重点（相对 v0.9）

### v0.13 本次修订

### v0.14 本次修订

### v0.15 本次修订

> **沿革说明（2026-07-24）：** 下列条目中凡与「双进程发票服务 + 云端正式票队列」「FS/ND/FR Deferred」「仅 FT+NC 认证」冲突者，**已废止**；以文首 P0 与对接说明为准。

- ~~固化发票打印职责：Mesa→发票端→云端 print_jobs→Go Agent~~ → **废止**。现口径：Mesa 收银端调 **同一** Fiscal Agent Local API；正式票在 Agent SQLite 事务内入 **本地** 打印队列；业务热敏仍走云端 `print_jobs`。
- ~~发票端与 Go Agent 可分机、发票端不直连 Agent~~ → **废止**。现口径：print-agent **演进为** Fiscal Agent，单进程。
- ~~新增云端 `print_jobs.type=fiscal_document` 作正式票权威~~ → **废止**。正式税务任务权威在 Agent 本地队列；云端仅同步副本。
- 查票 / 重打可见范围（定稿）：店长看本店全部；前台/收银只看自己开的；有网 Mesa 同步副本与离线 Agent 本地同一规则（详见对接说明 §7.1）。
- 明确发票签发仅由员工点击“打印发票”触发，确认收款、整桌付清、预结单和普通小票均不自动触发 FT。
- 明确同一分单账单的整桌 FT 与按人 FT 互斥；按人支持部分已开后对其余补票；**关台不影响开票**。
- 打印机发现、测试和绑定：复用主机 Agent configure（现有 Go print-agent 能力）。
- ~~开发主线仅 FT+NC；FS/ND/FR Deferred；等待 AT 书面确认延后~~ → **废止**。现口径：FT/FS/FR/NC/ND **均须**完整实现与认证演示；日常默认 FT/NC。
- 正常餐饮销售默认开具 FT；退款、退菜、取消、金额减少、重复票和错误 FT 冲销使用 NC。
- 已提供的实际餐厅 SAF-T 样例包含 1624 张 FT，未发现 NC、ND、FS 或 FR；样例可确认 FT 落地，不可冒充 NC 实例。
- NC 按 SAF-T(PT) 1.04_01 实现：SalesInvoices/Invoice、InvoiceType=NC、行使用 DebitAmount，并通过 References 引用原 FT。
- Hash、ATCUD、QR、独立系列、SAF-T 汇总、并发编号和打印链路不存在概念性技术阻塞，进入实现与测试。
- ~~Print Agent 订阅云端开票任务再调独立合规软件 API~~ → **废止**。现口径：收银端直接调本店 Fiscal Agent；Agent 不把云端当作正式票队列权威。
- 开票角色对齐 Mesa：owner / frontdesk / cashier（非仅「店主+收银」两分法）。

## 0. 术语、对象命名与字段命名规范

本章用于统一需求文档、数据库、API、前端文案、测试用例和认证材料中的术语。后续章节不得使用与本表冲突的名称。

### 0.1 术语统一表

| 中文术语 | 英文/代码命名 | 定义 | 禁止混用 |
| --- | --- | --- | --- |
| 系统用户 | User / Operator | 登录本软件或 Mesa 开票的人（owner / frontdesk / cashier） | 不得叫客户 |
| 店长 | Owner / Admin | 管理门店配置、员工 PIN、系列、SAF-T、AT 凭证；查票全店 | 不得和餐馆客户混用 |
| 前台 / 收银 | Frontdesk / Cashier | 日常开票操作员；查票仅本人 | 不得叫客户 |
| 客户 | Customer | 发票购买方，包括散客、个人、企业 | 不得叫用户 |
| 最终消费者/散客 | FinalConsumer | 未提供真实 NIF 的顾客，税号使用 999999990 | 不得叫匿名用户 |
| 门店 | Store | 使用软件的餐馆经营点 | 不得和公司混用 |
| 软件运营方 | SoftwareProvider | 申请 AT 认证的软件公司 | 不得和餐馆混用 |
| 餐馆公司/开票主体 | TaxpayerCompany | 实际开票主体，拥有餐馆 NIF | 不得和软件运营方混用 |
| 发票 | Invoice | 已签名、有 InvoiceNo、ATCUD、Hash 的税务文件 | 不得用来指草稿单 |
| 草稿单 | InvoiceDraft | 未签名、未占编号、可修改的开票草稿 | 不得叫发票 |
| 打印小票 | ReceiptPrint / Printout | 发票的纸质打印表现 | 不等于发票本身 |
| 贷记单 | CreditNote / NC | 用于冲销、退款、更正原发票 | 不得叫作废 |
| 借记单 | DebitNote / ND | 用于补收差额 | 不得叫发票补打 |
| 重打 | Reprint | 使用原始发票数据再次打印 | 不得重新生成发票 |
| 打印失败 | PrintFailed | 发票已成立，但打印机未成功输出 | 不得视为开票失败 |
| 发票系列 | Series | AT 注册的文档编号系列 | 不得叫批次 |
| ATCUD 验证码 | SeriesValidationCode | AT 注册系列返回的 8 位验证码 | 不得叫 Hash |
| ATCUD | ATCUD | SeriesValidationCode-顺序号 | 不得加 ATCUD: 前缀存库 |
| Hash | Hash | RSA-SHA1 签名后的完整 Base64 字符串 | 不得叫校验码 |
| HashControl | HashControl | 签名私钥版本号，MVP 为 1 | 不等于 QR Q 字段 |
| QR Hash 字符 | QRCodeHashChars / Q | Hash 第 1、11、21、31 位字符 | 不等于 HashControl |
| 含税单价 | unit_price_gross | 顾客实际看到和支付的单价 | 不得写成 unit_price |
| 不含税单价 | unit_price_net | SAF-T UnitPrice 使用的价格 | 不得和含税价混用 |
| 行含税金额 | line_gross | quantity × unit_price_gross 后舍入 | 不得重新计算历史值 |
| 行不含税金额 | line_net | 从含税金额反算得到 | 不得用浮点数 |
| 行税额 | line_tax | line_gross - line_net | 不得单独乱算 |
| 客户主档 | CustomerMaster / customers | 本地保存的客户资料 | 不等于发票客户快照 |
| 发票客户快照 | InvoiceCustomerSnapshot | 开票当时冻结的客户资料 | 签名后不得修改 |
| 菜品显示名 | display_name / name_zh 等 | 前端或中文小票显示用 | 不进入 SAF-T |
| SAF-T 菜品名 | compliance_name（快照可称 saft_name） | **解析**：优先 `name_pt`，否则 `name_en`；来源可为 Mesa 菜单或 Agent 本地自建 | 不得用中文；远端副本不在 Agent 改 |
| 菜品编号 | item_code | Mesa 编号或本地自编号；进入 ProductCode | 与显示名分离 |
| 月度 SAF-T 导出 | SAFTExport | 每月生成的 XML 文件 | 不等于自动提交 AT |
| 外部账单 ID | external_bill_id | 点餐系统传来的唯一账单号 | 用于幂等防重复开票 |
| 简易发票适用限额 | fs_amount_threshold | 门店可配置的含税总额门槛：开 FS 时超过则阻断/改 FT | 见 2.7.1；默认 100.00；禁止写死不可改 |

### 0.2 禁止/慎用词表

| 禁止或慎用词 | 应改为 |
| --- | --- |
| 用户资料 | 客户资料 / 系统用户资料，按场景区分 |
| 小票作废 | NC 冲销 / 重打 / 打印失败处理 |
| 发票失败 | 打印失败 / 开票事务失败，按阶段区分 |
| 单价 | 含税单价 unit_price_gross 或不含税单价 unit_price_net |
| 客户名 | CompanyName / display_name，按字段区分 |
| 税号 | CustomerTaxID / TaxRegistrationNumber，按主体区分 |
| 验证码 | SeriesValidationCode / NIF 验证结果，不混用 |
| Hash 前 4 位 | QR Hash 字符：第 1、11、21、31 位 |
| 作废 | MVP 不使用，统一 NC 冲销 |
| 上传 AT | 手动上传 SAF-T / 自动提交 AT，分开写 |

### 0.3 命名强制规则

"用户"只表示登录系统的人，即 User，不得用于发票购买方。

发票购买方统一称为"客户"，英文统一为 Customer。

发票一旦签名生成 InvoiceNo、ATCUD、Hash，才允许称为 Invoice。

未签名前只能称为 InvoiceDraft，不得称为 Invoice。

所有价格字段必须显式区分 gross / net，不允许使用含义不明的 unit_price。

HashControl 固定表示签名私钥版本号，不得用于表示 QR Hash 字符。

中文菜单名不得进入 SAF-T。进入 SAF-T / 正式票的商品描述 = 菜单 `name_pt`（优先）否则 `name_en`；编号用既有 `item_code`。不另建独立 saft_name 菜单列。

打印失败不得描述为开票失败；已签名发票即已成立。

## 1. 背景与目标

### 1.1 背景

团队已开发完成一套 Buffet 点餐系统（云端 SaaS），目前餐厅结账后需人工将账单数据转录至第三方打票软件（鸿兴、腾龙等）完成合规开票，流程割裂、效率低。

葡萄牙税务局（AT）要求所有开票软件必须通过 Modelo 24 认证，每张发票强制包含 ATCUD、QR 码及 Hash 链，并需按月通过基于 SAF-T 结构的文件向 AT 通信发票数据。现有第三方软件无法与点餐系统直接集成。

### 1.2 目标

**自研一套面向葡萄牙餐饮、小型零售、杂货百货及其他线下商户的本地 POS 与发票合规软件，满足：**

- 完全符合葡萄牙 AT 认证开票软件要求（ATCUD、Hash 链、QR 码、SAF-T / ficheiro multidocumento）
- 本地安装运行，离线也可开票
- 支持多台收银机局域网共用
- 支持手动开票（员工界面操作）
- 支持 API 对接（点餐系统自动触发打票）
- 可对外销售给其他餐馆使用

### 1.3 产品定位

**本产品是一套本地安装的发票合规引擎，与鸿兴、腾龙同一市场定位，核心差异是：**

- 可与点餐系统 API 直连，实现自动打票
- 面向中文用户，界面更友好
- 多台收银机局域网共用，无需每台单独安装
数据存储在餐馆本地，不依赖云端，断网照常开票。MVP 采用路线 A：只做认证开票软件 + 月度文件通信，不做 e-Fatura 实时逐票上报。

### 1.4 目标用户

- 种子用户：自有 Buffet 连锁餐馆（与 Mesa 点餐系统深度集成）
- 扩展用户：葡萄牙华人餐馆、小型零售店、杂货店、三百店及其他线下商户

### 1.5 商业模式

- 一次性买断费：€300–500，获得当前版本使用权，交付时软件持有有效 AT 认证
- 年度维护费：€80–150/年，覆盖 AT 法规变更后的合规更新、软件升级及技术支持
未续费说明：维护费到期后软件可继续使用，但软件方不对后续法规变更的合规性负责，风险由餐馆自担。建议在销售合同中明确写出"过期后是否自动降级/停用某些开票功能"，而不仅是责任免除条款，以降低纠纷追责风险。

- 责任上限：软件方赔偿责任不超过用户已付费用总额
## 2. 合规要求（硬性约束）

### 2.0 合规路线确认：路线 A

本产品 MVP 明确采用路线 A：认证开票软件 + 月度 SAF-T / ficheiro multidocumento 提交。

**MVP 范围内必须做：**

- AT 软件认证（Modelo 24）
- 本地合规开票：ATCUD、QR Code、Hash 链、连续编号、不可篡改
- Series / ATCUD Webservice：注册、查询、终结、作废发票系列，获取系列验证码
- 月度生成基于 SAF-T(PT) 结构的发票通信文件，由餐馆登录 Portal das Finanças 上传
- 本地保存发票、Hash、操作日志、备份、版本记录

**MVP 范围外，明确不做：**

- e-Fatura Webservice 实时逐票上报发票数据
- RegisterInvoiceRequest、ChangeInvoiceStatusRequest、DeleteInvoiceRequest 等实时发票通信接口
- SAF-T 自动提交 AT
- PDF 电子发票 / QES 合格电子签名
- B2G 政府采购发票
关键边界： Series / ATCUD Webservice 仍然必须做，因为 ATCUD 的验证码必须从 AT 获取；但发票明细不通过 e-Fatura Webservice 实时上报，而是通过月度文件通信。

**所有功能必须满足以下葡萄牙法规要求，不可裁剪：**

### 2.1 AT 软件认证（Modelo 24）

- 由运营方公司统一申请，认证编号写入软件，印于每张发票
- 认证申请免费，审核周期最长 30 天，需在软件开发完成后立即提交
- 每个认证软件产品对应一对唯一密钥（一个私钥 + 一个公钥），公钥随 Modelo 24 申请提交给 AT
- AT 可随时进行合规审查，软件方须配合提供软件副本和技术文档
- 软件版本迭代无需重新认证，但软件方须承诺所有后续版本持续满足认证要求；若 AT 检测到不合规，可随时撤销认证
- 未使用认证软件开票：餐馆面临 €3,000–€18,750/次罚款
- QR 码或 ATCUD 缺失或不合规：€200–€1,000/张罚款

### 2.2 用户登录（AT 认证硬性要求）

**Portaria 363/2010 第3条明确要求软件必须具备用户身份认证机制：**

- 软件必须强制每个用户登录后才能开票，不可匿名操作
- **有网：** Mesa 已登录且角色 ∈ owner / frontdesk / cashier，经 `operator_token` 鉴权即可开票（不必再输 PIN）
- **离线 / Agent 本地：** 须先本地操作员 + PIN 登录；首次启用须设 PIN（不得为空）；PIN 规则见下文定稿
- 店长不能查看或获取他人 PIN/密码明文；PIN 与 Mesa 密码均单向哈希存储，且互不复用
- 每张发票必须记录操作员 ID（`SourceID`），写入 SAF-T 审计日志
- 角色区分：店长（配置与全店查票）/ 前台与收银（日常开票，查票仅本人）
- 收银员支持 PIN 码快速登录，方便换班切换
- **PIN 规则（定稿，与对接说明 §13.5 一致）：**
  - 纯数字；默认 **6** 位（可配置 4–8）
  - 设置时拒绝弱 PIN（如 `000000`、`123456`）
  - 连续错误 **5** 次 → 锁定该操作员 **15** 分钟，或由店长解锁；锁定仅影响该人
  - 仅店长可重置他人 PIN；本人改 PIN 须验旧 PIN
  - 仅存单向哈希；与 Mesa 登录密码无关、不得复用
  - 有网已登录 Mesa 开票不要求再输 PIN；PIN 仅用于 Agent 本地/离线登录  
  - **设/改/重置 PIN 仅在 Agent 本地 UI**（A13）；Mesa 打印助手不采集 PIN，可只读状态并链到 Agent 页

### 2.3 发票系列（Series）

**P0 须支持并注册认证范围内全部类型系列：FT、FS、FR、NC、ND。**  
日常默认使用 FT 与 NC 系列；FS / FR / ND 系列须可注册、可激活，以便同一开票入口演示与开具。

**各类型规则：**

- **FT**：默认用于正常销售（含餐饮）；**Mesa 桌台 API 开票只开 FT**。  
- **NC**：贷记单冲销；**须登录 Agent 本地 UI 开具**（Mesa 不开 NC）。  
- **FS / FR / ND**：认证须可注册激活并进 SAF-T；**仅 Agent 本地 UI**；餐厅结账不映射。

**系列通用规则：**

1. 系列名格式：{类型}{年份}{门店码}，例如 FT2026ABC01、NC2026ABC01。
2. 同一 NIF 下系列名不得重复，最大长度按官方 WSDL 约束。
3. 各类型分别调用 registarSerie，分别取得 SeriesValidationCode。
4. 各类型各自维护独立顺序号和独立 Hash 链。
5. 注册前先 consultarSeries；若 AT 已存在同名、同类型有效系列，绑定已有验证码，不得重复注册。
6. 新年度创建新系列；不得通过重置旧系列编号实现从 1 重新开始。
7. 某类型当前年度系列未激活时，只阻断该文档类型的开具。
8. 备份恢复后，完成系列、最后序号和最后 Hash 一致性检查前禁止开票。

### 2.4 ATCUD

- 每张发票必须包含，格式：验证码-顺序编号（例：CSDF7T5H-0000000001）
- 验证码：固定 8 位，来自系列注册时 AT 返回值，长期固定
- 顺序编号：在该系列内严格递增，不可断号，从 1 开始，最大 25 位（WSDL 限制）
- 必须同时显示在小票文字区域和 QR 码内容中
- 多页文件每页都必须包含 ATCUD
- 系统自动生成，无需人工干预
- 官方依据：ATCUD 强制生效于 2023 年 1 月 1 日，依据 Decreto-Lei n.º 28/2019 及 Portaria n.º 195/2020

### 2.5 QR 码

- 每张发票必须包含 QR 码，打印在小票上（第一页或最后一页均可）
- 最小尺寸：30mm × 30mm
- 内容必须严格按 AT 官方 QR Code 技术规格拼接，不允许自行设计字段顺序
- 由本地合规模块使用 qrcode 库生成，无需网络请求
- QR Code 技术规格必须作为单独验收用例：同一张发票的打印内容、QR 内容、SAF-T 内容必须一致
- 【工程建议，见 12.11】QR 码本身应使用打印机 ESC/POS 原生 QR 指令打印，不应经过 node-canvas 位图渲染，以避免分辨率不足导致扫描失败；仅中文菜品名走位图渲染路径

**MVP QR 字段映射表：**

- QR 字段
- 含义
- 数据来源
A

- 开票方 NIF
Header/TaxRegistrationNumber

B

- 客户 NIF
- Customer/CustomerTaxID；散客为 999999990
C

- 客户国家
Customer/BillingAddress/Country

D

- 文件类型
- Invoice/InvoiceType，MVP 为 FS / FT / NC / ND
E

- 文件状态
- InvoiceStatus，MVP 正常均为 N
F

- 文件日期
- InvoiceDate，格式按官方 QR 规格输出
G

- 文件编号
InvoiceNo

H

ATCUD

- ATCUD，不带 ATCUD: 前缀
I1-I8

- 葡萄牙大陆 IVA 税率分组
- 按税率汇总 TaxBase / TaxAmount
J1-J8

- 亚速尔 IVA 税率分组
- MVP 不启用
K1-K8

- 马德拉 IVA 税率分组
- MVP 不启用
L

- 不征税/非应税总额
- MVP 默认不生成，除非存在对应业务
M

- 印花税
- MVP 默认不生成
N

- 税额合计
DocumentTotals/TaxPayable

O

- 含税总额
DocumentTotals/GrossTotal

P

- 预扣税
- MVP 默认不生成
Q

- QR Hash 字符
- Hash 第 1、11、21、31 位字符
R

- 软件认证编号
SoftwareCertificateNumber

S

- 其他信息
- MVP 默认不生成

**需求规则：**

- QR 字段、SAF-T 字段、打印内容、数据库落库值必须一致。
Q 字段不是 HashControl；Q 来自完整 Hash 的第 1、11、21、31 位字符。

N 必须等于 DocumentTotals/TaxPayable。

O 必须等于 DocumentTotals/GrossTotal、小票打印总额和 Hash 拼接使用的 GrossTotal。

若未来支持亚速尔、马德拉、免税、不征税或预扣税，必须扩展 QR 映射和验收用例。

### 2.6 Hash 链（数字签名）

本节以 Despacho n.º 8632/2014 作为 Hash / 数字签名的直接技术依据。Portaria 363/2010 规定认证开票软件需要签名机制，Despacho n.º 8632/2014 给出实际可执行的技术细节。

【官方核验已确认】 经核验官方条文原文（"deverá sempre ser gerada uma assinatura através do algoritmo RSA... e na chave privada do produtor do programa de faturação"），私钥归属软件生产商而非各餐馆，本节 6.12 的密钥管理策略符合官方规定。

**算法规格（必须严格遵守，否则 AT 验证失败）：**

- 签名算法：SHA-1 摘要 + RSA 签章，工程实现名可写作 RSA-SHA1 / SHA1withRSA / RSA-PKCS1v1.5-SHA1
- 禁止使用：RSA-SHA256、SHA-256、PSS padding 或任何自行升级算法
- 私钥长度：1024 bits
- 私钥格式：PEM
- 公钥格式：由私钥导出，PEM / Base64，随 Modelo 24 申请提交给 AT
- Padding：PKCS#1 v1.5
- 签名结果：先得到二进制签名，再做 Base64 编码；Base64 必须为单行，无换行
- Base64 签名长度：通常为 172 个 ASCII 字符
- 每张已签名文件必须保存：完整 Base64 Hash、HashControl、签名密钥版本、签名时间、前一张 Hash 引用
- 每个签名必须保存使用的私钥版本；如未来更换密钥，必须通过 Modelo 24 / AT 要求流程提交新公钥（官方依据：私钥更换须经 declaração modelo 24 及上传新公钥，产品生产企业方可执行）

**官方 OpenSSL 等价流程：**

- # 1. 生成 1024-bit RSA 私钥

```bash
openssl genrsa -out ChavePrivada.pem 1024
```

- # 2. 从私钥导出公钥，提交 AT 使用

```bash
openssl rsa -in ChavePrivada.pem -out ChavePublica.pem -outform PEM -pubout
```

- # 3. 对待签名文本执行 SHA-1 + RSA 签章

```bash
openssl dgst -sha1 -sign ChavePrivada.pem -out Registo1.sha1 Registo1.txt
```

- # 4. Base64 单行编码，避免换行

```bash
openssl enc -base64 -in Registo1.sha1 -out Registo1.b64 -A
```

- # 5. 验签

```bash
openssl dgst -sha1 -verify ChavePublica.pem -signature Registo1.sha1 Registo1.txt
```

**签名内容格式：**

- InvoiceDate;SystemEntryDate;InvoiceNo;GrossTotal;PreviousHash

**示例：**

- 2010-05-18;2010-05-18T11:22:19;FAC 001/14;3.12;

**签名内容拼接规则：**

- 字段顺序固定：InvoiceDate、SystemEntryDate、InvoiceNo、GrossTotal、上一张同类型同系列 Hash
- 字段之间只使用英文分号 ;
- 不加引号
- 末尾不允许有换行符、空格、制表符或其他不可见字符
- 第一张发票的 PreviousHash 为空，但最后一个分号仍然保留
- 编码统一使用 UTF-8（注意：此处签名文本内容用 UTF-8，与 2.8.1 中 SAF-T XML 文件正式导出用 Windows-1252 是两个不同的编码场景，不得混淆）
- GrossTotal 必须固定两位小数，例如 3.12、1000.00、0.10
- SystemEntryDate 的时间格式必须与 SAF-T 导出一致，不允许签名时一种格式、导出时另一种格式

**Hash 链规则：**

- Hash 链按类型 + 系列独立维护，FS、FT、NC、ND 各自独立，不跨类型链接
- 同类型同系列内按顺序编号严格链接
- 第一张发票或每个新系列第一张，前置 Hash 为空字符串
- 如果使用多年系列，新财政年度第一张是否链接上一年度最后一张，按 Despacho 规则和最终 Series 策略确认；MVP 建议每年新建系列，避免跨年度链路复杂化
签名必须在发票写入数据库、分配序号的同一原子事务内完成（官方依据 FAQ R23：签名应在记录写入数据库、分配序号的同一时刻完成）。工程实现必须保证"读取当前最大序号→+1→签名→提交"是一个数据库级原子操作/加锁事务，避免并发场景下出现序号跳号或重复分配（详见第12.1节）

- 已签名发票绝对不能重新生成签名，任何情况下都不允许

**HashControl / 小票打印格式：**

- 取 Base64 签名字符串第 1、11、21、31 位字符，用 "-" 连接
- + "Processado por programa certificado n.º XXXX/AT"
- 示例：A-x-y-z-Processado por programa certificado n.º 0000/AT
注意：第 1、11、21、31 位是按人类计数从 1 开始，不是程序数组下标 0、10、20、30 的概念混用。实现时应明确写单元测试。

**关于 Despacho 附录示例（B1 已关闭）：**

- 官方 PDF（[DRE](https://files.dre.pt/2s/2014/07/126000000/1725517261.pdf)）第 5 节示例私钥**故意截断**，第 7 节给出的示例 Base64（如 `oso2FoOw…`）对应那把未完整公布的钥，**任何第三方均无法比特级复现**——属文档设计，不是资料缺失。
- 附录示例仅说明流程与明文拼接；**不得**作为「输出必须等于该 Base64」的验收条件。
- 生产与测试均使用软件生产商自有 1024-bit 钥（Modelo 24 提交公钥），与附录演示钥无关。

**验收测试要求：**

- 自生成 1024-bit RSA 钥对；按本节规则拼接明文 → 签名 → Base64 → 公钥验签必须通过
- 同一明文、同一私钥下，Go 实现输出须与同环境 OpenSSL（`dgst -sha1 -sign` + `enc -base64 -A`）**字节一致**
- 必须单独测试「末尾多一个换行符会导致签名不同」
- 必须测试 Windows / macOS / Linux 下，同一钥同一明文签名结果一致
- 必须测试 Base64 输出为单行，无换行
- **禁止**将「等于 Despacho 附录示例 Base64」列为通过条件

**作废处理：**

- 已印出但未交给顾客的发票出错：必须作废或开 NC 单处理，不可重新签名覆盖
- 已交给顾客的发票：必须开 NC 贷记单冲销
- 原始发票 Hash 永不修改；NC 生成自己的编号、ATCUD 和 Hash
- 【新增，见 12.2】NC 本身开错的处理路径未在原方案中定义，见第12章

### 2.7 发票类型与客户识别规则

#### 2.7.1 当前优先范围

**开票入口（统一口径）：**

- 店长 / 前台 / 收银：**同一开票 UI**，可开 FT / FS / FR / NC / ND；不设高级入口。  
- **FT**：默认用于正常销售；**Mesa 桌台 / API「打印发票」只开 FT**。  
- **NC**：退款/冲销等；**须登录 Agent 本地 UI 开具**，Mesa 不提供开 NC 入口。  
- **FS / FR / ND**：认证须可演示并进 SAF-T；**同样只在 Agent 本地 UI**（二次确认等）；不为餐厅结账映射。

**FS 金额门槛（可配置）：**

- 配置项：`fs_amount_threshold`（含税 GrossTotal，默认 `100.00`）。
- 店主在 Agent 本地修改；仅开 FS 时生效；超限阻断或改 FT；禁止写死不可配置常量。

**演示**：在同一开票 UI 选择 FS（等）即可，无需换角色或进入高级区。

#### 2.7.2 FT、NIF 与客户资料规则

1. FT 必须引用 SAF-T CustomerID。
2. 散客未提供 NIF：使用最终消费者记录，CustomerID / CustomerTaxID = 999999990，CompanyName = Consumidor final，Country = PT。
3. 顾客提供真实 NIF：使用真实 NIF，并冻结开票时客户资料快照。
4. 已签名 FT 的 NIF、客户名称、地址不得直接修改。事后要求改 NIF 或抬头时，通过 NC 冲销原 FT 后重新开具正确 FT。
5. 企业客户建议采集 CompanyName、AddressDetail、City、PostalCode、Country；是否阻断不完整地址由门店配置决定。
6. 客户资料、菜品名称等进入 SAF-T 前必须通过 Windows-1252 编码校验；校验必须发生在签名前。
7. 实际餐厅样例共 1624 张 FT，未发现 NC、ND、FS 或 FR。样例仅用于确认 FT 字段和金额落地。

#### 2.7.3 NC 贷记单规则

1. 一张 NC 只引用一张原始 FT。
2. 支持全额冲销和部分冲销。
3. 部分 NC 必须逐行引用原 FT 对应行。
4. NC 行复制原 FT 的商品快照、税率、税区、税码、单位及历史金额口径，不读取当前菜单价格或当前税率。
5. NC 数量和金额使用正数；SAF-T 会计方向通过 DebitAmount 表达，不使用负数行。
6. 同一 FT 允许多张部分 NC，但累计冲销数量、NetTotal、TaxPayable 和 GrossTotal不得超过原 FT 的可冲销余额。
7. 原 FT 不删除、不改写、不重签；系统只维护未冲销、部分冲销、全部冲销业务状态。
8. NC 使用独立系列、独立序号、独立 Hash 链、独立 ATCUD。
9. 打印 NC 必须显示原 FT InvoiceNo、原日期和冲销原因。
10. NC 的 References.Reference 输出原 FT 的完整 InvoiceNo；References.Reason 必填。
11. NC 开具必须幂等，重复点击、网络重试或打印重试不得生成第二张 NC。
12. 打印失败只允许重打原 NC，不得重新签发。
13. NC 自身开错须走人工确认与审计；不作为 P0 自动「再开一张 NC 冲 NC」链路，但允许按业务规则签发纠正用 NC（若法规允许）并保留完整审计日志。

#### 2.7.4 发票编号格式

- 格式：[类型代码] [系列名]/[顺序号]
- 示例：FT FT2026ABC01/1
- 示例：NC NC2026ABC01/1
内部序号存整数。InvoiceNo、ATCUD、Hash 输入、QR、打印和 SAF-T 必须统一调用同一个序号格式化函数。

### 2.8 月度 SAF-T / Ficheiro Multidocumento

本系统 MVP 采用路线 A：不通过 e-Fatura Webservice 实时逐票上报发票数据，而是按月生成基于 SAF-T(PT) 1.04_01 结构的 XML 文件，由餐馆登录 Portal das Finanças 手动上传或交由会计提交。

【官方核验已确认】 经核验 AT 官方 FAQ（第2744条）及 Portaria n.º 302/2016 附件一，SAF-T(PT) 现行有效版本仍为 1.04_01（会计 SAF-T 是独立于本产品范围的另一文件，其强制提交时间为 2027 财年起、2028 年首次提交，与本产品的"发票 SAF-T / Faturação"月度提交无关，不影响 MVP 范围）。

#### 2.8.1 文件版本与根结构

SAF-T 文件必须使用 AT 官方 XSD：SAFTPT1.04_01.xsd。

**XSD 中明确：**

- <xs:schema ... id="SAF-T_PT" targetNamespace="urn:OECD:StandardAuditFile-Tax:PT_1.04_01" version="1.04_01" vc:minVersion="1.1">

**并且 AuditFileVersion 被限制为：**

- <xs:pattern value="1\.04_01"/>

**系统导出的 XML 根节点必须是：**

- <AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:PT_1.04_01">

**根结构按 XSD 顺序生成：**

- AuditFile
Header

MasterFiles

- GeneralLedgerEntries 可选，MVP 不导出
SourceDocuments

**需求规则：**

- AuditFileVersion 固定为 1.04_01。
CurrencyCode 固定为 EUR。

XML 字段顺序必须严格遵守 XSD，不能按程序对象字段顺序随意输出。

【官方核验通过】 SAF-T XML 正式导出固定使用 Windows-1252 编码，XML 声明必须为 <?xml version="1.0" encoding="Windows-1252"?>。官方依据：AT 官方 FAQ 第2744条明确"O encoding a utilizar é o Windows-1252，定义于 XSD 结构与内容限制中，见 Portaria n.º 302/2016 附件一 b) 项"。市面上大量 ERP（含 Xero、QuickBooks、通用 SAP 导出等）默认用 UTF-8 并在声明中如实标注，AT 会静默拒收且不返回明确错误，这是实践中最常见的"ficheiro inválido"故障原因，务必在验收阶段专门测试。

不允许输出空标签来占位；可选字段无值时不生成。

导出文件必须通过本地 XSD 校验后才允许下载。

由于该 XSD 使用 vc:minVersion="1.1" 和 xs:assert，最终验收必须使用支持 XSD 1.1 的校验器；xmllint 只能做基础 XML/XSD 1.0 检查，不能作为最终合规校验工具。

文件不得包含 UTF-8/UTF-16 字节顺序标记（BOM），AT 对带 BOM 的文件同样会拒收。

**SAF-T XML 编码规则：**

- 本系统正式 SAF-T 导出固定使用 Windows-1252，不再默认使用 UTF-8。
- XML 文件头必须输出：<?xml version="1.0" encoding="Windows-1252"?>
SAF-T 正式文件不得包含中文注释、调试注释、测试说明。

所有进入 SAF-T 的文本字段必须先做 Windows-1252 可编码性校验。

餐品名称、客户名称、地址等字段如包含中文或 Windows-1252 无法表示的字符，系统必须阻止导出并提示改用葡语/英文合规名称。

菜品合规名 **复用** Mesa 菜单已有 `name_pt` / `name_en` 与 `item_code`，**不另增** saft_name 列。SAF-T / 正式票描述 = `name_pt`（非空）否则 `name_en`；禁止使用 `name_zh`。二者皆空或未过 Windows-1252 → 开票前阻断。

【工程建议，见 12.3】此编码校验不应只在月度导出阶段执行，而应前移到开票事务内（生成 Hash 之前）。 若菜品/客户名称含 Windows-1252 无法编码的字符，应在开票草稿阶段即阻断并提示，而非等到月底导出时才发现——此时相关发票已签名、不可撤销，只能被迫开 NC 重做。

文件生成后必须做一次实际编码校验：按 Windows-1252 写入文件，再按 Windows-1252 读取，确认无替换字符、乱码或编码异常。

xml-stylesheet 不是合规必需项，MVP 不默认输出；如后续为了人工查看增加 XSLT，也不得影响 XML 主体结构。

#### 2.8.2 Header 头部信息

**Header 是必填节点，字段顺序必须按 XSD 输出：**

- SAF-T 字段
- 必填
- MVP 取值规则
AuditFileVersion

- 是
- 固定 1.04_01
CompanyID

- 是
- 有商业登记号则按规则输出；无则使用餐馆 NIF
TaxRegistrationNumber

- 是
- 餐馆 NIF，9 位数字
TaxAccountingBasis

- 是
- MVP 使用 F，表示 faturação / 开票系统
CompanyName

- 是
- 餐馆法律名称
BusinessName

- 否
- 餐馆商业名称，有则输出
CompanyAddress

- 是
- 餐馆注册地址
FiscalYear

- 是
- 导出期间所属年份
StartDate

- 是
- 导出期间开始日期，例如月初
EndDate

- 是
- 导出期间结束日期，例如月末
CurrencyCode

- 是
- 固定 EUR
DateCreated

- 是
- 文件生成日期
TaxEntity

- 是
- 税务实体；MVP 使用餐馆所在地/配置值，例如 Global 或会计确认值
ProductCompanyTaxID

- 是
- 软件生产商 NIF
SoftwareCertificateNumber

- 是
- AT 认证软件编号；认证前测试环境使用 0
ProductID

- 是
- 软件产品标识，格式应满足 [^/]+/[^/]+
ProductVersion

- 是
- 当前软件版本号

**需求规则：**

- TaxRegistrationNumber 必须是葡萄牙 9 位 NIF；XSD 限制为 100000000–999999999。
TaxAccountingBasis 可选枚举包括 C/E/F/I/P/R/S/T；本产品是开票系统，MVP 固定 F。

ProductID 不能随意写中文名称，应设计为稳定格式，例如：MesaGO/InvoiceEngine。

ProductVersion 必须与实际运行版本一致，不能导出固定假版本。

SoftwareCertificateNumber 必须与 Modelo 24 认证编号一致；未认证测试环境可为 0，正式版本不得为 0。  
**A12 定稿：** 当前尚未取得认证号 → 开发/内测用占位（0）；**认证通过后再配置真号**；已开历史票快照不回改。详见对接说明 §6.1b。

#### 2.8.3 MasterFiles 主数据

**MVP 至少导出以下主数据：**

- MasterFiles
Customer

Product

TaxTable

GeneralLedgerAccounts 和 Supplier 在餐饮开票 MVP 中不作为必填导出对象，除非后续做完整会计系统。

- Customer 客户
每张发票的 CustomerID 必须能在 MasterFiles > Customer 中找到。XSD 对 Invoice > CustomerID 设置了 keyref 约束，不能引用不存在的客户。

**MVP 客户规则：**

- 场景
CustomerID

CustomerTaxID

CompanyName

Country

- 散客/final consumer
CONSUMIDOR_FINAL

999999990

Consumidor final

PT

- 葡萄牙企业客户
- 客户内部 ID 或 NIF
- 客户 NIF
- 客户法律名称
PT

- 外国客户
- 客户内部 ID
- 税号或官方接受值
- 客户名称
ISO 3166 alpha-2

- 每个 Customer 必须包含：CustomerID、AccountID、CustomerTaxID、CompanyName、BillingAddress、SelfBillingIndicator
- MVP 默认：AccountID = Desconhecido；SelfBillingIndicator = 0
地址字段必须包含 AddressDetail、City、PostalCode、Country。散客地址可以使用系统默认占位配置，但不能生成空必填字段。

- Product 商品/服务
每张发票行的 ProductCode 必须能在 MasterFiles > Product 中找到。XSD 对发票行 ProductCode 设置了 keyref 约束。

- 每个 Product 必须包含：ProductType、ProductCode、ProductDescription、ProductNumberCode

**餐饮 MVP 规则：**

- 字段
- 规则
ProductType

- 菜品通常用 P；服务费可用 S；其他费用用 O
ProductCode

- 使用系统内部菜品编码，稳定不可随意变更
ProductDescription

- 菜品名称，2–200 字符
ProductNumberCode

- 可与 ProductCode 相同
- TaxTable 税率表
所有发票行使用的税率组合必须出现在 TaxTable > TaxTableEntry 中。

- 每个 TaxTableEntry 包含：TaxType、TaxCountryRegion、TaxCode、Description、TaxPercentage 或 TaxAmount

**餐饮 MVP 预置葡萄牙大陆常用 IVA：**

- TaxType
TaxCountryRegion

TaxCode

TaxPercentage

- 说明
IVA

PT

RED

6.00

- 低税率
IVA

PT

INT

13.00

- 中税率
IVA

PT

NOR

23.00

- 标准税率
IVA

PT

ISE

0.00

- 免税，必须同时有 exemption code/reason
如果未来支持亚速尔或马德拉，必须增加 PT-AC / PT-MA 对应税率，不能继续硬编码大陆税率。

#### 2.8.4 SourceDocuments / SalesInvoices

**P0 核心导出：**

- SourceDocuments
SalesInvoices

NumberOfEntries

TotalDebit

TotalCredit

- Invoice[]
P0 只导出 SalesInvoices；MovementOfGoods、WorkingDocuments、Payments、GeneralLedgerEntries 暂不导出。未来启用相关业务时重新评估。

**P0 统计规则：**

- FT：计入 NumberOfEntries；行使用 CreditAmount；GrossTotal 汇总到 TotalCredit。
- FS / FR：若导出期内存在已签发单据，计入 NumberOfEntries，并按 SAF-T 对该 InvoiceType 的规则汇总（与官方 XSD 一致）。
- NC：计入 NumberOfEntries；行使用 DebitAmount；GrossTotal 汇总到 TotalDebit。
- ND：若导出期内存在已签发单据，计入并按官方借贷方向规则处理。

**不得**因「非日常默认类型」而把已签发的 FS/FR/ND 排除在导出之外。

**强制规则：**

1. NumberOfEntries = 导出期间 FT + NC 的 Invoice 节点数量。
2. 已签名但打印失败的 FT / NC 仍计数并导出。
3. 已被 NC 冲销的原 FT 仍按原始数据导出，不删除、不改写 Hash、不从 TotalCredit 抵扣。
4. TotalDebit = 导出期间所有 NC 的 DocumentTotals/GrossTotal 合计。
5. TotalCredit = 导出期间所有 FT 的 DocumentTotals/GrossTotal 合计。
6. 不得用 NetTotal 汇总 TotalDebit / TotalCredit。
7. 跨月 NC 只在 NC 开具月份导出；References 仍引用原 FT 完整 InvoiceNo。
8. 导出逻辑读取签发时冻结数据，不重新计算历史金额。

#### 2.8.5 Invoice 发票节点

**每张发票必须按 XSD 顺序输出：**

- InvoiceNo, ATCUD, DocumentStatus, Hash, HashControl, Period(可选),
- InvoiceDate, InvoiceType, SpecialRegimes, SourceID, EACCode(可选),
- SystemEntryDate, TransactionID(可选), CustomerID, ShipTo(可选),
- ShipFrom(可选), MovementEndTime(可选), MovementStartTime(可选),
- Line[], DocumentTotals, WithholdingTax(可选)

**关键字段规则：**

- 字段
- MVP 规则
InvoiceNo

- 格式必须满足 [^ ]+ [^/^ ]+/[0-9]+，例如 FS FS2026_LIS01/1
ATCUD

- 只填 codValidacaoSerie-numeroSequencial，不带 ATCUD: 前缀
InvoiceStatus

- 正常文件为 N；不要通过物理删除处理错误发票
InvoiceStatusDate

- 状态时间，使用 xs:dateTime 格式
SourceBilling

- 本系统生成的文件固定 P
Hash

- 完整 Base64 RSA-SHA1 签名，长度不得超过 172 字符
HashControl

- 私钥/签名控制字段，按认证密钥版本策略生成；不能误填为 Hash 的 4 个打印字符
InvoiceDate

- 发票日期，YYYY-MM-DD
InvoiceType

- MVP 支持 FS / FT / NC / ND，FR 如启用再导出
SpecialRegimes

- MVP 默认 SelfBillingIndicator=0、CashVATSchemeIndicator=0、ThirdPartiesBillingIndicator=0
SourceID

- 操作员 ID，必须能追溯到开票用户
SystemEntryDate

- 系统录入/签名时间，必须与 Hash 拼接使用的时间一致
CustomerID

- 必须引用 MasterFiles > Customer 中存在的客户
InvoiceNo 序号展示口径必须统一（见2.7.4），不允许同一张票在 InvoiceNo、ATCUD、Hash 拼接、QR 中出现不同序号表达。

#### 2.8.6 Line 发票行

**每张发票至少包含一行 Line。每行必须按 XSD 顺序输出：**

- LineNumber, OrderReferences(可选), ProductCode, ProductDescription,
- Quantity, UnitOfMeasure, UnitPrice, TaxBase(可选), TaxPointDate,
- References(可选), Description, ProductSerialNumber(可选),
- DebitAmount 或 CreditAmount, Tax, TaxExemptionReason(可选),
- TaxExemptionCode(可选), SettlementAmount(可选), CustomsInformation(可选)

**餐饮 MVP 规则：**

- 字段
- 规则
LineNumber

- 从 1 递增
ProductCode

- 必须引用 MasterFiles Product
ProductDescription

- 与开票时菜品名称一致
Quantity

- 数量，不能为负；退货/冲销通过 NC 方向表达，不用负数行
UnitOfMeasure

- 餐饮默认 UN 或会计确认单位
UnitPrice

- 不含税单价；必须与行金额计算一致
TaxPointDate

- 通常等于 InvoiceDate
Description

- 可与 ProductDescription 相同
DebitAmount / CreditAmount

- 二选一，不能同时出现
Tax

- 必须包含 TaxType / TaxCountryRegion / TaxCode / TaxPercentage 或 TaxAmount

**XSD 断言要求：**

- 如果 TaxPercentage = 0 或 TaxAmount = 0，必须提供 TaxExemptionReason。
TaxExemptionReason 和 TaxExemptionCode 必须成对出现，不能只填一个。

如使用 TaxBase，UnitPrice、DebitAmount、CreditAmount 不能同时按普通行金额方式填充；餐饮 MVP 默认不使用 TaxBase。

**因此 MVP 规则：**

- 普通含税餐饮销售：使用 UnitPrice + DebitAmount/CreditAmount + TaxPercentage。
免税行：必须配置 TaxExemptionCode 和 TaxExemptionReason，否则禁止开票。

折扣：优先通过 SettlementAmount 或折后金额策略处理，但必须保证 DocumentTotals、QR、打印金额一致。

#### 2.8.7 NC 在 SAF-T 中的要求

**NC 输出在 SalesInvoices > Invoice 中：**

- InvoiceType = NC
- 每行使用 DebitAmount
- 每行 References.Reference = 原 FT 完整 InvoiceNo
- 每行 References.Reason = 冲销原因

**需求规则：**

1. NC 只能引用本纳税主体开具的原 FT。
2. NC 行税率、税区、税码和免税信息必须与被冲销行一致。
3. 部分冲销逐行建立引用和余额分配。
4. NC 拥有独立 InvoiceNo、ATCUD、Hash、HashControl。
5. 原 FT 不从 SAF-T 删除，不重写原 Hash。
6. NC 的 NetTotal、TaxPayable、GrossTotal 均为正值；会计方向由 DebitAmount / TotalDebit 表达。
7. 跨月 NC 不要求把原 FT 重复放入当前月文件。
8. ND 与其它类型相同：已签发则导出；未开具则不出现。

#### 2.8.8 DocumentTotals 金额汇总

**每张 Invoice 必须包含：**

- DocumentTotals
TaxPayable

NetTotal

GrossTotal

- Currency(可选)
- Settlement(可选)
- Payment(可选)
MVP 采用含税价口径：菜单价格、手动录入价格、API 传入价格均为顾客实际支付的含 VAT 价格。

**行级金额计算与舍入规则：**

- line_gross = round(quantity × unit_price_gross, 2)
- line_net = round(line_gross / (1 + vat_rate), 2)
- line_tax = round(line_gross - line_net, 2)
DocumentTotals/NetTotal = sum(line_net)

DocumentTotals/TaxPayable = sum(line_tax)

DocumentTotals/GrossTotal = sum(line_gross)

**说明：**

- line_gross 是顾客为该行实际支付的含税金额。
line_net 是从含税金额反算的不含税金额。

line_tax 使用 line_gross - line_net，不得再独立用 line_net × vat_rate 重算，以保证 line_net + line_tax = line_gross。

一张发票可能包含 6%、13%、23% 等多税率行，因此必须逐行反算，不能用整单总额反推。

DocumentTotals 必须从已落库行金额汇总，不得由打印、QR 或 SAF-T 模块重新计算。

**示例：**

- 菜品
- 数量
- 含税单价
VAT

line_gross

line_net

line_tax

Frango Grelhado

2

12.50

- 13%
25.00

22.12

2.88

Coca Cola

1

2.50

- 23%
2.50

2.03

0.47

Bread

1

1.20

- 6%
1.20

1.13

0.07

- 汇总：NetTotal = 22.12+2.03+1.13 = 25.28；TaxPayable = 2.88+0.47+0.07 = 3.42；GrossTotal = 25.00+2.50+1.20 = 28.70
- （NetTotal + TaxPayable = GrossTotal）

**字段规则：**

- 字段
- 规则
TaxPayable

- VAT 总额，等于所有行 line_tax 合计
NetTotal

- 不含税净额，等于所有行 line_net 合计
GrossTotal

- 含税总额，必须与顾客付款金额、打印总额、QR 字段 O、Hash 拼接 GrossTotal 完全一致
Currency

- 只有原始文件币种不是 EUR 时才生成；MVP 不生成
Settlement

- MVP 不生成；折扣通过开票前调整最终成交价处理
Payment

- MVP 不生成；付款方式仅保存在本地 invoice_payments 表

**金额规则：**

- 内部计算使用 decimal，禁止用 JavaScript number / floating point 直接累加金额。
XML 金额保留两位小数。

开票成功时必须保存 unit_price_gross、unit_price_net、line_gross、line_net、line_tax、vat_rate。

后续打印、重打、QR、SAF-T、NC 不得重新计算历史金额。

Hash 拼接使用的 GrossTotal 必须与 SAF-T DocumentTotals/GrossTotal 完全一致。

#### 2.8.9 Hash / HashControl / QR 一致性

SAF-T 中每张 Invoice 必须包含 Hash、HashControl。

Hash 是完整 Base64 RSA-SHA1 签名字符串。HashControl 表示生成该发票 Hash 所使用的签名私钥版本号。

- MVP 默认只使用第 1 版私钥，因此：HashControl = 1

**未来只有在以下条件全部满足后，才允许递增为 2 / 3 / 4...：**

- 实际更换了新的 RSA 签名私钥；
- 新公钥已按 AT / Modelo 24 要求完成提交、备案或确认；
- 系统已创建新的 signing_key_version；
新发票明确使用新私钥签名。

HashControl 不等于：QR Code 的 Q 字段；打印小票上的 4 个 Hash 控制字符；Hash 字符串第 1、11、21、31 位；软件版本号；数据库版本号；发票系列号。

**需求规则：**

- Hash 保存完整 Base64 签名，不是 Hash 控制字符。
HashControl 保存私钥版本号；MVP 为 1。

QR 字段 Q 和发票打印的 4 个字符来自 Hash 的第 1、11、21、31 位字符。

同一张发票的 Hash、HashControl、QR Q、打印 Hash 控制字符必须来自同一次签名结果。

每张发票必须保存：hash、hash_control、signing_key_version、previous_hash、signed_at。

历史发票重新打印、重新导出 SAF-T 时，必须使用开票时已保存的 HashControl，不得根据当前私钥版本重新计算。

不允许人工修改已签名发票的 HashControl。

不允许在未更换私钥的情况下把 HashControl 从 1 改成 2。

**验收规则：**

- 所有使用第 1 版私钥签名的发票，SAF-T 中 HashControl 必须输出 1。
HashControl 必须与 invoices.signing_key_version 一致。

Hash 必须等于开票时保存的完整 Base64 签名。

QR Q 字段必须等于 Hash 第 1、11、21、31 位字符。

#### 2.8.10 文件生成范围与导出流程

**每月导出流程：**

- 管理员选择导出月份
- 系统锁定该月份已签名发票快照
- 汇总本月涉及的 Customer / Product / TaxTable
- 生成 Header
- 生成 MasterFiles
- 生成 SourceDocuments / SalesInvoices
- 生成 XML 文件
- 执行 XSD 1.1 校验
- 校验通过后生成下载文件
- 保存导出记录、文件 hash、操作员、生成时间
- 餐馆手动上传 Portal das Finanças
- 店主录入或上传 AT 返回回执
提交截止日期澄清（官方核验）： 依据 AT 现行规则，SAF-T 发票文件的提交截止日为次月第5个工作日（而非单纯的"5日"），如遇周末/假期顺延至下一个工作日。原文档"每月1日和4日提醒、截止日5日"的表述建议调整为"提醒后再对照当月工作日日历动态计算实际截止日"，避免遇到月初含假期时提前误报或逾期。

- 导出文件命名建议：SAFT_PT_{NIF}_{YYYYMM}_{generatedAt}.xml
- 示例：SAFT_PT_123456789_202607_20260801T090000.xml

**导出记录表建议：**

- saft_exports
------------

- id, store_id, taxpayer_nif, period_year, period_month,
- start_date, end_date, file_name, file_sha256, invoice_count,
- total_net, total_tax, total_gross, validation_status,
- validation_errors, created_by, created_at, submitted_at,
- at_receipt_number, at_receipt_file_path

#### 2.8.11 本地校验要求

系统必须内置 SAF-T 校验流程。

**校验层级：**

- 层级
- 校验内容
XML well-formed

- XML 是否格式正确
- XSD 结构校验
- 字段顺序、必填、类型、枚举、key/keyref
- XSD 1.1 assert 校验
- 税率为 0 时 exemption 字段、TaxBase 互斥等规则
- 业务一致性校验
- 打印、QR、Hash、SAF-T 是否一致
- 会计方向校验
- TotalDebit / TotalCredit、NC/ND 方向是否正确
- 编码校验（新增）
- Windows-1252 可编码性、无 BOM

**验收标准：**

- 任意一个月导出的 XML 必须通过 SAF-T PT 1.04_01 XSD 校验。
InvoiceNo 必须唯一。

每个 Invoice 的 CustomerID 必须能在 MasterFiles Customer 找到。

每个 Line 的 ProductCode 必须能在 MasterFiles Product 找到。

每个 Line 的 Tax 组合必须能在 TaxTable 找到。

GrossTotal 必须等于 QR O 和打印总额。

TaxPayable 必须等于 QR N。

ATCUD 必须等于 QR H 和发票打印 ATCUD 去掉前缀后的值。

Hash 必须等于开票时保存的 Hash。

不允许为了通过导出校验而修改历史发票数据。

文件必须为 Windows-1252 编码、无 BOM，且能被 AT 门户实际接受（而非仅本地 XSD 校验通过）。

#### 2.8.12 MVP 不做项

**SAF-T MVP 明确不做：**

- 不导出完整会计总账 GeneralLedgerEntries。
不导出供应商 Supplier，除非未来做采购模块。

不导出运输单 MovementOfGoods。

不导出桌台预结单为 WorkingDocuments，除非未来将 Consulta de mesa (CM) 设计为正式税务相关文件。

不导出独立收据 Payments，除非启用 FR/RC/RG 或 IVA de Caixa 场景。

不自动提交 AT，只生成文件并保留上传回执记录。

风险提醒： 如果餐馆业务流程未来引入"先打印 consulta de mesa 给客户确认，再开票"的正式工作文件，WorkingDocuments 可能进入合规范围。当前 MVP 应避免把内部厨房单、桌台单设计成对客税务文件。

### 2.9 发票存档与备份

- 所有发票数据（含 Hash 链）在 **活库** 至少保存 **10 年**（不得因备份文件轮转而删除历史发票）。
- 软件必须内置强制自动备份（Portaria 363/2010）；不能仅靠用户手动备份。
- **备份机制定稿（与对接说明 §12.7 一致）：**
  - 每次备份为税务 SQLite **全量**一致性快照（Online Backup API）；加密存储；不含明文产品私钥。
  - 触发：开票成功后 **异步**全量备份 + **每日**全量日备份并轮转旧备份文件；支持手动「立即备份」。
  - 落盘：P0 **仅本机第二目录**（可配置本地路径）；U 盘/网盘本阶段不做。  
  - 备份文件可按策略轮转（如约 14 天）；与活库十年存档分离。  
  - **备份失败则阻断新的正式开票**（已签票不回滚；重打/查票仍可）；须提示原因。须可做恢复演练。禁止默认裸拷 `.db`；不为备份轮询云端。

### 2.10 合规版本发布与人工升级

- 订阅 AT 官方公告（Portal das Finanças），法规变更第一时间响应
- 合规模块（lib/compliance/）与业务逻辑严格分离，法规变更只改合规模块
- AT 沙盒环境常备，每个新版本发布前先完成沙盒验证、回归测试和安装包签名校验。
- 不提供自动更新、静默升级或后台下载安装功能。
- 新版本由软件提供方发布独立签名安装包，由门店管理员在维护时段手动升级。
- 软件可以显示版本过期或合规风险提示，但不得远程停用、自动升级或因无法联网而阻断已注册系列的本地开票。

### 2.11 QES 电子签名

- 不在本产品范围内
- 餐饮场景发票以热敏纸小票为主，QES 仅针对 PDF 电子发票，本产品不提供 PDF 发票
## 3. 系统架构

### 3.1 部署模式

每个门店只部署一个 Mesa Local Fiscal Agent。该 Agent 安装在指定 Windows 收银台电脑上，并作为该门店唯一税务权威节点。

**门店本地结构：**

```text
指定 Windows 收银台电脑
├── Mesa 收银端
├── Mesa Local Fiscal Agent
│   ├── Agent Local API
│   ├── Fiscal Core
│   ├── SQLite 税务权威数据库
│   ├── Local Print Queue
│   ├── Print Worker
│   ├── Sync Inbox / Sync Outbox
│   └── Local Admin Console
└── 热敏打印机
```

**P0 规则：**

- 每个门店只有一个 Agent、一个 SQLite、一个系列编号与 Hash 链权威节点。
- Agent 默认只监听 127.0.0.1；启用门店局域网模式后，可监听管理员指定网卡和端口。公网暴露始终禁止。
- 单机模式下仅 Agent 所在收银台电脑能够签发、重打和打印；局域网模式下，仅已配对的 Windows 收银终端可以访问同一个 Agent。
- 手机和平板仅用于点餐和业务操作，不直接访问 Fiscal Agent。
- Agent 主机故障时，其他终端不得自行接管签发；必须执行正式备份恢复和主机迁移流程（**对接说明 §12**）。
- 一个 Agent 可以管理多台逻辑打印机，但所有正式税务文件统一由该 Agent 签发并进入本地打印队列。

### 3.2 与订单系统对接

集成采用“所有签发统一走 Agent Local API、云端只负责同步”的架构。

- Mesa 收银端无论在线或离线，均通过本机 Agent Local API 发起正式税务文件签发。
- 收银端提交冻结销售快照、客户资料、付款信息、request_id 和业务幂等范围。
- Agent 完成校验、系列锁、编号分配、Hash、ATCUD、QR、不可变税务记录和 ORIGINAL 打印任务创建。
- 云端和 Supabase 不参与 InvoiceNo、Hash、ATCUD、QR、系列编号或正式打印任务创建。
- Agent 签发和打印完成后，通过 sync_outbox 将结果异步同步到云端。
- 云端不可用时，签发和打印不受影响；恢复联网后自动补传。
- Agent Local API 默认仅监听 127.0.0.1；局域网模式下可由已配对的 Windows 收银终端访问。
- P0 废除手机/PWA 直接访问 Agent 的方案，不实现移动端 mDNS、局域网发现、本地 HTTPS 证书部署或移动端配对。

#### 3.2.1 统一签发入口

**所有正式税务文件统一调用：**

```http
POST   /local/v1/fiscal-documents
GET    /local/v1/fiscal-documents/by-request/{requestId}
POST   /local/v1/fiscal-documents/{documentId}/reprints
POST   /local/v1/fiscal-documents/{documentId}/credit-notes
POST   /local/v1/fiscal-documents/{documentId}/debit-notes
GET    /local/v1/print-jobs/{printJobId}
```

**首次签发接口不是普通打印接口。其职责为：**

- 鉴权
- 请求幂等校验
- 业务范围幂等校验
- 销售快照与基础数据校验
- 税务签发
- ORIGINAL 打印任务创建
- 返回 document_id、invoice_no、ATCUD、document_status、print_job_id 和 print_status
前端不得上传或控制 InvoiceNo、PreviousHash、Hash、ATCUD、QR、SystemEntryDate 或系列顺序号。

#### 3.2.2 开票来源与「离线」（定稿，与对接说明 §3.2 一致）

**两种来源：**

1. **API 开票（Mesa 桌台）**：点「打印发票」调 Agent Local API，推入冻结销售快照 → **仅签发 FT** → 本地打印 → 状态回传 / outbox。  
2. **Agent 本地 UI（须登录）**：**NC / FS / FR / ND**、本地手动 FT、查票重打等在此办理；与 API 共用同一 Fiscal Core。

**口径：**

- **不存在**「断网前缓存的 Mesa 账单」作为开票数据源；未点「打印发票」则该笔业务销售快照不进 Agent。  
- 数据一旦进入 Agent，签发与正式打印 **不依赖** 云端；断网只影响状态副本同步。  
- 网络恢复时补传 `sync_outbox`（启动连通 / 恢复事件 / 显式重试）；**禁止**定时轮询耗费流量与性能。  
- 在线与相对云端离线必须调用同一个 Agent 应用服务，不允许两套签发逻辑。

Agent SQLite 是税务状态最终裁决者；云端只保存同步副本。

#### 3.2.3 业务幂等

**请求幂等键：**

- store_id + request_id

**业务幂等键：**

- store_id + source_system + source_sale_id + scope_type + scope_id + fiscal_purpose
相同 request_id 与相同 payload 返回原结果。

相同 request_id 但 payload 不同返回冲突。

不同 request_id 但业务幂等范围相同，返回原税务文件，不得再次签发。

餐饮分单：**结账继续用 `person_index`**；**开票业务幂等禁止用 `person_index`**，须用稳定键——已收款用 `session_collected_payments.id`（`payment_allocation_id`），对分单行开票用行内稳定 `party_id`（uuid，创建行时生成）。**关台不影响开票**；Mesa 选整桌开票与选分单开票 **互斥**；按人支持部分已开后对其余补票。分单各 FT **税务相互独立**（各自编号/Hash），仅业务上同属一 `bill_split`；冲销时一 NC 只引一张原 FT。历史关台数据不迁移；详见对接说明 §3.1。

#### 3.2.4 Agent 网络模式与可配置项

**Agent 支持两种部署模式：**

**单机模式（默认）：**

- bind_host = 127.0.0.1
- 仅 Agent 所在 Windows 收银台电脑可访问。
- 不开放 Windows 防火墙入站端口。
- 不需要局域网设备发现。

**门店局域网模式（可选）：**

- 一个门店仍只运行一个 Agent。
- 多台 Windows 收银终端通过门店局域网访问同一个 Agent。
- 手机和平板不进入 P0 正式签发范围。
- Agent 监听地址、端口、公布地址和允许访问网段必须可配置。

**最低配置项：**

- agent.network_mode = LOCAL_ONLY | STORE_LAN
- agent.bind_host
- agent.port
- agent.advertised_host
- agent.allowed_subnets[]
- agent.require_device_pairing
- agent.tls_enabled（**默认 false**；P0 **不强制** TLS，收银机间可明文 HTTP；见下）

**局域网 TLS（定稿）：** P0 接受明文 HTTP；安全靠配对、鉴权、`allowed_subnets`、禁止公网；建议店内专用网与访客 Wi‑Fi 隔离。`tls_enabled` 可选留给高要求门店，不当门禁。不做手机侧本地 CA / 强制局域网 HTTPS。

**配置示例：**

- network_mode = STORE_LAN
- bind_host = 0.0.0.0
- port = 17880
- advertised_host = 192.168.1.10
- allowed_subnets = [192.168.1.0/24]
- require_device_pairing = true

**强制规则：**

- 示例地址仅用于说明，禁止在程序中硬编码 192.168.1.10。
- 管理员可以配置其他私网地址和端口。
- advertised_host 必须是终端实际可访问的地址或本地域名。
- 推荐通过路由器 DHCP Reservation 固定 Agent 主机地址。
- Agent 不得监听公网网卡或允许公网网段。
- allowed_subnets 仅是网络边界，不能替代设备鉴权。
- 局域网模式必须启用终端配对和设备级凭证。
- 每台 Windows 收银终端拥有独立 device_id，支持吊销。
- 修改 bind_host、port、advertised_host、allowed_subnets 或 TLS 配置后，必须重新执行：
1. Agent 自检；
2. Windows 防火墙规则检查；
3. 已配对终端连接测试；
4. 鉴权测试；
5. 测试打印。
- 配置变更必须写入审计日志，记录操作员、旧值、新值和时间。
- 即使多台终端并发调用，所有签发仍在同一个 Agent、同一个 SQLite 和同一个系列锁中串行完成。

### 3.3 打印架构

正式税务打印统一使用 Agent 本地 SQLite 打印队列。发票签发与物理打印是两个独立状态，但首次签发时必须在同一数据库事务中创建税务文件与 ORIGINAL 打印任务。签发成功后即形成有效税务文件；打印失败不得回滚或重新签发。

- **业务热敏**（厨打 / 预结单 / 收款小票等）继续走云端 `print_jobs` → 同一 Agent 认领（现有路径）。
- **正式税务**（`fiscal_document` / 本地 `local_print_job`）权威队列仅在 Agent SQLite；payload 由 Fiscal Core 从不可变税务记录生成。
- document_type 使用 FT | FS | FR | NC | ND。
- print_purpose 使用 ORIGINAL | REPRINT。
- ORIGINAL 任务在首次签发事务中创建；打印失败后的自动重试沿用同一任务。
- 只有人工确认需要再次出纸时才创建新的 REPRINT 任务。

#### 3.3.1 fiscal_document 打印流程

- 收银员点击“签发并打印发票”。
- Mesa 收银端调用本机 Agent Local API。
- Agent 在 SQLite BEGIN IMMEDIATE 事务中完成：幂等检查、系列锁、编号、Hash、ATCUD、QR、税务文件写入、series.last_number/last_hash 更新、ORIGINAL local_print_job 插入。
- 事务提交后 Print Worker 领取本地任务。
- Print Worker 执行 claim → processing → ESC/POS/WinSpool/TCP 出纸 → printed | failed_before_write | unknown_after_write。
- 打印成功或失败结果写入本地 print_attempts，并通过 sync_outbox 异步同步云端。
- 云端同步失败不影响发票成立或打印结果。

#### 3.3.2 冻结 print_payload

正式税务本地打印任务的 payload 必须保存可直接打印的完整税务快照。Agent 打印时不得回查订单表，也不得重新计算税务数据。云端 `print_jobs` **不是**正式票权威队列。

- 必含：payload_version、payload_hash、document_id、document_type、print_purpose、invoice_no、issued_at。
- 商家：法律名称、商业名称、NIF、地址、软件认证编号。
- 客户：名称、NIF、国家及依法需要的地址信息。
- 明细：冻结描述、数量、**折后**含税单价、VAT 税率、净额、税额、含税金额（MVP 无独立折扣字段）。
- 汇总：按税率汇总、NetTotal、TaxPayable、GrossTotal、付款方式。
- 合规：ATCUD、QR 原始字符串、NC 原 FT 引用及更正原因。
- payload_hash 用于检测 Mesa 或 Agent 侧的内容篡改；发现不一致时禁止打印并记录错误。

#### 3.3.3 二维码职责

- QR 法定内容字符串由 Agent Fiscal Core 生成并保存在税务文档及 print_payload.qr.content。
- Mesa 必须原样存储和传输 qr.content，不得重新拼接、删减或转换字段。
- Go Agent 仅将 qr.content 编码为二维码图形并打印，不参与 QR 业务字段计算。
- 纸宽、模块大小和纠错等级属于打印表现参数；不得改变 qr.content。
- 重打必须使用原税务文档保存的 qr.content，不得重新计算 ATCUD 或 QR 字段。

#### 3.3.4 打印机发现与绑定

打印机发现、测试和绑定继续由主机上的 Mesa Fiscal Agent（由 Go print-agent 演进）负责，不另建第二套打印驱动。

- Agent 枚举 Windows 已安装打印队列、已配置 TCP 热敏打印机及管理员手工添加的目标。
- TCP 设备只允许扫描管理员指定网段或手工输入 IP/端口，禁止无边界扫描。
- 管理员选择设备并测试打印成功后，绑定 logical_role=fiscal_receipt_printer。
- 绑定记录由 Mesa/Agent 维护，至少包含 device_id、connection_type、queue_name 或 host/port、纸宽、code page、切纸配置和状态。
- fiscal_document 任务只声明 logical_role，不包含打印机 IP、端口或 Windows 队列名。

#### 3.3.5 打印状态与重打

- 发票状态与打印状态分离：document_status=ISSUED；print_status=PENDING | PROCESSING | PRINTED | FAILED。
- PRINT_FAILED 仅表示物理打印失败，FT/NC 仍已成立。
- 重试必须使用同一 document_id 和同一冻结 print_payload；不得重新调用 FT/NC 签发逻辑。
- 重打创建新的 fiscal_document 打印任务，print_purpose=REPRINT，并记录操作员、时间、原因及次数。
- 重新绑定打印机不影响历史税务文件；历史重打仍使用原冻结快照。

#### 3.3.6 安全与租户隔离

- Mesa 调用发票 API 的凭证仅保存在 Mesa 服务端，不进入浏览器和 Go Agent。
- Agent 设备凭证（`agentjwt`）、开票终端凭证、业务 `print_jobs` 与税务同步副本必须绑定 restaurant_id。
- fiscal_document / 本地正式打印 payload 对打印路径只读；打印模块无权修改税务字段或回写新内容。
- Agent 只回写任务状态、打印设备、错误码和打印时间。
## 4. 用户角色

角色范围

- 开票角色对齐 Mesa：店长（owner）、前台（frontdesk）、收银（cashier）；waiter/kitchen 不开正式票。
- 店主/管理员：门店与税务主体配置、系列管理、税率与商品配置、打印机绑定、SAF-T、备份恢复、用户管理和审计查询；**查票 / 重打本店全部**。
- 前台 / 收银：日常签发（默认 FT；NC 及 FS/FR/ND 同入口可选）；**查票 / 重打仅限本人签发的票**（`SourceID` = 本人）；不放宽到「今天本店」。
- 有网在 Mesa 查同步副本、离线在 Agent 查本地库，过滤规则相同；后端必须强制过滤。
- 不设计会计、主管、技术支持或其他独立账号类型。需要外部人员协助时，由店主现场操作或临时共享店主权限，系统不为此增加新角色。
模块优先级

- 用户与权限模块优先级为最后。
- P0 先完成：FT、NC、编号与 Hash、ATCUD、QR、打印、系列、SAF-T、SQLite 事务、备份恢复和 Mesa 接口。
- 用户模块首版只实现最小登录、角色识别和权限校验，不优先建设复杂用户管理界面。
- 完整的账号新增、停用、密码重置、权限配置和操作审计界面在核心开票链稳定后实施。
- 角色
- 说明
- 店长（owner）
- 管理本店配置、员工 PIN、AT 凭证、系列、报表、SAF-T；查票/重打本店全部
- 前台 / 收银（frontdesk / cashier）
- 日常开票；查票/重打仅本人
- Mesa 收银端（主机或已登记开票终端）
- 通过 Agent Local API 触发开票
## 5. AT 凭证管理

餐馆在 Portal das Finanças 创建子用户并开通 **WSE**（系列通信必选；WFA/WDT 非本产品 MVP）权限，将凭证填入本软件。系统按认证范围注册系列（FT/FS/FR/NC/ND 等），获取 ATCUD 验证码。

凭证加密存储（AES-256），不以明文落库，不打印至日志。

**SOAP 接口认证边界：**

- MVP 只调用 Series / ATCUD Webservice，不调用 e-Fatura 实时发票上报接口。
- 调用 AT Webservice 时，SOAP Header 必须按官方 *Aspetos Genéricos* 实现 WS-Security；**不得**简化为「Password Base64」。

### 5.1 证书与密钥三层（不得混用）

| 层 | 是什么 | 谁提供 / 谁配置 | 用途 |
|----|--------|-----------------|------|
| A. TLS 服务端信任 | 连接 `servicos.portaldasfinancas.gov.pt` 的 HTTPS | 系统信任库 / 公开 CA | 传输加密 |
| B. 客户端通信证书 | AT 签发的通信用数字证书（测试证与生产证分离） | **软件生产商**向 AT 申请；Agent 安装侧配置，**不是**店员自签 | 建立与 AT Webservice 的客户端认证通信 |
| C. 口令加密公钥 | Portal「Sistema de Autenticação」公钥 | AT 发放给软件生产商 | 加密 SOAP Header 中的用户口令 |

另：Modelo 24 **软件签名公钥**（Hash 产品钥）属开票签名体系，**不是**上表 B/C，不得当作 Series 通信证书使用。

店长在 Agent 只配置：**餐馆 NIF + 子用户编号 + 口令**（及环境切换）。通信证书与口令加密公钥由软件包 / 运营方下发或安装向导导入，店员不得「随便造一把」连 AT。

### 5.2 环境切换 `at_env`

配置项：`at_env` = `test` | `prod`（显式，禁止靠改 URL 字符串猜环境）。

| `at_env` | Series Webservice |
|----------|-------------------|
| `test` | `https://servicos.portaldasfinancas.gov.pt:722/SeriesWSService` |
| `prod` | `https://servicos.portaldasfinancas.gov.pt:422/SeriesWSService` |

- 测试环境：业务数据进 AT 测试库；**登录仍校验生产 Portal 子用户口令**（官方手册）。
- 未认证阶段：`SoftwareCertificateNumber` 可用占位 `0`（见对接说明 §6.1b）；正式生产不得为 0。
- 切换 `at_env` 必须二次确认，并记入审计（操作员、时间、旧值、新值）。

### 5.3 登录与 Username

- Username：`{餐馆NIF}/{子用户编号}`，例如 `599999993/37`。
- Password、Nonce、Created 的生成、加密、编码、有效期以 *Aspetos Genéricos* 为准（口令用 §5.1-C 公钥加密）。
- 原始口令 AES-256 存储；日志 / 错误 / 调试不得出现明文凭证、证书私钥或口令密文可逆材料。
- 凭证过期或权限不足：提示店长到 Portal 检查子用户与 **WSE** 后重配。

### 5.4 开发阶段（无企业 NIF / 无 AT 测试材料）

- 公开文档**无**独立开发者专用测试 NIF；测试材料须向 AT 申请（e-balcão / 软件生产商区 / `asi-cd@at.gov.pt`）。
- **无**测试证书 + 口令加密公钥期间：Series 客户端允许 **mock**（本地返回假验证码），本地状态机与开票主链路可继续开发；**不得**用自制证书冒充连接官方 `:722`/`:422`。
- **有**测试材料后：必须在 `at_env=test` 跑通注册 / 查询 / 终结与错误凭证用例，方可视为 B2 联调通过。
- 日常开票不依赖 AT 在线；仅系列生命周期任务联网（见 6.5）。

**开发验收（真联调，材料齐全后）：** 测试环境成功注册、查询、终结测试系列；错误凭证返回可识别错误码。

## 6. 核心功能范围

- MVP（第一阶段）

### 6.1 手动开票

收银员（或店长/前台）登录后进入开票界面。

**选品录入（定稿）：**

- 以 **按名称联想 / 自动补全** 为主：输入关键字，从 Agent 本地商品库匹配并点选；库内含 **（1）Mesa 同步只读副本（2）本地自建可维护项**。选中后自动带入合规名（`name_pt`→`name_en`）、`item_code`、含税单价、VAT 税率。  
- 匹配字段至少含 `name_pt`、`name_en`；可选同时匹配 `item_code`。展示优先葡语名，无则英语；中文仅可作辅助展示（远端副本），写入快照的仍是葡/英合规名。  
- 仅查本地库，**不**为联想去轮询云端。  
- **远端同步项在 Agent 上只读**（改菜单回 Mesa）；**本地自建项**可在 Agent 增删改，**不**同步到 Mesa。  
- 仍允许少量「自由行」：无匹配商品时手工填葡语/英文合规名、数量、含税单价、VAT（须过 Windows-1252）；不能用中文作合规名。

VAT 税率：6% / 13% / 23% / 免税。

所有菜单价格、手动录入价格均为含税价格，即顾客实际支付价格。

顾客 NIF 可选填；系统根据发票类型和客户资料规则决定使用 999999990、真实 NIF 或完整客户资料。

实时计算各税率小计、税额、含税总额。

开 FS 时：若 GrossTotal 超过门店可配置的 `fs_amount_threshold`（默认 `100.00`，见 2.7.1），系统必须提示并阻断或改为开 FT，不得静默继续按 FS 开具。日常默认开 FT 不读该门槛。

**开票事务流程：**

- 确认开票
- ↓
- 锁定系列（数据库级排他锁，见12.1）
- ↓
- 生成序号（同一事务内原子自增，见12.1）
- ↓
- 读取 PreviousHash
- ↓
- 计算 Hash
- ↓
- 生成 ATCUD
- ↓
- 生成 QR 内容
- ↓
- 写入数据库并提交事务
- ↓
- 调用打印机打印

**规则：**

- 草稿状态不生成 InvoiceNo、ATCUD、Hash，不占用系列序号。
点击确认开票后，系统进入不可逆开票事务。

发票签名并写入数据库成功后，即视为已开具发票。

打印失败不得回滚发票编号、Hash、ATCUD 或数据库记录。

打印失败时，发票税务状态保持已签名，打印状态标记为 PRINT_FAILED。

系统必须提示收银员检查打印机，并允许对同一张发票执行重打。

重打必须使用原始发票数据，不得重新生成编号、Hash、ATCUD、QR 或金额。

每次打印失败和重打操作必须写入审计日志。

SAF-T 导出仍导出已签名但打印失败的发票，不得因为打印失败排除。

MVP 不支持直接取消/作废已签名发票；所有更正、退款、冲销统一通过 NC 贷记单处理。

【新增，见12.1】序号生成必须保证原子性：进程在"计算 Hash 之后、事务提交之前"崩溃或断电时，绝不能出现序号被跳过（断号）的情况。工程实现建议采用数据库行级锁 + 单一事务内完成"读取最大序号→分配新序号→签名→写入"，且序号分配逻辑不得在业务层预先取号后再等待签名结果。

### 6.2 Agent Local API 开票

Mesa 收银端统一通过本机 Agent Local API签发税务文件。

首版认证范围：FT、FS、FR、NC、ND。

**默认业务策略：**

- 正常销售默认 FT。
- 退款、退货、取消、金额减少和错误票据冲销默认 NC。
- FS、FR、ND 在同一开票入口可选，受独立系列、门槛与业务校验约束；不设高级入口。
- 店长 / 前台 / 收银均可开五种类型。

**接口规则：**

- Agent API 默认监听 127.0.0.1；局域网模式下监听地址和端口由管理员配置。
- 鉴权凭证仅授予本机 Mesa 收银端。
- API 价格字段使用 decimal 字符串，例如 "12.50"；不得使用 JavaScript 浮点数作为税务金额权威。
- Agent重新校验金额、税率、商品和客户资料。
- 前端不能提交 InvoiceNo、Hash、ATCUD、QR 或顺序号。
- 税务文件、系列状态和 ORIGINAL 打印任务在同一 SQLite 事务中创建。
- 返回响应丢失时，使用同一 request_id 查询或重试，Agent返回原结果。
- 云端同步失败只进入 sync_outbox，不重新签发。

### 6.3 发票管理

发票列表：按日期、类型、状态、金额筛选。

发票详情：展示所有字段，含 Hash 值、HashControl、ATCUD、QR 码预览。

发票重打：重新推送至打印机，但不得重新生成发票数据。

发票更正/退款/冲销：生成 NC 贷记单，关联原发票。

MVP 不提供直接取消/作废已签名发票功能。

- 税务状态： DRAFT / SIGNED / CREDITED_PARTIAL / CREDITED_FULL
- 打印状态： NOT_PRINTED / PRINTED / PRINT_FAILED / REPRINTED

**状态流转规则：**

- DRAFT
- ↓ 确认开票

```text
SIGNED
• ↓ 打印成功
SIGNED + PRINTED
SIGNED
• ↓ 打印失败
SIGNED + PRINT_FAILED
• ↓ 重打成功
SIGNED + REPRINTED
SIGNED
• ↓ 全额 NC
CREDITED_FULL
SIGNED
• ↓ 部分 NC
CREDITED_PARTIAL
```

**规则：**

- DRAFT 不进入 SAF-T，不占用编号。
SIGNED 发票不允许修改金额、客户、税率、商品行、日期、编号、Hash 或 ATCUD。

PRINT_FAILED 不改变税务状态，只改变打印状态。

CREDITED_PARTIAL / CREDITED_FULL 只是业务关联状态，原始发票仍按原始数据导出 SAF-T。

NC 自己拥有独立 InvoiceNo、ATCUD、Hash、HashControl 和 NC 系列。

### 6.4 菜品菜单管理

**双源（定稿）：**

| 来源 | 权威 | Agent 上 | 同步方向 |
|------|------|----------|----------|
| Mesa 菜单 | Mesa | 同步为 **只读副本**；不可在 Agent 修改 | Mesa → Agent；**不**回写 |
| Agent 本地自建开票菜单 | Agent | **可**手工维护（增删改名称/编号/价税等） | **不**同步到 Mesa |

**目录结构：** Agent **复用 Mesa 现有菜单目录结构**（分类、编号、三语名、价税等），不另设计平行目录模型；本地自建项尽量同一字段形状。以此减少本地菜单开发量。

合规名称规则（两源相同）：

- SAF-T / 正式票描述 = `name_pt`（非空）否则 `name_en`；禁止中文作合规名。  
- 葡英皆空或未过 Windows-1252 → 阻断开票。  
- `item_code` 作 ProductCode（本地自建可自编；远端沿用 Mesa 编号）。  

手动开票联想补全同时覆盖两源（见 6.1）。历史已签发票不受后续改价/改名影响。

**折扣规则（定稿，与对接说明 §6.4 一致）：**

- MVP **不**生成 SettlementAmount；**不**要求把 Mesa `discount_rate` 传入正式票。  
- 开票快照只含 **折后成交价**（与结账实付一致）；发票不保存原价/折扣率/折扣原因。  
- 这是餐饮常见合规做法：优惠在开票前消化进成交价，保证 GrossTotal = 实付 = Hash/QR/打印一致。

### 6.5 系列管理

门店开通时注册认证所需类型系列（至少 FT/NC 为日常；FS/FR/ND 须可注册激活以供同入口开具）；不实时上传发票明细。

展示每个系列：本地状态、当前最新序号、最后 Hash、验证码（已激活时）、最近一次 AT 返回码/时间。

**系列本地状态机（B2 定稿）：**

| 状态 | 含义 | 可否开该类型票 |
|------|------|----------------|
| `not_registered` | 本地尚无有效验证码 | 否 |
| `registering` | 正在调用 AT（注册/绑定查询中） | 否 |
| `active` | 已绑定验证码，可签发 | **是** |
| `failed` | 最近一次 AT 调用失败（保留错误详情） | 否 |
| `finalizing` | 正在向 AT 终结系列 | 否 |
| `finalized` | 已终结，不可再签发 | 否 |
| `annulled` | 已按 AT 流程作废 | 否 |

流转要点：

1. 管理员显式触发注册：`not_registered` / `failed` → `registering`。
2. 注册前必须先 `consultarSeries`；AT 已有同名同类型有效系列 → **绑定**验证码 → `active`（不得重复 `registarSerie`）。
3. 注册/绑定成功 → `active`；AT 业务拒绝 → `failed`（保存返回码、原因、时间、操作人）。
4. 仅 `registering` / `failed` 允许**同参数**手动重试；**禁止**对 `active` 自动轮询 AT；**禁止**无限自动重试死循环（网络抖动可有限次退避，次数可配置，默认 ≤3，其后须人工重试）。
5. 终结：`active` → `finalizing` → 成功则 `finalized`；失败回 `active` 或 `failed` 并展示原因（不得在未确认 AT 成功时本地假装已终结）。
6. 换机/无可靠备份：按对接说明 §12 终结旧系列后新注册（新验证码、序号从 1）；不得在无法确认 last_number/last_hash 时继续 `active`。

**谁触发 AT：** 仅店长/管理员在 Agent 本地；**永不**嵌入单张开票事务。启动时只做**本地**检查是否已有当年 `active` 系列；缺则阻断该类型并提示联网注册。

**年度系列：**

- 新系列须管理员联网触发；建议每年 12 月预注册下一年度，避免新年断网无法开票。
- 开票兜底：确认对应类型系列为 `active`。

**离线开票边界：**

- 仅当该类型系列已为 `active` 且本地 last_number/last_hash 可信时可离线签发。
- 未注册 / `failed` / 已终结 → 阻断并提示（本地合规状态问题，不是「每张票都要联网」）。

**已存在 / 重装 / 恢复备份：**

- 注册前先 `consultarSeries`；已存在则绑定验证码，不盲目新建。
- 本地库仍在：以本地 `last_number`、`last_hash`、`validation_code` 为准。
- 本地丢失但 AT 系列仍在：**不得**直接续开；须恢复备份并校验，或终结后新系列。
- 恢复后校验：最后序号、最后 Hash、验证码、数量、链连续性；无法确认则阻断该系列。

【重要风险提示】`consultarSeries` 通常**不**返回「最后用到第几号」。无备份则旧系列往往只能终结重建。备份可靠性等同 Hash 链与系列生命周期（见对接说明 §12.7）。

#### 6.5.1 离线开票与外部通信边界

FT 与 NC 的日常开具是完全本地事务，不要求在每张发票签发时与 AT、云端订单系统或任何外部服务通信。

- 开票所需的商品、税率、客户快照、系列验证码、序号、前一张 Hash、签名私钥和打印模板必须已保存在本地主机。
- 签发流程只访问本地服务和本地数据库：分配序号 → 计算金额 → 生成 Hash/ATCUD/QR → 保存不可变快照 → 提交事务 → 打印。
- 联网仅用于开票之外的独立任务：首次或新年度系列注册/查询、法定期限内的发票数据通信、管理员主动执行的外部数据同步。
- 互联网中断不得影响已有激活系列的 FT/NC 开具、重打、NC 引用、日结和 SAF-T 文件生成。
- 若当前类型没有已激活系列或本地无法确认 last_number/last_hash，则必须阻断该类型开票；这属于本地合规状态缺失，不是日常联网依赖。
- 云端订单同步失败时，只暂停云端账单拉取和回执，不影响本地手工开票；恢复联网后依靠 external_bill_id 唯一约束实现幂等同步。

### 6.6 SAF-T 月报

- 每月1日由本地任务生成上月 SAF-T XML 文件；生成过程不依赖互联网。
- 店主可手动触发生成、下载
- 本地系统按配置提醒店主在法定期限内联网提交；发票开具与后续集中通信是两个独立流程。
- 保存每月归档记录，支持历史下载

### 6.7 用户与权限管理

- 店主可创建收银员账号，设置权限
- 收银员只能操作开票，无法访问配置和报表
- JWT 鉴权，Token 有效期 8 小时

### 6.8 手动版本升级

- 软件不主动联网检查、下载或安装新版本。
- 升级由门店管理员使用已签名的离线安装包手动执行；升级前必须完成一致性备份并确认无进行中的开票事务。
- 每个安装包必须包含版本号、发布说明、数据库迁移说明、合规变更说明和回滚方案。
6.9 客户资料管理

MVP 必须提供本地客户资料管理能力，用于 SAF-T Customer 主数据、发票开具、重打、NC 冲销和老客户复用。

本模块统一称为"客户资料/Customer Master Data"，不得称为"用户资料"，避免与登录系统的 User 混淆。

**客户资料字段分为两类：**

- 必须有值字段： CustomerTaxID、CompanyName、Country、AccountID、SelfBillingIndicator
- 建议补全字段： AddressDetail、City、PostalCode

**系统必须内置最终消费者客户：**

- CustomerID = CONSUMIDOR_FINAL
CustomerTaxID = 999999990

CompanyName = Consumidor final

AddressDetail = Desconhecido

City = Desconhecido

PostalCode = Desconhecido

Country = PT

AccountID = Desconhecido

SelfBillingIndicator = 0

completeness_status = SYSTEM_DEFAULT

客户资料来源：系统默认；收银员手工录入；历史客户档案；未来外部企业信息查询服务。

MVP 不强依赖外部企业信息查询服务。外部查询仅作为辅助自动填充，结果必须允许人工确认和修改。

**系统应设计两层客户资料：**

- customers                  客户主档，用于搜索、复用和自动带出（**权威在 Agent 本地**）
- invoice_customer_snapshot  发票客户快照，用于锁定开票当时资料

**录入 UX（定稿）：**

- 输入 NIF 时必须支持 **本地自动检索**，按相关度/最近使用等排序列出候选供挑选。  
- 选中后自动带出主档中的名称、地址等字段填入开票表单。  
- 检索只查 Agent 本地主档，不为选客户轮询云端。  
- Mesa 桌台 API 开 FT 可只传本次 NIF/散客；Agent 可用本地主档补全。  
- **新客 / 主档尚无的 NIF：开票确认后必须将 NIF（及已填抬头）保存到本地主档**，不得只出票不落档。散客 `999999990` 用系统默认，不必当「新客」重复建档。

**规则：**

- 系统必须本地保存客户主档。
每张发票开具时，必须保存一份客户资料快照。

发票签名后，客户快照不得修改。

客户主档后续修改，不影响历史发票打印、重打和 NC 冲销。

SAF-T 导出时，MasterFiles > Customer 必须覆盖导出期内所有发票引用的客户。

客户主档修改必须记录审计日志。

地址、城市、邮编缺失或错误通常不影响 IVA 金额申报，但会影响客户抬头准确性和客户报销/入账，因此系统应支持补全和修改客户主档。

历史发票客户快照不得因客户主档后续修改而自动变化。

**客户资料完整性状态：**

- 状态
- 含义
- 是否允许开票
SYSTEM_DEFAULT

- 系统内置最终消费者
- 是
COMPLETE

- 已填写 NIF/名称/国家，并填写地址、城市、邮编
- 是
INCOMPLETE

- 有 NIF，但名称或地址信息不完整，使用 Desconhecido 或 NIF 占位
- 是
INVALID

- NIF 格式错误或国家代码非法
- 否
如果客户只提供 NIF，且无法提供名称和地址，系统允许按兼容策略生成客户（同2.7.2），completeness_status = INCOMPLETE，后台提醒补全，不阻断开票。

企业客户完整抬头不是 MVP 默认强制项。系统可提供"严格企业抬头模式"配置：开启后，企业客户开 FT 时必须填写或确认 CompanyName / AddressDetail / City / PostalCode / Country；默认关闭。

### 6.10 付款记录与日结对账

MVP 必须本地保存付款记录，但不导出 SAF-T SourceDocuments/Payments 节点，也不生成 Invoice/DocumentTotals/Payment。

- 付款方式： CASH / CARD / MBWAY / MULTIBANCO / MIXED / OTHER

**规则：**

- 每张发票必须保存付款方式、付款金额、付款时间、收银员。
混合支付时必须保存多条 payment lines。

付款记录用于餐馆日结、对账和报表，不作为 MVP SAF-T Payments 导出依据。

若未来支持独立收据、赊账后收款、IVA de Caixa 或 FR/RC/RG 文件，则必须重新评估 Payments 节点导出规则。

建议日结至少包含：business_date, cashier_id, cash_total, card_total, mbway_total, multibanco_total, invoice_count, nc_count, gross_sales, refund_amount, difference_note, closed_by, closed_at

### 6.11 系统时间规则

开票时使用本地主机系统时间生成 InvoiceDate 和 SystemEntryDate。

同一类型+同一系列内，新发票 SystemEntryDate 不得早于上一张已签名发票的 SystemEntryDate。

如果检测到系统时间倒退，系统必须阻断开票。

阻断时提示管理员修正系统时间。

被阻断事件必须写入审计日志。

已签名发票的 InvoiceDate、SystemEntryDate 不得修改。

### 6.12 签名私钥保护、设备封装与换机恢复

签名私钥属于软件生产商，是认证产品的核心资产。

**两把钥匙（大白话）：**

| 钥匙 | 谁持有 | 干什么 |
|------|--------|--------|
| 产品开票签名钥 | **仅软件运营方**（托管） | RSA-SHA1 签发票；公钥交 Modelo 24 |
| 设备钥 | **本台** Agent 主机（TPM 或软件降级） | 解开下发的 `wrapped_fiscal_key`；日常离线可签 |

店里磁盘上只有「用这台设备钥才能解开的密文」，**没有**产品私钥明文。

**总体原则：**

- 产品级税务签名私钥由软件运营方集中控制。
- 私钥不得明文写入代码仓库、Agent 二进制、安装包、数据库、普通配置文件或日志。
- 每个门店只部署一个 Agent；每个 Agent 安装实例拥有唯一 `installation_id` 和 `device_id`。
- 软件运营方按 `installation_id` + 设备公钥，将产品私钥封装为设备绑定的 `wrapped_fiscal_key` 后下发。
- Agent 仅保存 `wrapped_fiscal_key`、`signing_key_version`、`device_binding` 与 provisioning 元数据。
- 日常离线签发**不得**依赖运营方在线；本机解封后仅在内存使用私钥。
- 不提供通用 `sign(data)` 接口；签名只允许 Fiscal Core 对合规结构化明文调用。

#### 6.12.1 设备钥：TPM 优先，无 TPM 可降级（B3）

| `key_protection_level` | 条件 | 做法 |
|------------------------|------|------|
| `TPM` | 主机具备可用 TPM/CNG Platform Crypto Provider | **优先**；设备钥尽量不可导出 |
| `SOFTWARE` | 无 TPM 或 TPM 不可用 | Windows Software KSP + **DPAPI/DPAPI-NG**（绑本机/用户）；**允许安装**，不得因无 TPM 拒装 |

- 激活时必须写入并上报 `key_protection_level`；运营后台可见；SOFTWARE 档在失窃/换机时优先关注。
- **禁止**无 TPM 时把产品私钥或设备钥以明文 PEM 落盘。
- 降级不降低「必须运营封装 + 换机人审」的要求；只是设备锁从芯片换成 OS 保护。

#### 6.12.2 运营方密钥托管（B3）

- 产品私钥**只**存在运营方受控环境（P0：加密保管 + 极少人触达的加固主机；后续可迁 HSM）。
- 封装服务：输入设备公钥 / `installation_id` → 输出该设备专用 `wrapped_fiscal_key`；**永不**向门店下发产品私钥明文。
- 税务库备份**不含**产品私钥明文；备份里的旧 `wrapped_fiscal_key` 绑旧设备，换机后不能直接用来签名。
- P0 默认 `signing_key_version = 1`；更换产品钥须走 Modelo 24 / AT 换公钥流程，不得店内私自换版。

#### 6.12.3 换机审批（B3）

- **必须人审**：店长发起 → 运营方 **approve / reject** → 通过才下发新 `wrapped_fiscal_key` 并吊销旧 `installation_id`。
- **禁止**店员/收银自助「再装一台就自动能签」；**禁止** Agent 持有可任意封装任意设备的运营主密钥。
- 申请至少含：门店、旧 `installation_id`、新设备公钥、`key_protection_level`、Agent 版本。
- **API 契约（实现可后补，规则现在生效）：**  
  - 创建换机申请  
  - 运营审批（通过/拒绝 + 原因）  
  - 领取/下发新 `wrapped_fiscal_key`  
  P0 可用工单/人工审批落地，但不得省略「人审」步骤。
- 操作步骤与系列续用/新建见对接说明 §12；数据库恢复与密钥再授权必须分开。

**首次激活流程：**

1. Agent 生成 `installation_id`、`device_id`。
2. 按 §6.12.1 生成设备钥（TPM 或 SOFTWARE），记录 `key_protection_level`。
3. 向运营方提交设备公钥、门店许可证、`taxpayer_nif`、Agent/Fiscal Core 版本、保护级别。
4. 运营方授权校验通过后生成该设备 `wrapped_fiscal_key`。
5. Agent 取回密文并做本地签名自检；通过后启用 Fiscal Core。

**设备注册信息至少保存：**

- `installation_id`, `store_id`, `taxpayer_nif`, `device_id`, `device_public_key`
- `hardware_fingerprint`, `key_protection_level`
- `agent_version`, `fiscal_core_version`, `signing_key_version`
- `provisioned_at`, `revoked_at`

**换机恢复（步骤见对接说明 §12）：**

- 可导出备份时：新机新设备钥 → 运营吊销旧安装 → 同 `signing_key_version` 重新封装下发。
- 旧机全毁：新机装 Agent → 恢复备份 → **仍须**运营再授权封装（旧密文不能直接用）。
- 校验通过可续用旧系列；无法确认 `last_number`/`last_hash` → 终结后新系列；再下发私钥**不能**修复丢失的系列状态。

**恢复后强制校验：**

- SQLite integrity_check；系列与 `SeriesValidationCode`；每类 `last_number` / `last_hash`；发票数量；Hash 链；最后成功备份时间；未完成打印与 `sync_outbox`。

**安全要求：**

- 安装包/升级包代码签名；启动校验 Fiscal Core 完整性。
- 私钥、设备钥、AT 凭证、Token 不得进日志或诊断导出。
- 设备失陷可撤 `installation_id`；产品钥疑似泄露须具备全局换钥 + Modelo 24 更新预案。

**建议表（运营侧 / 同步元数据）：**

- `signing_keys`：`key_version`, `public_key_pem`, status(ACTIVE/RETIRED/COMPROMISED), …（**私钥明文不出此表到门店**）
- `agent_installations`：`installation_id`, 设备公钥, `key_protection_level`, `signing_key_version`, `provisioned_at`, `revoked_at`, …

- 第二阶段（上线后迭代）
- 营业额报表与统计图表
- 多语言（英文/葡萄牙语翻译内容填充）
- MB Way / Multibanco 收款状态同步
- SAF-T 自动提交 AT
## 7. 非功能要求

- 项目
- 要求
- 离线可用
- 已落本地的销售快照与本地手动开票在断网时仍可签发打印；Hash 链不断；仅状态回传可滞后，恢复后补传；禁止状态轮询
- 响应时间
- 开票接口 P95 < 500ms
- 并发安全
- 同一系列开票必须串行化；使用数据库事务 + 系列级锁，保证序号唯一、Hash 链不断
- 数据安全
- AT 凭证 AES-256 加密存储；API Key 单向 Hash 存储；签名私钥加密存储，禁止明文落盘
- 存档
- 发票活库保存 10 年；备份为全量加密快照（Online Backup）；开票后异步 + 每日日备并轮转备份文件；P0 落点仅本机第二目录；**备份失败阻断新开票**；须恢复演练（见对接说明 §12.7）
- 手动升级
- 安装包必须签名校验、版本可追溯；升级由管理员手动触发，不依赖互联网。
- 浏览器支持
- Chrome / Safari 最新两个版本
- 中文打印
- 通过图片渲染方案解决 ESC/POS 中文乱码；QR码本身走原生指令而非位图
## 8. 技术栈

### 8.0 技术选型状态

**已确定：**

- Agent 主程序：Go
- 本地税务权威数据库：SQLite
- 正式打印：ESC/POS、TCP Socket、Windows 打印队列
- 本地通信：Agent Local HTTP API；默认仅监听 127.0.0.1，可配置门店局域网访问
- 税务签名：Go 标准库 crypto/rsa、crypto/sha1、crypto/x509、encoding/pem、encoding/base64
- SAF-T XML：Go encoding/xml + Windows-1252 转码
- 云端同步：sync_inbox / sync_outbox 异步机制
- 本地管理界面：静态前端构建产物嵌入 Go，由 Agent 同进程提供

**明确不采用：**

- Agent 内运行完整 Next.js 服务端
- Agent 内附带 Node.js Runtime
- 使用 Supabase 作为编号、Hash 链或正式打印队列权威
- 使用 localStorage 保存订单或税务数据

**候选实现库，开发前通过技术验证后固化：**

- HTTP Router：chi 或 Go 标准 net/http
- SQLite Driver：modernc.org/sqlite
- SQL 层：database/sql + sqlc
- 数据库迁移：goose
- Decimal：shopspring/decimal
- 管理界面：React/Vite 静态构建 + go:embed
- QR 位图降级：skip2/go-qrcode
候选库不得在未经 PoC 验证前写成既有实现事实。

### 8.1 SQLite 选型评估

结论：SQLite 对“单餐厅、单主机、本地离线开票、多终端通过 API 访问”的部署模型是合理选型，不构成当前阻塞。

- 数据库文件只能由主机上的单一后端服务访问；收银终端不得直接打开数据库，也不得把 SQLite 文件放到 NAS、共享目录或同步盘。
- 同一系列的签发必须串行化。采用单进程 series queue/application mutex，并在 SQLite 中使用 BEGIN IMMEDIATE 事务完成读取 last_number/last_hash、签名、落库和系列状态更新。
- 启用 WAL、foreign_keys、busy_timeout；写事务保持短小，打印、网络通信、SAF-T 生成和备份不得占用签发事务。
- Next.js 后端不得启动多个独立 worker 共同写库；若运行时可能多进程，核心开票与数据库访问必须抽成唯一的本地后台进程。
- 备份使用 SQLite Online Backup API 或 VACUUM INTO 生成一致性快照，并验证最后 FT/NC 序号、Hash 链和数据库完整性；禁止将普通文件复制作为在线备份的默认方案。
- SQLite 的限制主要是单写者和本机部署，不影响餐厅日常吞吐。只有在多门店共用中心数据库、多个主机同时开票或需要跨店实时汇总时，才应升级为 PostgreSQL。
- Prisma 可继续使用，但系列分配、BEGIN IMMEDIATE、备份和完整性检查允许使用受控的原生 SQL；不得仅依赖 ORM 的普通读后写事务。
数据库升级触发条件：出现多主机并行签发、数据库需要远程共享、单店持续高写入锁竞争，或总部要求跨店强一致实时交易时，再迁移 PostgreSQL；当前不提前引入。

- 打包分发
Go Windows Service / 可执行程序

- Agent 以单进程本地服务交付，管理前端静态文件嵌入二进制
- 手动升级
离线签名安装包

- 由门店管理员在维护时段手动安装；升级前备份，升级后执行数据库迁移及合规自检。
- 打印协议
- ESC/POS，TCP Socket 直连 IP:9100
- node-escpos 库封装指令，无需驱动
- 中文打印
- Go 图像渲染 + 合法可分发字体资源
- 中文文本必要时渲染为位图；QR 优先使用 ESC/POS 原生指令
- 合规模块
- Go internal/fiscal 或独立 Fiscal Core package
- ATCUD / Hash / QR / SAF-T，严格与业务逻辑分离
- AT 接口
- SOAP（Series / ATCUD Webservice）
- 仅用于系列注册、查询、终结、作废；不做实时逐票上报
- QR 码生成
- Go QR 库 + 打印机原生 QR 指令
- 内容由 Fiscal Core 本地生成，打印优先走 ESC/POS 原生指令
- Hash 签名
- Go 标准库 crypto/rsa + crypto/sha1
- RSA-SHA1 / SHA1withRSA；1024-bit RSA；PKCS#1 v1.5；Base64 单行；保存私钥版本；算法与拼接遵循 Despacho n.º 8632/2014；实现须与同环境 OpenSSL 命令字节一致（**不**要求复现附录示例 Base64）
- SAF-T 生成
- Go encoding/xml
- XML 构建，XSD Schema 验证；输出前统一转码为 Windows-1252
- 多语言
- 管理界面静态前端 i18n
- MVP 使用中文，英文/葡语框架预留
- 订单系统集成
- 指定 Windows 收银台电脑上的 Mesa 收银端始终调用本机 Agent Local API。
- Agent签发后自动写入本地打印队列并打印。
- 云端只同步订单基础数据和税务结果，不创建正式税务打印任务。
- Agent API 默认不向局域网开放；管理员可显式启用受控局域网模式。公网开放始终禁止。
## 9. 明确排除

- 手机和平板直接调用 Agent Fiscal API（P0）；已配对的 Windows 收银终端可在门店局域网模式下访问
- 使用浏览器打印对话框完成正式税务发票打印
- 在 Fiscal Core 外（Mesa 云端 / 收银前端）自行计算 ATCUD、Hash、QR，或改写已冻结税务打印 payload
- Supabase 或云端创建正式税务打印任务、分配编号、生成 Hash/ATCUD/QR
- QES 电子签名（不提供 PDF 发票，无需此功能）
- B2G 政府采购发票（FE-AP 平台）
- e-Fatura Webservice 实时逐票上报：RegisterInvoiceRequest / ChangeInvoiceStatusRequest / DeleteInvoiceRequest 不进入 MVP
- 云端部署（数据存本地，不上云）
- 库存/供应商/员工排班管理
- 多币种
- 财务会计功能
- 第三方合规中间件（Saphety / fiskaly），全部自建

### 9.1 已固化架构决策

- 每个门店只部署一个 Agent。
- Agent 安装在指定 Windows 主机（打印助手 claim 那台）。
- 正式签发：该主机，以及已登记的 Windows 开票终端（门店局域网模式）；手机/平板 P0 不签发。
- P0 废除 PWA/手机与 Agent 的直接通信。
- Agent Local API 默认只监听 127.0.0.1；门店局域网模式下可配置监听地址、端口和允许网段。
- 在线与离线均调用同一个 Agent 签发接口。
- Agent SQLite 是税务权威数据库。
- 本地打印队列是正式税务打印权威队列。
- 云端仅负责业务数据和同步副本。
- 首版认证范围包含 FT、FS、FR、NC、ND。
- 默认业务流程使用 FT 和 NC；Mesa API 只开 FT，NC 等在 Agent 本地 UI。  
- **软件认证号：** 认证通过前占位；通过后再写入真号（对接说明 §6.1b）。
- 产品签名私钥采用运营方控制、设备密钥封装、换机重新授权方案。
- Agent 本地后端使用 Go（由现有 print-agent 演进）；不运行完整 Next.js 服务端；**不用 Electron 打包 Agent**。
- 本地管理界面以静态文件嵌入 Go 并由同一进程提供。
- Windows 安装包沿用 / 扩展现有 print-agent 分发（NSIS 等）；分发细节随 print-agent 发布流程，不另开 Electron 方案。

## 10. 开放问题

- 问题
- 状态
- 结论
- 打印机品牌型号
- ✅ 已确认
- UNYKA UK56009，ESC/POS 协议，LAN 接口，80mm 纸宽
- 顾客 NIF 验证方式
- ✅ 已确认
- 本地算法校验，无需调用 AT 接口
- 离线开票 Hash 链同步策略
- ✅ 路线 A 已简化
- 数据全在本地，断网不影响 Hash 链；只影响 Series 注册和月度文件提交
- SAF-T / multidocument 自动提交 AT
- 🔜 第二阶段
- MVP 为手动下载后提交
- AT 认证申请启动时间
- ⏳ 开发完成后启动
- 软件功能完成后提交审核；**认证号 A12：通过前占位 0，通过后再写入真号**（对接说明 §6.1b）
- 主机软件分发方式
- ✅ 已确认
- Go Fiscal Agent（print-agent 演进）Windows 安装包 / 既有发布流程；**不做 Electron**
- 简易发票（FS）金额上限适用档位
- ✅ 产品定为可配置 `fs_amount_threshold`；默认 `100.00`；禁止硬编码
- CIVA 第40条零售€1000 / 服务€100 档位仍建议会计师书面确认后改配置；不阻塞按可配置实现与演示
- 私钥归属模型
- ✅ 官方核验通过
- 依据 Despacho n.º 8632/2014，私钥属软件生产商，非按餐馆分配，v0.8方案正确
- SAF-T编码与版本
- ✅ 官方核验通过
- Windows-1252编码、1.04_01版本均为官方FAQ及Portaria 302/2016现行确认要求
- 打印机说明（UNYKA UK56009）
- 协议：ESC/POS（行业标准，与 Epson 兼容）
- 接口：LAN，局域网 IP 直连，默认端口 9100
- 纸宽：80mm
- 打印速度：230mm/s
- 支持：QR 码原生打印、条码、部分切纸
- 中文方案：node-canvas 渲染位图，加载思源黑体字体，通过 ESC/POS 图片指令打印
- NIF 本地验证算法
- function isValidNIF(nif: string): boolean {
- if (!/^\d{9}$/.test(nif)) return false
- const digits = nif.split('').map(Number)
- if (![1,2,3,5,6,7,8,9].includes(digits[0])) return false
- const sum = digits.slice(0, 8)
- .reduce((acc, d, i) => acc + d * (9 - i), 0)
- const check = 11 - (sum % 11)
- const expected = check >= 10 ? 0 : check
- return digits[8] === expected
- }
## 11. 官方文档核验清单

这些文档不是全部都要从头读。按产品路线 A，只分三层处理。

### 11.1 必读，决定能不能开发

Portaria 363/2010 及修订：认证开票软件根规则，决定用户登录、不可篡改、认证申请、审查要求。

- Despacho n.º 8632/2014：Hash 技术实现、私钥、公钥、签名保存、密钥版本。（本版已核验：私钥归属软件生产商；附录示例钥故意截断，不作黄金向量——见 §2.6）
Series / ATCUD Manual - Aspetos Específicos：系列注册字段、ATCUD 验证码、WSDL、测试/生产接口。

Series / ATCUD Manual - Aspetos Genéricos：SOAP Header、WS-Security、SSL 证书、加密认证流程。

QR Code 技术规格/Portaria 195/2020：QR 字段顺序、格式、打印要求。

- SAF-T(PT)/Ficheiro Multidocumento XSD：月度文件结构和导出字段。（本版已核验：现行1.04_01版本，Windows-1252编码）
【新增】CIVA（增值税法典）第40条（现行版本，经 Decreto-Lei n.º 35/2025 修订）：简易发票适用场景与金额限额，决定FS/FT默认策略的核心法条，需与持牌会计师逐一确认餐饮堂食业态的具体适用档位。

### 11.2 只做边界确认

Decreto-Lei 28/2019：发票处理、保存义务、电子文档总体规则。

e-Fatura Webservice Manual V3.0：MVP 不实现实时逐票上报，但需要确认排除边界，避免把 RegisterInvoice 误放入 MVP。

AT FAQ：Séries/ATCUD：确认同一系列不可重置、不同类型需要独立验证码、年度系列策略。

AT FAQ：e-Fatura/Multidocumento：确认路线 A 使用月度文件通信，而不是实时逐票通信。

### 11.3 可后置

B2G/FE-AP 政府采购发票规则。

QES/PDF 电子签名规则。

SAF-T 自动提交 Webservice。

会计、库存、收款对账扩展规则。

会计 SAF-T（与本产品的发票 SAF-T 不同文件，2027财年起、2028年首次要求提交，不影响本产品MVP范围）。

文档多的原因： 葡萄牙发票合规不是一个单一接口问题，而是"法律资格+软件认证+密码签名+系列注册+QR+月度文件+保存审计"七层叠加。路线 A 已经排除了实时逐票上报，所以不需要实现 e-Fatura RegisterInvoice 这套接口，但不能排除 Series/ATCUD、QR、Hash、SAF-T 这些核心文档。

## 12. 首版认证与 Agent 架构阻塞项

### 12.1 首版认证范围

首版认证范围固定包含 FT、FS、FR、NC、ND。五种类型均必须完成独立系列、Hash、ATCUD、QR、SAF-T、打印、重打、引用关系、权限和测试。

**产品入口（统一口径）：** 同一开票 UI；日常默认 FT/NC；FS/FR/ND 可选可演示；不设高级入口；不降低五种类型的实现与验收要求。

### 12.2 非阻塞但必须通过测试的技术项

1. FT 与 NC 系列序号和 Hash 链的数据库原子性。
2. 同一 external_bill_id 防重复 FT。
3. 同一退款请求防重复 NC。
4. 部分 NC 累计余额不得超过原 FT。
5. NC 必须复制原 FT 冻结税务快照。
6. Windows-1252 校验必须在签名前执行。
7. 打印失败与开票失败严格区分；重打不得重签。
8. 跨月 NC 的引用和 SAF-T 汇总。
9. 备份恢复后最后序号与最后 Hash 一致性。
10. 私钥加密存储、访问权限和版本迁移。
11. 离线 PIN：6 位数字默认、弱 PIN 拒绝、5 次失败锁 15 分钟（或店长解锁）、仅店长在 Agent 本地重置他人 PIN；与 Mesa 密码分离；**PIN 不在 Mesa 设置**。

### 12.3 当前明确不存在的阻塞

1. FT 的 InvoiceType、CreditAmount、TotalCredit 路径已明确。
2. NC 的 InvoiceType、DebitAmount、TotalDebit、References 路径已明确。
3. FT 与 NC 独立系列、独立 ATCUD、独立 Hash 链已明确。
4. 原 FT 保留、NC 独立存在、不得改写历史票据已明确。
5. 正常餐厅金额由系统根据菜品、数量、税率计算；ND 须完整实现并可演示，日常非默认路径。
6. FS、FR、ND 与 FT/NC 一样进入实现与验收；未开具时导出中自然不出现，已开具必须导出。
7. **B1 Hash / 官方样例对齐（需求侧已关闭）：** 算法与拼接已定；不依赖附录完整 PEM，不做官方示例 Base64 比特级对照。后续仅剩实现侧「自钥 + OpenSSL 对拍 PoC」，不阻塞需求定稿。
8. **B2 Series SOAP（需求口径已定）：** 证书三层、`at_env`、状态机与重试见 §5 / §6.5。真 AT `:722` 联调仍依赖官方测试证书与口令加密公钥；无材料时 mock 不阻塞主链路需求。Go SOAP 客户端为实现项。
9. **B3 设备私钥封装（需求口径已定）：** 无 TPM→SOFTWARE+DPAPI；换机人审；产品钥仅运营托管。见 §6.12。实现（TPM/CNG、审批 API、保管库）另排期。

### 12.4 P0 开发放行结论

Agent Local API、单门店单 Agent、SQLite 税务权威、本地打印队列和设备封装私钥方案已确定，可以进入详细设计与 PoC。

开发前仍需完成：FS、FR、ND 的完整业务和 SAF-T 测试矩阵；XSD 1.1 校验器选型。（订单/Agent/云端开票状态权威已定为以 Agent 为准，见对接说明 §6.3。）

### 12.14 已确认架构结论：离线开票与数据库选型

- 取消自动更新：产品不包含后台下载、静默安装或远程强制升级。
- FT/NC 开具本身不需要外部通信；已有激活系列和完整本地状态时，可以长期离线签发和打印。
- 外部通信从签发事务中彻底分离，仅用于系列生命周期、法定数据通信和可选业务同步。
- SQLite 在单主机架构下合理，不是阻塞项；阻塞条件是把数据库共享给多个主机或允许多个后端进程并行写入。
- 当前必须落实的工程约束：唯一数据库写进程、系列串行队列、BEGIN IMMEDIATE、WAL、幂等键、一致性备份与恢复校验。
