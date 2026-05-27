package main

import (
	"fmt"
	"strings"
	"sync"
)

// trayLevel drives tray icon color on Windows.
type trayLevel int

const (
	trayLevelGreen trayLevel = iota
	trayLevelYellow
	trayLevelRed
)

// agentStatus is shared between the poll loop and the system tray (Windows).
type agentStatus struct {
	mu      sync.RWMutex
	summary string
	detail  string
}

func (s *agentStatus) set(summary, detail string) {
	s.mu.Lock()
	s.summary = strings.TrimSpace(summary)
	s.detail = strings.TrimSpace(detail)
	s.mu.Unlock()
}

func (s *agentStatus) level() trayLevel {
	s.mu.RLock()
	sum := s.summary
	s.mu.RUnlock()
	return trayLevelForSummary(sum)
}

func trayLevelForSummary(summary string) trayLevel {
	switch summary {
	case "Connection problem", "Print failed", "Schedule error", "Error":
		return trayLevelRed
	case "Outside business hours", "Waiting for receipt printer", "Starting", "Setting up", "Stopped":
		return trayLevelYellow
	default:
		return trayLevelGreen
	}
}

func (s *agentStatus) userSummary() string {
	s.mu.RLock()
	sum := s.summary
	s.mu.RUnlock()
	return trayUserSummary(sum)
}

func (s *agentStatus) userDetail() string {
	s.mu.RLock()
	sum := s.summary
	det := s.detail
	s.mu.RUnlock()
	return trayUserDetail(sum, det)
}

func trayUserSummary(summary string) string {
	switch summary {
	case "Starting":
		return "正在启动…"
	case "Setting up":
		return "正在配置…"
	case "Ready":
		return "运行正常"
	case "Outside business hours":
		return "非营业时间"
	case "Waiting for receipt printer":
		return "等待结账打印机"
	case "Printing":
		return "正在打印"
	case "Printing queue":
		return "打印队列处理中"
	case "Connection problem":
		return "无法连接 Mesa"
	case "Print failed":
		return "打印失败"
	case "Schedule error":
		return "营业时间异常"
	case "Stopped":
		return "已停止"
	case "Error":
		return "出错"
	default:
		if summary == "" {
			return "正在启动…"
		}
		return summary
	}
}

func trayUserDetail(summary, detail string) string {
	switch summary {
	case "Ready":
		switch detail {
		case "Watching for new tickets":
			return "正在监听新单"
		case "Idle — waiting for orders":
			return "空闲，等待订单"
		case "Polling":
			return "轮询中"
		case "Last print OK":
			return "上一单打印成功"
		default:
			if detail != "" {
				return detail
			}
			return "已连接 Mesa"
		}
	case "Outside business hours":
		if detail == "Not polling until next window" {
			return "暂停拉单，等待下一营业时段"
		}
		if detail == "Not polling" {
			return "暂停拉单"
		}
	case "Waiting for receipt printer":
		return "请在「打印机设置」中映射档口（最多等待 20 分钟）"
	case "Printing queue":
		if strings.Contains(detail, "job") {
			return "队列中有待打印任务"
		}
	case "Connection problem", "Print failed", "Schedule error", "Error":
		return detail
	case "Setting up":
		return "请在浏览器中完成配对或打印机映射"
	}
	return detail
}

func (s *agentStatus) tooltip(version string) string {
	sum := s.userSummary()
	det := s.userDetail()
	tip := fmt.Sprintf("Mesa 打印代理 %s\n%s", version, sum)
	if det != "" {
		tip += "\n" + det
	}
	return tip
}

func (s *agentStatus) menuStatusLine() string {
	line := "状态：" + s.userSummary()
	if det := s.userDetail(); det != "" && len(det) < 80 {
		line += " — " + det
	}
	return line
}
