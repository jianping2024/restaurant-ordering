Mesa Print Agent (Windows) — v0.2+
===================================

Thermal print agent for Mesa (UNYKA UK56009). One installer for LAN and USB.

Installer autostart (Setup .exe only)
-------------------------------------
The installer wizard includes "Start Mesa Print Agent when the current user logs on"
(checked by default). Uncheck if you do not want it to run at Windows sign-in.
This adds a shortcut in your Windows Startup folder (removed on uninstall).
Portable zip does not configure autostart.

First-time setup (no command line)
----------------------------------
1. Install UNYKA UK56009 driver if using USB (Start menu -> UNYKA driver (web), or https://unykach.com/).
2. Keep Mesa Print Agent running after install (finish page "Launch now", or sign in if autostart was enabled).
3. Return to Mesa Dashboard -> Print assistant.
4. Click "Generate pairing code", then "Open settings on this PC".
5. Browser: if not paired, use the pairing page (linked from settings); on the printer
   settings page click Scan printers, map each print station, Save. Test print is optional.
   (First agent start may also open pairing on port 17890 automatically.)
6. The agent stays in the Windows system tray (near the clock, click ^ if hidden).
   Icon color: green = OK, yellow = outside hours or setup, red = error.
   Right-click: printer settings (includes test print), open log folder, exit.
   No need to keep a black console window open.

Debug (show console logs): MesaPrintAgent.exe -console

Re-open later: MesaPrintAgent.exe configure   (printer mapping; /pair on same server when tray is open)
   Or: tray icon -> Printer settings…
Re-pair only: MesaPrintAgent.exe pair   (or pairing link inside settings)
Printer only (legacy first-run): MesaPrintAgent.exe setup

Version check
-------------
Installed folder contains VERSION.txt (same as MesaPrintAgent.exe -version).
Default: C:\Program Files\Mesa Print Agent\

Config file
-----------
%USERPROFILE%\.config\mesa-print-agent\config.json

Examples:
  "default_printer": "tcp:192.168.1.50:9100"
  "default_printer": "winspool:UK56009"
  "station_printers": {
    "<kitchen-station-uuid>": "tcp:192.168.1.51:9100",
    "<bar-station-uuid>": "winspool:Bar"
  }

Discover printers: MesaPrintAgent.exe discover

SmartScreen
-----------
Unsigned build: More info -> Run anyway, or Unblock in file Properties.

Support
-------
https://github.com/jianping2024/restaurant-ordering
