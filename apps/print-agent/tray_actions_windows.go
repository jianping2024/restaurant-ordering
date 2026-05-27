//go:build windows

package main

import (
	"os"
	"os/exec"
	"path/filepath"
)

func openAgentLogFolder() error {
	dir := agentDataDir()
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	return exec.Command("explorer", dir).Start()
}

func confirmTrayExit() bool {
	return messageBoxYesNo(
		"Mesa 打印代理",
		"退出后将无法自动打印厨房单和小票。\n\n确定要退出吗？",
	)
}

func showTestPrintResult(err error) {
	if err == nil {
		messageBoxOK("测试打印", "已发送测试条到打印机。\n\n请检查纸上是否出现「打印测试」字样。")
		return
	}
	messageBoxOK("测试打印", err.Error())
}

func trayAboutText(rt *trayRuntime) string {
	text := "Mesa 打印代理 " + Version + "\n\n配置：\n" + defaultConfigPath()
	text += "\n\n日志：\n" + filepath.Join(agentDataDir(), "agent.log")
	if sess, _, done := rt.snapshot(); done && sess != nil && sess.cfg.APIBase != "" {
		text += "\n\nMesa：" + sess.cfg.APIBase
	}
	return text
}
