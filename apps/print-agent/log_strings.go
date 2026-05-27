package main

func init() {
	for k, v := range logStringsZH() {
		uiBundles["zh"][k] = v
	}
	for k, v := range logStringsEN() {
		uiBundles["en"][k] = v
	}
	for k, v := range logStringsPT() {
		uiBundles["pt"][k] = v
	}
}

func logStringsZH() map[string]string {
	return map[string]string{
		"log_agent_start":           "打印服务启动，版本 %s",
		"log_agent_startup":         "已连接：%s | 已映射档口：%d",
		"log_schedule_line":         "  营业时间 %s",
		"log_schedule_tz":           "  时区：%s",
		"log_schedule_disabled":     "  营业时间：未启用（代理运行期间持续轮询）",
		"log_poll_intervals":        "  轮询间隔（秒）：打印后=%d，活跃=%d，活跃窗口=%d，空闲=%d，繁忙=%d，歇业检查=%d",
		"log_runtime_config_fail":   "无法拉取云端营业时间/轮询设置，使用本机配置",
		"log_schedule_error":        "营业时间判断异常",
		"log_outside_schedule_sleep": "非营业时间，暂停拉单约 %s",
		"log_outside_schedule":      "非营业时间，暂停拉单",
		"log_schedule_resume":       "进入营业时间，恢复拉单",
		"log_pending_jobs_error":    "无法连接 Mesa 拉取打印任务",
		"log_skipped_expired":       "已跳过超过 20 分钟的旧任务（单号 %s）",
		"log_receipt_deferred":      "结账小票等待打印机映射（最多约 20 分钟）",
		"log_route_error":           "任务路由失败",
		"log_claim_job_error":       "无法认领打印任务",
		"log_print_failed":          "打印失败（打印机 %s）",
		"log_mark_done_error":       "无法将任务标为已完成",
		"log_printed_ok":            "已打印：%s → %s",
		"log_pairing_required":      "需要配对：请在浏览器中完成配对向导（托盘图标应可见）",
		"log_setup_wizard":          "未配置打印机，正在打开映射向导",
		"log_no_station_mapping":    "尚未映射出品档口，请在「打印机设置」中配置",
		"log_saved_config":          "配置已保存：%s",
		"log_wizard_open":           "请在浏览器中打开：%s",
		"log_routing_sync_fail":     "档口映射同步到 Mesa 失败",
		"log_routing_sync_http":     "档口映射同步失败（HTTP %d）",
		"log_routing_sync_ok":       "档口映射已同步到 Mesa（%d 个）",
		"log_station_maps_saved":    "已保存 %d 个档口打印机映射",
		"log_test_print_station":    "试打：档口 %s",
		"log_pair_ok":               "配对成功",
		"log_browser_open_fail":     "无法自动打开浏览器",
	}
}

func logStringsEN() map[string]string {
	return map[string]string{
		"log_agent_start":           "Print service started, version %s",
		"log_agent_startup":         "Connected: %s | mapped stations: %d",
		"log_schedule_line":         "  Hours %s",
		"log_schedule_tz":           "  Timezone: %s",
		"log_schedule_disabled":     "  Schedule: off (polling 24/7 while running)",
		"log_poll_intervals":        "  Poll intervals (sec): after_print=%d warm=%d warm_window=%d idle=%d busy=%d closed_check=%d",
		"log_runtime_config_fail":   "Could not fetch cloud schedule/poll; using local settings",
		"log_schedule_error":        "Schedule check error",
		"log_outside_schedule_sleep": "Outside business hours, pausing ~%s",
		"log_outside_schedule":      "Outside business hours, not polling",
		"log_schedule_resume":       "Business hours started, resuming polls",
		"log_pending_jobs_error":    "Cannot reach Mesa to fetch print jobs",
		"log_skipped_expired":       "Skipped job older than 20 minutes (id %s)",
		"log_receipt_deferred":      "Receipt waiting for printer mapping (up to ~20 min)",
		"log_route_error":           "Job routing failed",
		"log_claim_job_error":       "Could not claim print job",
		"log_print_failed":          "Print failed (printer %s)",
		"log_mark_done_error":       "Could not mark job as done",
		"log_printed_ok":            "Printed: %s → %s",
		"log_pairing_required":      "Pairing required — complete the browser wizard",
		"log_setup_wizard":          "No printer mapped — opening setup wizard",
		"log_no_station_mapping":    "No station printers mapped — open Printer settings",
		"log_saved_config":          "Config saved: %s",
		"log_wizard_open":           "Open in browser: %s",
		"log_routing_sync_fail":     "Failed to sync station mapping to Mesa",
		"log_routing_sync_http":     "Station mapping sync failed (HTTP %d)",
		"log_routing_sync_ok":       "Station mapping synced to Mesa (%d)",
		"log_station_maps_saved":    "Saved %d station printer mapping(s)",
		"log_test_print_station":    "Test print: station %s",
		"log_pair_ok":               "Pairing saved",
		"log_browser_open_fail":     "Could not open browser automatically",
	}
}

func logStringsPT() map[string]string {
	return map[string]string{
		"log_agent_start":           "Serviço de impressão iniciado, versão %s",
		"log_agent_startup":         "Ligado: %s | estações mapeadas: %d",
		"log_schedule_line":         "  Horário %s",
		"log_schedule_tz":           "  Fuso: %s",
		"log_schedule_disabled":     "  Horário: desativado (consulta 24/7 enquanto corre)",
		"log_poll_intervals":        "  Intervalos (s): após_impressão=%d ativo=%d janela=%d inativo=%d ocupado=%d fechado=%d",
		"log_runtime_config_fail":   "Não foi possível obter horário/poll da nuvem; usa definições locais",
		"log_schedule_error":        "Erro ao verificar horário",
		"log_outside_schedule_sleep": "Fora do horário, pausa ~%s",
		"log_outside_schedule":      "Fora do horário, sem consultas",
		"log_schedule_resume":       "Horário de funcionamento — a retomar consultas",
		"log_pending_jobs_error":    "Sem ligação ao Mesa para obter trabalhos",
		"log_skipped_expired":       "Ignorado trabalho com mais de 20 min (id %s)",
		"log_receipt_deferred":      "Conta à espera de impressora mapeada (até ~20 min)",
		"log_route_error":           "Falha ao encaminhar trabalho",
		"log_claim_job_error":       "Não foi possível reservar trabalho",
		"log_print_failed":          "Falha de impressão (impressora %s)",
		"log_mark_done_error":       "Não foi possível marcar como concluído",
		"log_printed_ok":            "Impresso: %s → %s",
		"log_pairing_required":      "Emparelhamento necessário — conclua no browser",
		"log_setup_wizard":          "Sem impressora — a abrir assistente",
		"log_no_station_mapping":    "Sem estações mapeadas — abra Definições de impressora",
		"log_saved_config":          "Configuração guardada: %s",
		"log_wizard_open":           "Abra no browser: %s",
		"log_routing_sync_fail":     "Falha ao sincronizar mapeamento com Mesa",
		"log_routing_sync_http":     "Sincronização falhou (HTTP %d)",
		"log_routing_sync_ok":       "Mapeamento sincronizado (%d)",
		"log_station_maps_saved":    "Guardadas %d estações",
		"log_test_print_station":    "Teste: estação %s",
		"log_pair_ok":               "Emparelhamento guardado",
		"log_browser_open_fail":     "Não foi possível abrir o browser",
	}
}
