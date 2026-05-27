//go:build windows

package main

import (
	"context"
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
		sess, _, err := initAgentSession(args)
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
// Evidence: systray.Run was previously called only after initAgentSession returned, so users saw
// Task Manager processes (~4MB) with no tray while the local pairing HTTP wizard blocked (up to 20m).
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
		sess, _, err := initAgentSession(args)
		rt.mu.Lock()
		rt.sess = sess
		rt.initErr = err
		rt.initDone = true
		rt.mu.Unlock()
		if err != nil {
			rt.status.set("Error", err.Error())
			messageBoxOK("Mesa Print Agent", err.Error())
			systray.Quit()
			return
		}
		rt.status.set("Ready", "Connected to Mesa")
		go runPollLoop(ctx, sess, rt.status)
	}()

	runtime.LockOSThread()
	systray.Run(func() {
		onTrayReady(rt)
	}, func() {
		cancel()
	})
}


func onTrayReady(rt *trayRuntime) {
	log.Println("tray: ready")
	if len(trayIconICO) > 0 {
		systray.SetIcon(trayIconICO)
	}
	systray.SetTitle("Mesa Print")
	systray.SetTooltip(rt.status.tooltip(Version))
	go maybeNotifyTrayReady()

	mSettings := systray.AddMenuItem("Printer settings…", "Open configure wizard (pair + map stations)")
	mShowConsole := systray.AddMenuItem("Show debug console", "Show log window for troubleshooting")
	systray.AddSeparator()
	mAbout := systray.AddMenuItem("About", "Version and config path")
	mQuit := systray.AddMenuItem("Exit", "Stop Mesa Print Agent")

	go func() {
		tick := time.NewTicker(2 * time.Second)
		defer tick.Stop()
		for range tick.C {
			systray.SetTooltip(rt.status.tooltip(Version))
		}
	}()

	go func() {
		for {
			select {
			case <-mSettings.ClickedCh:
				if err := spawnAgentSubcommand("configure"); err != nil {
					log.Println("tray:", err)
				}
			case <-mShowConsole.ClickedCh:
				showConsoleWindow()
				_, err, done := rt.snapshot()
				if done && err != nil {
					log.Println(err)
				}
			case <-mAbout.ClickedCh:
				text := "Mesa Print Agent " + Version + "\n\nConfig:\n" + defaultConfigPath()
				if sess, _, done := rt.snapshot(); done && sess != nil && sess.cfg.APIBase != "" {
					text += "\n\nMesa: " + sess.cfg.APIBase
				}
				messageBoxOK("Mesa Print Agent", text)
			case <-mQuit.ClickedCh:
				if rt.cancel != nil {
					rt.cancel()
				}
				systray.Quit()
				return
			}
		}
	}()
}
