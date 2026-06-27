# Print Agent Release Notes

Each release section starts with `## X.Y.Z`. The release workflow reads the matching section and appends standard install instructions.

## 0.3.27

**多代理打印隔离（需 MesaGo Web 与 Print Agent 同时升级）**

- **按设备过滤待打印任务**：`pending-jobs` 只返回本机 `routing_snapshot` 已订阅档口的任务，避免多台 Agent 抢同一厨房单。
- **档口映射冲突校验**：保存映射时，若某档口已被另一台 Agent 占用，云端返回 **409**，本机配置**不会**保存。
- **先同步云端、再写本地**：配置向导改为校验 → 同步 MesaGo → 成功后再写入本机 config。
- **认领二次校验**：不属于本机档口的任务无法 claim（403）。
- **配置界面**：冲突时展示具体档口与占用设备名称。
- **Dashboard**：打印助手设备列表显示已映射档口名称。

**升级注意**

- 升级后请在各 Agent 上**重新保存一次档口映射**，云端 snapshot 才会生效。
- 若之前有多台 Agent 映射重叠，保存时会提示冲突，需手动拆分到不同设备。
