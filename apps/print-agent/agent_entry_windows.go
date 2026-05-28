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
	ctx      context.Context
	sess     *agentSession
	initErr  error
	initDone bool
	status   *agentStatus
	cancel   context.CancelFunc

	configureMu     sync.Mutex
	configureActive bool
	configureURL    string
}

func (rt *trayRuntime) snapshot() (*agentSession, error, bool) {
	rt.mu.Lock()
	defer rt.mu.Unlock()
	return rt.sess, rt.initErr, rt.initDone
}

func (rt *trayRuntime) uiLocale() string {
	// Configure/setup write config.json; do not use stale sess.cfg from agent startup.
	return loadTrayUILocale()
}

func (rt *trayRuntime) syncConfigFromDisk() {
	sess, _, done := rt.snapshot()
	if !done || sess == nil {
		return
	}
	reloadAgentSessionConfig(sess)
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

func runAgentTrayFirst(args []string) {
	initWindowsAgentLog()
	hideConsoleWindow()

	ctx, cancel := context.WithCancel(context.Background())
	rt := &trayRuntime{
		ctx:    ctx,
		status: &agentStatus{},
		cancel: cancel,
	}
	onConfigureWizardReady = rt.rememberConfigureWizardURL
	defer func() { onConfigureWizardReady = nil }()
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
			loc := loadTrayUILocale()
			messageBoxOK(uiT(loc, "about_title"), err.Error())
			requestTrayExit(rt)
			return
		}
		rt.status.set("Ready", "Connected to Mesa")
		startTrayLocalHTTP(rt)
		go runPollLoop(ctx, sess, rt.status)
	}()

	runtime.LockOSThread()
	systray.Run(func() {
		onTrayReady(rt)
	}, func() {
		stopTrayAgentWork(rt)
		exitTrayAgent()
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

	loc := rt.uiLocale()
	systray.SetTitle(uiT(loc, "tray_title"))
	systray.SetTooltip(rt.status.tooltip(Version, loc))
	go maybeNotifyTrayReady()
	go func() {
		time.Sleep(3 * time.Second)
		maybeNotifyCredentialRenewal()
	}()

	mStatus := systray.AddMenuItem(rt.status.menuStatusLine(loc), "")
	mStatus.Disable()
	systray.AddSeparator()
	mSettings := systray.AddMenuItem(uiT(loc, "menu_settings"), uiT(loc, "menu_settings_tip"))
	mOpenLog := systray.AddMenuItem(uiT(loc, "menu_open_log"), uiT(loc, "menu_open_log_tip"))
	mOpenLogDir := systray.AddMenuItem(uiT(loc, "menu_open_log_dir"), uiT(loc, "menu_open_log_dir_tip"))
	systray.AddSeparator()
	mShowConsole := systray.AddMenuItem(uiT(loc, "menu_console"), uiT(loc, "menu_console_tip"))
	systray.AddSeparator()
	mAbout := systray.AddMenuItem(uiT(loc, "menu_about"), uiT(loc, "menu_about_tip"))
	mQuit := systray.AddMenuItem(uiT(loc, "menu_quit"), uiT(loc, "menu_quit_tip"))

	go func() {
		tick := time.NewTicker(2 * time.Second)
		defer tick.Stop()
		var lastLoc string
		for range tick.C {
			rt.syncConfigFromDisk()
			loc = rt.uiLocale()
			if loc != lastLoc {
				lastLoc = loc
				systray.SetTitle(uiT(loc, "tray_title"))
				applyTrayMenuLabels(mStatus, mSettings, mOpenLog, mOpenLogDir, mShowConsole, mAbout, mQuit, loc)
			}
			mStatus.SetTitle(rt.status.menuStatusLine(loc))
			tip := rt.status.tooltip(Version, loc)
			if cfg, err := loadConfig(defaultConfigPath()); err == nil && cfg != nil {
				if suffix := cfg.credentialStatusSuffix(loc, time.Now()); suffix != "" {
					tip += "\n" + suffix
				}
			}
			systray.SetTooltip(tip)
			applyTrayIcon()
		}
	}()

	go func() {
		for {
			select {
			case <-mSettings.ClickedCh:
				rt.startTrayConfigureWizard("")
			case <-mOpenLog.ClickedCh:
				if err := openAgentLog(); err != nil {
					log.Println("tray:", err)
					loc := rt.uiLocale()
					messageBoxOK(uiT(loc, "about_title"), fmt.Sprintf(uiT(loc, "open_log_fail"), err.Error()))
				}
			case <-mOpenLogDir.ClickedCh:
				if err := openAgentLogFolder(); err != nil {
					log.Println("tray:", err)
					loc := rt.uiLocale()
					messageBoxOK(uiT(loc, "about_title"), fmt.Sprintf(uiT(loc, "open_log_dir_fail"), err.Error()))
				}
			case <-mShowConsole.ClickedCh:
				shown := toggleConsoleWindow()
				_, err, done := rt.snapshot()
				if shown && done && err != nil {
					log.Println(err)
				}
			case <-mAbout.ClickedCh:
				messageBoxOK(uiT(rt.uiLocale(), "about_title"), trayAboutText(rt, rt.uiLocale()))
			case <-mQuit.ClickedCh:
				loc := rt.uiLocale()
				if !confirmTrayExit(loc) {
					continue
				}
				requestTrayExit(rt)
				return
			}
		}
	}()
}
