# On-prem 安全基线（新机安装 / 升级验收）

> **唯一权威**（网络暴露、客人写路径、密码策略、登录限流 IP）。  
> 打包/初装/升级操作步骤仍以 [`on-prem-pack-install-upgrade.zh.md`](./on-prem-pack-install-upgrade.zh.md) 为准；本文只定**安全终态**与验收，避免多处互相打架。  
> 落地日期参考：2026-08-15（Pirata / Mode B 加固批次）。

## 0. 一句话

| 面 | 终态 |
|----|------|
| 公网 | 只经 Cloudflare Tunnel → edge **`:80`**（或店内配置的 HTTPS 入口）；**不要**把 `:3000` / `:8000` / 库口甩到公网 |
| 店内 / Tailscale | 正式入口 **`:80`**；库口可远程连（需强密码）；**Kong `:8000`/`:8443` 仅本机** |
| 客人写库 | **禁止** anon 直插 PostgREST；一律走 Next API + `service_role` |
| 员工密码 | 唯一 `account-password-policy`；弱密码登录强制改密 |
| 限流 IP | 唯一 `clientIpFromRequest`（信 CF / 反代最右跳，不信客户端伪造的最左 `X-Forwarded-For`） |

---

## 1. 宿主机端口（Mode B）

Compose 真相：`deploy/on-prem/vendor/supabase-docker/docker-compose.yml`（Kong）+ `deploy/on-prem/compose.yaml`（edge / web）。

| 宿主机口 | 绑定 | 用途 | 新机 / 远程怎么用 |
|----------|------|------|-------------------|
| **80**（`MESA_EDGE_PORT`） | 全网卡 | Caddy：Web + 同域反代 Kong | **正式入口**；LAN / Tailscale / Tunnel 目标 |
| **3000**（`MESA_WEB_PORT`） | 全网卡 | Web 调试 | 可选；**禁止**写入 Print Agent / 正式配置 |
| **8000 / 8443** | **`127.0.0.1` only** | Kong 调试 | 仅 SSH 上店机 `curl 127.0.0.1:8000`；**LAN/Tailscale 不应直连** |
| **54329 / 6543** | 全网卡 | Postgres / pooler | 远程看库（Tailscale/LAN）；靠强 `POSTGRES_PASSWORD`，勿对公网做端口映射 |

容器内服务端仍用 **`http://kong:8000`**（Docker 网络），与宿主机 publish 无关。

**禁止（新机与存量）：**

- 路由器把 `3000` / `8000` / `54329` / `6543` 端口转发到公网  
- Print Agent / 正式书签使用 `http://…:3000` 或 `http://…:8000`  
- 假设「开着端口 = 无密钥也能进」——库口尤其依赖密码强度

**Tailscale 远程（约定）：**

- 看店 / 验活：`http://<tailscale-ip>/`（**:80**）或公网 Tunnel 域名  
- 看库：`<tailscale-ip>:54329`（或你们文档化的 pooler 口）  
- **不要**依赖 Tailscale `:8000`（升级含本基线后应连不上）

---

## 2. 应用层：客人写路径与 RLS

| 能力 | 唯一写路径 | 禁止再出现 |
|------|------------|------------|
| 客人下单 | `POST …/orders/append`（及既有 staff append）+ `service_role` | 策略 `orders_public_insert`（anon 直插 `orders`） |
| 菜品反馈 | `GET/POST …/customer/dish-feedback` + `customer-dish-feedback.ts` | `dish_feedback_public_all` / `feedback_sessions_public_all` |

Schema 备注：`docs/ai-schema.md`（与上表一致；改策略时同步改 schema 文，勿另写第三份）。

**升级注意：** Web 与对应 migration **同包上线**；先升 Web 再迁、或先迁后旧 Web，都会导致反馈/下单异常。

---

## 3. 账号密码

| 项 | 唯一写法 |
|----|----------|
| 策略 | `apps/web/src/lib/auth/account-password-policy.ts` |
| 规则 | ≥8 字符、字母+数字、禁常见弱口令、不得等于登录名；**不要求**特殊字符 |
| 接线 | 员工创建/重置/自愿改密、setup 认领店主密码、弱密码员工登录强制 `must_change_password` |

新机认领：店主密码必须过同一策略。员工首密与重置亦同。

---

## 4. 登录 / 滥用限流用的客户端 IP

| 项 | 唯一写法 |
|----|----------|
| 函数 | `apps/web/src/lib/request-client-ip.ts` → `clientIpFromRequest` |
| 信任顺序 | `CF-Connecting-IP` → **最右** `X-Forwarded-For`（反代追加）→ `X-Real-IP` → `unknown` |
| 禁止 | 优先信最左 `X-Forwarded-For`（可被客户端伪造） |

登录限流仍同时按**账号**计桶；IP 只作辅助。调用方：登录、下单 append、claim、反馈等——全部 import 上述函数，勿平行实现。

---

## 5. 新机安装检查清单（装完必勾）

在 [`on-prem-pack-install-upgrade.zh.md`](./on-prem-pack-install-upgrade.zh.md) §2 流程完成后，额外确认：

1. [ ] 正式入口仅 **`:80` / Tunnel HTTPS**；Print Agent 填局域网 edge origin（无 `:3000` / `:8000`）  
2. [ ] `ss`/`docker ps`：Kong 宿主机映射为 `127.0.0.1:8000->8000`（及 8443）；**不是** `0.0.0.0:8000`  
3. [ ] 本机：`curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8000/` 有响应；同网其它机器访问 `http://<店内IP>:8000/` **应失败**  
4. [ ] 公网（若有 Tunnel）：域名 health 200；公网扫 `<公网IP>:3000|:8000|:54329` **应不通**  
5. [ ] `/setup` 认领密码符合 §3；员工创建同策略  
6. [ ] 客人点餐走菜单 → append；**不要**给 anon `service_role` 或恢复 `orders_public_insert`  
7. [ ] 密钥：`.env` 中 `JWT_SECRET` / `POSTGRES_PASSWORD` / `PRINT_AGENT_JWT_SECRET` / `CRON_SECRET` 等为长随机（只查长度，勿把明文写进工单）

可选加强（非本基线必选）：Cloudflare Access 挡 `/dashboard`；Tailscale ACL 限制谁能连库口。

---

## 6. 存量店升级后抽查

升级含本基线的包并重启栈后：

```bash
# 在店机
docker ps --format '{{.Names}}\t{{.Ports}}' | grep -E 'kong|edge|web|pooler'
curl -sS -o /dev/null -w 'edge:%{http_code}\n' http://127.0.0.1/api/health/live
curl -sS -o /dev/null -w 'loopback_kong:%{http_code}\n' http://127.0.0.1:8000/ || true
```

从**另一台** Tailscale/LAN 机器：`:80` 应通，`:8000` 应不通；`:54329` 按你们是否保留远程看库而定（本基线默认保留）。

---

## 7. 文档索引（防重复）

| 主题 | 只读这里 |
|------|----------|
| 本基线（安全终态 + 新机勾选） | **本文** |
| 打包 / 初装 / 升级命令 | `on-prem-pack-install-upgrade.zh.md` |
| 端口表（与 Print Agent 填法） | 本文 §1；pack 文 §2.2 **只摘要并链回本文** |
| RLS / 表策略备注 | `docs/ai-schema.md` |
| 密码产品说明 | `docs/staff-accounts-plan.md`（细则以 `account-password-policy.ts` 为准） |
| 授权 / `/setup` | `docs/on-prem-handoff.zh.md` · ADR-004 |

改端口或客人写路径时：**先改代码/compose，再改本文与 ai-schema**；不要在 backlog / 会话纪要里另写一套「当前真相」。
