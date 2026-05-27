//go:build windows

package main

import (
	"os"
	"path/filepath"
)

func notifyLocalWizardURL(title, url string) {
	messageBoxOK(title,
		"请在浏览器中完成设置：\n\n"+url+
			"\n\n若浏览器未自动打开，请复制上述地址到 Chrome/Edge。\n托盘图标在任务栏右下角「^」隐藏图标里（Mesa Print）。")
}

func maybeNotifyTrayReady() {
	if cfg, err := loadConfig(defaultConfigPath()); err != nil || cfg == nil || cfg.AgentJWT == "" {
		return
	}
	marker := filepath.Join(agentDataDir(), ".tray_ready_tip_shown")
	if _, err := os.Stat(marker); err == nil {
		return
	}
	_ = os.MkdirAll(agentDataDir(), 0o700)
	_ = os.WriteFile(marker, []byte("1"), 0o644)
	messageBoxOK("Mesa Print Agent",
		"打印代理已在后台运行。\n\n"+
			"请在任务栏右下角点击 ^，找到「Mesa Print」托盘图标。\n"+
			"右键可打开打印机设置或退出。\n\n"+
			"日志文件：\n"+filepath.Join(agentDataDir(), "agent.log"))
}
