# 业务场景测试报告

编码后功能改动的场景文档落在此目录。

## 命名

`YYYY-MM-DD-<功能名称>.md`

例：`2026-10-10-staff-by-item-collect.md`

## 内容标准

完整要求见 always-on 规则：

[`.cursor/rules/business-scenario-testing.mdc`](../../.cursor/rules/business-scenario-testing.mdc)

与 localhost UAT（`mesa-local-uat` + 浏览器）叠加：本目录管**场景粒度与可复现报告**，不替代 API/UI 断言。

## 最低结构

1. 本次修改
2. 核心业务规则
3. 详细测试场景（前置 / 操作 / 预期 / 数据验证 / 异常恢复）
4. 实际测试结果（【已验证】/【未验证】等）
5. 风险与待确认
