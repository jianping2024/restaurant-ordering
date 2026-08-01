-- =============================================================================
-- Mesa on-prem：清理「日常经营」数据（保留门店配置）
-- =============================================================================
--
-- 用途
--   客户本地 Mode B 环境在联调 / 试营业后，清掉开台、点餐、结账、打印队列等
--   经营流水，把楼面恢复成「空闲可开台」；不删菜单、桌位、员工、License、打印配对。
--
-- 怎么跑
--   请用配套脚本（带确认门闩，禁止误跑）：
--     sudo -E MESA_HOME=/opt/mesa bash deploy/on-prem/scripts/purge-operational-data.sh --i-understand-wipe-ops-data
--   或在已导出 POSTGRES_* 的研发机：
--     bash deploy/on-prem/scripts/purge-operational-data.sh --i-understand-wipe-ops-data
--
-- 本文件只应被该脚本通过 psql 执行；不要在生产库随意手工跑。
--
-- -----------------------------------------------------------------------------
-- 【会清空】下面这些表（TRUNCATE … RESTART IDENTITY，同一语句内一起截断，满足表间 FK）
-- -----------------------------------------------------------------------------
--
-- 楼面餐次 / 点餐 / 结账
--   table_sessions              开台餐次（open / billing / closed）
--   table_session_events        转台等会话事件
--   orders                      订单（含 items jsonb）
--   order_append_idempotency    加菜幂等键
--   bill_splits                 分单 / 呼叫结账 / 已付拆分
--   session_collected_payments  结账过程中已收金额
--
-- 打印队列（任务，不是设备）
--   print_jobs                  出品联 / 预结单 / 账单打印任务
--
-- 同行组（运行时标记，不是后台「桌位分组」）
--   table_party_group_members   同行组成员
--   table_party_groups          同行组本身
--
-- 反馈 / 审计 / 经营统计
--   dish_feedback               菜品赞踩
--   feedback_sessions           反馈弹窗会话
--   abnormal_operations         异常经营记录（折扣 / 减菜 / 未付关台等）
--   operation_logs              操作审计日志
--   analytics_daily_restaurant_stats  按营业日汇总的营收人数等
--
-- 打印助手临时凭证
--   print_agent_support_tokens  远程支持一次性 token（设备配对保留）
--
-- -----------------------------------------------------------------------------
-- 【不会动】配置与身份（脚本跑完后仍在）
-- -----------------------------------------------------------------------------
--   restaurants / restaurant_installations     店档 + License / 安装认领
--   restaurant_staff_accounts / restaurant_roles / auth.users
--   restaurant_tables / restaurant_table_groups / restaurant_table_group_members
--   menu_categories / menu_items
--   buffets / buffet_time_slots / buffet_price_rules / buffet_calendar_overrides
--   print_stations
--   print_agent_devices / print_agent_pairings   已配对打印助手与配对码记录
--   platform_admin_*                            平台运维账号（若本机有）
--
-- 注意
--   - 不可恢复。正式店请先跑 backup-local.sh。
--   - 清空后看板应无用餐中桌；员工账号与菜单不变。
--   - 若 print-agent 仍连着，旧 job 已没了，代理端队列以服务端为准。
-- =============================================================================

BEGIN;

TRUNCATE TABLE
  -- 反馈（引用 orders / sessions）
  public.dish_feedback,
  public.feedback_sessions,
  -- 结账收付款与分单
  public.session_collected_payments,
  public.bill_splits,
  -- 加菜幂等 + 订单
  public.order_append_idempotency,
  public.orders,
  -- 打印任务
  public.print_jobs,
  -- 异常 / 审计（abnormal 可引用 operation_logs / orders / sessions）
  public.abnormal_operations,
  public.operation_logs,
  -- 转台事件 + 餐次
  public.table_session_events,
  public.table_sessions,
  -- 同行组运行时
  public.table_party_group_members,
  public.table_party_groups,
  -- 经营日汇总
  public.analytics_daily_restaurant_stats,
  -- 打印助手临时支持 token
  public.print_agent_support_tokens
RESTART IDENTITY;

COMMIT;
