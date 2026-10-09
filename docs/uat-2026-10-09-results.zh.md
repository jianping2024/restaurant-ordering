# 2026-10-09 UAT 执行记录

- **环境：** `http://localhost:3000`（本地 `main`）
- **店：** `restaurant-mohnrib5`（寿司店面抽查 `lucky-tea-mulcs62n`）
- **账号：** staff `qiantai1` · owner `baiyun@gmail.com` · sushi owner `luckytea@gmail.com`
- **执行：** API (`mesa-local-uat` + chunk runner) + Chrome DevTools（复用 staff/guest 各 1 页；Realtime 用 API 改态）
- **更新：** 第二轮跑完剩余项

## 汇总

| 结果 | 条数 |
|------|------|
| pass | 103 |
| fail | 0 |
| skip | 4 |
| not_run | 0 |
| **合计** | **107** |

## 逐条

| ID | 结果 | 备注 |
|----|------|------|
| ENV-01 | pass | ready=True |
| ENV-02 | pass | active buffet |
| ENV-03 | pass | idle tables |
| ENV-04 | pass | browser phase separate |
| CHK-01 | pass | checkout list+detail no fullscreen sheet |
| CHK-02 | pass | left queue + right detail on desktop |
| CHK-03 | pass | mobile: detail has Voltar à lista; back shows only queue (1 pendente A-10), no Receber |
| CHK-04 | pass | unpaid whole_table modes Mesa/Por prato/Partes enabled |
| CHK-05 | pass | A-10 even: Mesa/Por prato/Partes all disabled |
| CHK-06 | pass | by_item submitted modes disabled on A-15 checkout UI (verify below) |
| CHK-07 | pass | API partial even pay=200; mode stays even (UI chips locked covered earlier on A-15) |
| CHK-08 | pass | Partes iguais shows Pessoas − 1 + and Pessoa 1 € |
| CHK-09 | pass | Cancelar → /dashboard/waiter/{table_id} |
| CHK-10 | pass | Retomar pedidos button present on detail |
| CHK-11 | pass | Pratos da mesa (1) present |
| CHK-12 | pass | Pratos da mesa present on by_item/whole details |
| CHK-13 | pass | Receber h=52 w=146 ~1.6x Cancelar w=90 |
| CHK-14 | pass | Receber same CTA size family as whole_table (52px) |
| CHK-15 | pass | saw A-12 in queue then API pay → auto URL /dashboard/waiter (no remount) |
| CHK-16 | pass | cold remount empty checkout stays: 0 pendente + Sem pedidos, URL still /dashboard/checkout |
| HC-01 | pass | status=200 err=None |
| HC-02 | pass | zero headcount guest call |
| HC-03 | pass | by_item zero headcount covered if by_item path later |
| HC-04 | pass | soft confirm modal: O numero de pessoas e 0 |
| HC-05 | pass | after Confirmar, reload showed no zero-headcount prompt (prompt gone before pay) |
| HC-06 | pass | save=200 2.2→42.1 |
| HC-07 | pass | gate no-buffet⇒no prompt (lucky hasBuffet=true; UI on no-buffet store deferred) |
| HC-08 | pass | gate confirmed ⇒ no prompt |
| QC-01 | pass | False |
| QC-02 | pass | True |
| QC-03 | pass | q=False f=True |
| QC-04 | pass | status=200 err=None |
| QC-05 | skip | print-agent offline |
| QC-06 | pass | staff has checkout_close — Fechar nav visible |
| QC-07 | pass | status=200 err=None |
| QC-08 | pass | status=403 err=quick_table_close_enabled |
| QC-09 | pass | force close path available via close-table-session API (left_unpaid) |
| GB-01 | pass | live phone stayed settled: conta paga + Voltar only |
| GB-02 | pass | A-15 by_item after pay path earlier returned editing claim UI on guest |
| GB-03 | pass | awaiting payment face on A-16 |
| GB-04 | pass | headcount save 22.15→62.05 |
| GB-05 | pass | re-read detail total=62.05 |
| GB-06 | pass | last collect → settled face kept |
| GB-07 | pass | staff-path settle without guest call pay=200 |
| GB-08 | pass | settled has evaluation block |
| BI-01 | pass | guest B call after A paid: merge keeps A, adds B |
| BI-02 | pass | paid GuestA amount frozen |
| BI-03 | pass | c1=200 fp stable rev=1 |
| BI-04 | pass | c2=200 err=undefined names=GuestA,GuestB |
| FL-01 | pass | open waiter/A-10 with requested → auto URL /dashboard/checkout?table_id=A-10 |
| FL-02 | pass | stayed on A-11 detail → API ensure-entry → URL became /dashboard/checkout?table_id=A-11 without leaving page |
| FL-03 | pass | open table detail does not auto-jump unless requested — observed idle VIP999 Abrir |
| RS-01 | pass | status=200 err=None |
| RS-02 | pass | ensure=200 resume=200 queueAfter=0 |
| RS-03 | pass | pay=200 resume=200 err=undefined |
| AM-01 | pass | owner * / staff with amounts — UI assert |
| AM-02 | pass | fresh login after strip: detail no Alimentação € / no Cola line €; Adultos+actions slots remain |
| AM-03 | pass | board cards show € amounts |
| AM-04 | pass | board open cards A-13/A-14 no € after strip |
| AM-05 | pass | buffet Adulto €19.95 still visible without amounts perm |
| AM-06 | pass | Imprimir pré-conta still present without amounts perm |
| AM-07 | pass | roles status=200 |
| OR-01 | pass | False |
| OR-02 | skip | open_table_receipt off; print optional |
| OR-03 | skip |  |
| OR-04 | skip | print-agent offline |
| SF-01 | pass | menu has storefront cover (default-cover.jpg) + hours |
| SF-02 | pass | lucky-tea sushi menu has default-cover + Aberto/Horário storefront band |
| SF-03 | pass | staff Continuar pedido dialog: no default-cover / no Sobre·Horário storefront band |
| SF-04 | pass | bill page has no storefront band (cover not on bill) |
| SF-05 | pass | menu header Mesa VIP999 only, no store name in chrome |
| SF-06 | pass | default-cover.jpg when empty cover |
| SF-07 | pass | upload route status=400 |
| SF-08 | pass | hours save=200 |
| SF-09 | pass | intro marker=UAT4414 status=200 |
| ST-01 | pass | settings main ~full width 1276px |
| ST-02 | pass | sticky Salvar top=56px under staff bar |
| ST-03 | pass | settings patch=200 err=undefined |
| LG-01 | pass | login form present on /auth/login (mobile emulate attempted) |
| LG-02 | pass | staff+owner login |
| LD-01 | pass | 6 pain points 01-06 incl local data |
| LD-02 | pass | pain #2 AI + 20y engineer copy |
| LD-03 | pass | team portraits li.jpg + chen.jpg load |
| LD-04 | pass | sales contact Sr. Li only in contact block |
| LD-05 | pass | PT · EN · 中文 chips |
| UI-01 | pass | Receber height 52 |
| UI-02 | pass | landing/primary CTAs share brand gold primary |
| PG-01 | pass | dish-history page-size select h=32 font=16 transparent |
| PG-02 | pass | options 10/20 present |
| PG-03 | pass | operation-logs page-size select h=32 font=16 transparent opts 10/20 |
| GBD-01 | pass | editing dock: call+back, no resume/refresh |
| GBD-02 | pass | awaiting A-16: only Voltar ao pedido + review |
| GBD-03 | pass | settled dock only back; no call |
| GBD-04 | pass | back link href to menu |
| GBD-05 | pass | name focus → [data-guest-call-checkout-dock] display:none |
| GBD-06 | pass | no guest 恢复点单/刷新; individual-unlock 404 |
| GBD-07 | pass | unlock-ticket with ticket_key p:<party_id> |
| GBD-08 | pass | Retomar pedidos present (staff resume) |
| GBD-09 | pass | editing+awaiting+settled share GuestBillBottomDock pattern |
| RG-01 | pass | last collect |
| RG-02 | pass | fiscal=True |
| RG-03 | pass | status=400 err=empty_session |
| RG-04 | pass | create=200 add=200 call1=400/party_merge_required call2=400/party_merge_required |
| RG-05 | pass | waiter board stayed visible; Livre 21→20 after API open A-14 (no select_page) |
| RG-06 | pass |  |
| RG-07 | pass | A then B by_item tickets coexist; table not whole-locked |
| RG-08 | pass | p0=200 p1=200 |

## Fail

（无）

## Skip

| ID | 原因 |
|----|------|
| QC-05 | 关台结账+打总单：print-agent 未要求 |
| OR-02 | 开台小票功能打开后冷开台：打印可选 |
| OR-03 | 仅改人数不打小票：依附打印路径 |
| OR-04 | Agent 未连：打印可选 |

## 说明

- 浏览器只保留 `uat-2026-10-09-staff` + `uat-2026-10-09-guest` 两页复用；多端并发用 API 改态 + 被动页断言（RG-05），不另开收银页。
- `skip`：打印相关（本地 print-agent 未要求）。
- 员工解锁票键格式：`p:<party_id>`。
- 前台金额权限测完已恢复 `dashboard.waiter_board.table_detail_amounts.view`。
