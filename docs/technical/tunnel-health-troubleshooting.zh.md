# Tunnel health 异常排查（Mode B / On-prem，cloudflared → 本机 origin）

> 目标：从 `tunnel-health.sh` 的异常汇总定位到“为什么本机 `:80` 在某段时间没监听/没就绪”，从而解释 `cloudflared` 的 `edge_flap`。

## 适用场景

- `cloudflared`/Tunnel 在店机出现短暂抖动：`Unregistered tunnel connection`、`Connection terminated`、或本地探测失败。
- `tunnel-health.sh` 输出里出现 `edge_flap` 或 `dial tcp 127.0.0.1:80 connect: connection refused`。

## 你要先记住的日志来源

`deploy/on-prem/scripts/tunnel-health.sh` 会使用：

- `$MESA_HOME/logs/tunnel/events.jsonl`：累计异常事件（JSONL）
- `$MESA_HOME/logs/tunnel/latest.txt`：本次汇总输出
- `journalctl -u cloudflared`：抓取匹配的异常行（如 `Lost connection / Connection terminated / failed to serve ...`）

默认（未设置 `MESA_HOME`）也会优先落到 `/opt/mesa/logs/tunnel/`。

## 入口命令（先看昨天到现在出了什么）

```bash
sudo /opt/mesa/current/deploy/on-prem/scripts/tunnel-health.sh since 1d
# 需要更长回看：since 2d / since 7d
```

同时建议本机再跑一次健康探测确认“现在是否正常”：

```bash
sudo /opt/mesa/current/deploy/on-prem/scripts/tunnel-health.sh check
```

## 排查流程（按这个顺序做）

### 1) 先确认异常窗口和失败类型

重点看 `tunnel-health.sh since Nd` 的两块输出：

- `events.jsonl` 统计：是否只有 `edge_flap`（或还有 `public_down_local_up`、`local_health_fail` 等）
- `journalctl -u cloudflared`：是否出现 `dial tcp 127.0.0.1:80 ... connection refused`

若出现 `connection refused`，99% 指向：**本机 `:80` 对外源（origin）在那段时间没监听/没就绪**。

### 2) 查谁在监听 80（决定要查哪个容器/进程）

在店机上执行：

```bash
sudo ss -ltnp '( sport = :80 )'
```

常见两类：

- `docker-proxy ... host-port 80 -container-ip X -container-port 80`  
  说明 80 是通过 Docker 映射到某个容器的（你要查容器里的反代/edge）。
- `nginx/caddy/...`  
  说明宿主机直接在监听（你要查对应 web 进程/反代）。

若是 docker-proxy，建议用 docker-proxy PID 定位转发到哪个容器：

```bash
sudo ps -fp <docker-proxy_pid> -o pid,ppid,cmd
```

### 3) 如果是 docker-proxy：查容器是不是“在异常窗口才起来”

拿到容器名后（例如 `/mesa-on-prem-edge-1`），检查容器启动时间：

```bash
sudo docker inspect -f '{{.Name}} startedAt={{.State.StartedAt}} restartCount={{.RestartCount}}' /mesa-on-prem-edge-1
```

再看容器内 edge（Caddy/反代）的日志，必须覆盖异常窗口：

```bash
sudo docker logs \
  --since '<异常窗口起始时间UTC>' \
  --until '<异常窗口结束时间UTC>' \
  /mesa-on-prem-edge-1
```

例如你今天的案例，日志里出现 `serving initial configuration` 和 `server running ... http_port=80`，就能解释为什么那段时间本地 `:80` 会被 refused。

### 4) 区分“重启/网络断线”还是“部署/compose 重建”

当你看到容器启动时间与异常窗口高度重合时，接下来只需要判断触发源：

1) 主机是否 reboot（最常见）：
```bash
last reboot
```

2) 是否有部署/重建痕迹（compose/up/recreate/upgrade）：
```bash
sudo journalctl --since '<异常前5分钟>' --until '<异常后5分钟>' --no-pager | rg -i \
  'compose|recreate|up\b|restart|upgrade|deploy|mesa|edge|caddy'
```

**判断规则：**

- 只有 reboot/shutdown 证据 → 视为“重启窗口导致 origin 未就绪”
- 有 compose/up/recreate/upgrade 证据 → 视为“部署窗口导致 origin 未就绪”
- 两者都有 → 通常是“重启触发了部署/自动拉栈”，根因仍是 origin 的就绪时序

## 收尾判定

- 现在 `tunnel-health.sh check` 正常，且 `since Nd` 里只有一次 `edge_flap`：  
  直接认为已恢复，短期无需改 tunnel。
- 如果异常持续反复（多次 `edge_flap`、或 `connection refused` 持续出现）：  
  需要进一步检查 edge 服务/容器内反代的启动失败、依赖端口、或容器重启策略。

