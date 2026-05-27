//go:build windows

package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"runtime"
	"sync"
	"time"

	"github.com/getlantern/systray"
)

type trayRuntime struct {
	mu       sync.Mutex
	sess     *agentSession
	initErr  error
	initDone bool
	status   *agentStatus
	cancel   context.CancelFunc
}

func (rt *trayRuntime) snapshot() (*agentSession, error, bool) {
	rt.mu.Lock()
	defer rt.mu.Unlock()
	return rt.sess, rt.initErr, rt.initDone
}

func runAgent(args []string) {
	if agentArgsWantConsole(args) {
		sess, _, err := initAgentSession(context.Background(), args)
		if err != nil {
			showConsoleWindow()
			log.Fatal(err)
		}
		runPollLoop(context.Background(), sess, nil)
		return
	}

	runAgentTrayFirst(args)
}

// runAgentTrayFirst shows the tray icon immediately, then runs pairing/setup/poll in the background.
func runAgentTrayFirst(args []string) {
	initWindowsAgentLog()
	hideConsoleWindow()

	ctx, cancel := context.WithCancel(context.Background())
	rt := &trayRuntime{
		status: &agentStatus{},
		cancel: cancel,
	}
	rt.status.set("Starting", "Mesa Print Agent")

	go func() {
		rt.status.set("Setting up", "Complete pairing or printer mapping in the browser if it opened")
		sess, _, err := initAgentSession(ctx, args)
		rt.mu.Lock()
		rt.sess = sess
		rt.initErr = err
		rt.initDone = true
		rt.mu.Unlock()
		if err != nil {
			if errors.Is(err, context.Canceled) {
				log.Println("tray: init cancelled")
				return
			}
			rt.status.set("Error", err.Error())
			messageBoxOK("Mesa 打印代理", err.Error())
			stopTrayAgent(rt)
			return
		}
		rt.status.set("Ready", "Connected to Mesa")
		go runPollLoop(ctx, sess, rt.status)
	}()

	runtime.LockOSThread()
	systray.Run(func() {
		onTrayReady(rt)
	}, func() {
		if rt.cancel != nil {
			rt.cancel()
		}
		shutdownAllWizardServers()
	})
	exitTrayAgent()
}

func onTrayReady(rt *trayRuntime) {
	log.Println("tray: ready")
	var lastIcon trayLevel = -1
	applyTrayIcon := func() {
		lvl := rt.status.level()
		if lvl == lastIcon {
			return
		}
		lastIcon = lvl
		if icon := trayIconForLevel(lvl); len(icon) > 0 {
			systray.SetIcon(icon)
		}
	}
	applyTrayIcon()

	systray.SetTitle("Mesa 打印")
	systray.SetTooltip(rt.status.tooltip(Version))
	go maybeNotifyTrayReady()

	mStatus := systray.AddMenuItem(rt.status.menuStatusLine(), "")
	mStatus.Disable()
	systray.AddSeparator()
	mSettings := systray.AddMenuItem("打印机设置…", "配对与档口映射")
	mTestPrint := systray.AddMenuItem("测试打印", "向第一台已映射打印机发送测试条")
	mTestPrint.Disable()
	mOpenLog := systray.AddMenuItem("打开日志文件夹", "查看 agent.log")
	systray.AddSeparator()
	mShowConsole := systray.AddMenuItem("显示调试控制台", "排障用日志窗口")
	systray.AddSeparator()
	mAbout := systray.AddMenuItem("关于", "版本与配置路径")
	mQuit := systray.AddMenuItem("退出", "停止 Mesa 打印代理")

	go func() {
		tick := time.NewTicker(2 * time.Second)
		defer tick.Stop()
		for range tick.C {
			mStatus.SetTitle(rt.status.menuStatusLine())
			systray.SetTooltip(rt.status.tooltip(Version))
			applyTrayIcon()
			sess, _, done := rt.snapshot()
			if done && sess != nil && sess.cfg.hasPrinterRouting() {
				mTestPrint.Enable()
			} else {
				mTestPrint.Disable()
			}
		}
	}()

	go func() {
		for {
			select {
			case <-mSettings.ClickedCh:
				if err := spawnAgentSubcommand("configure"); err != nil {
					log.Println("tray:", err)
				}
			case <-mTestPrint.ClickedCh:
				go func() {
					sess, _, done := rt.snapshot()
					if !done || sess == nil {
						showTestPrintResult(fmt.Errorf("代理尚未就绪，请稍候再试"))
						return
					}
					showTestPrintResult(runTrayTestPrint(sess.cfg))
				}()
			case <-mOpenLog.ClickedCh:
				if err := openAgentLogFolder(); err != nil {
					log.Println("tray:", err)
					messageBoxOK("Mesa 打印代理", "无法打开日志文件夹："+err.Error())
				}
			case <-mShowConsole.ClickedCh:
				showConsoleWindow()
				_, err, done := rt.snapshot()
				if done && err != nil {
					log.Println(err)
				}
			case <-mAbout.ClickedCh:
				messageBoxOK("Mesa 打印代理", trayAboutText(rt))
			case <-mQuit.ClickedCh:
				if !confirmTrayExit() {
					continue
				}
				stopTrayAgent(rt)
				// systray.Quit from a menu goroutine may not unwind Run on Windows; force exit if stuck.
				go func() {
					time.Sleep(800 * time.Millisecond)
					exitTrayAgent()
				}()
				return
			}
		}
	}()
}
