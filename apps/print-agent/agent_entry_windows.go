//go:build windows

package main

import (
	"context"
	"log"
	"time"

	"github.com/getlantern/systray"
)

func runAgent(args []string) {
	sess, showConsole, err := initAgentSession(args)
	if err != nil {
		log.Fatal(err)
	}
	if showConsole {
		runPollLoop(context.Background(), sess, nil)
		return
	}
	runAgentTray(sess)
}

func runAgentTray(sess *agentSession) {
	hideConsoleWindow()

	ctx, cancel := context.WithCancel(context.Background())
	status := &agentStatus{}

	go runPollLoop(ctx, sess, status)

	systray.Run(func() {
		onTrayReady(sess, status, cancel)
	}, func() {
		cancel()
	})
}

func onTrayReady(sess *agentSession, status *agentStatus, cancel context.CancelFunc) {
	if len(trayIconICO) > 0 {
		systray.SetIcon(trayIconICO)
	}
	systray.SetTitle("Mesa Print")
	systray.SetTooltip(status.tooltip(Version))

	mSettings := systray.AddMenuItem("Printer settings…", "Open configure wizard (pair + map stations)")
	mShowConsole := systray.AddMenuItem("Show debug console", "Show log window for troubleshooting")
	systray.AddSeparator()
	mAbout := systray.AddMenuItem("About", "Version and config path")
	mQuit := systray.AddMenuItem("Exit", "Stop Mesa Print Agent")

	go func() {
		tick := time.NewTicker(2 * time.Second)
		defer tick.Stop()
		for range tick.C {
			systray.SetTooltip(status.tooltip(Version))
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
			case <-mAbout.ClickedCh:
				text := "Mesa Print Agent " + Version + "\n\nConfig:\n" + defaultConfigPath()
				if sess.cfg.APIBase != "" {
					text += "\n\nMesa: " + sess.cfg.APIBase
				}
				messageBoxOK("Mesa Print Agent", text)
			case <-mQuit.ClickedCh:
				cancel()
				systray.Quit()
				return
			}
		}
	}()
}
