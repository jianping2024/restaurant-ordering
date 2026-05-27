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
2. Mesa Dashboard -> Print assistant -> Generate pairing code (6 digits).
3. Run Mesa Print Agent (installer finish page "Launch now", or sign in if autostart was enabled).
4. Browser: complete pairing (code may be pre-filled from Dashboard) and map each print station.
5. Test print: confirm paper in the settings page (section 3) or tray -> Printer settings.
6. The agent stays in the Windows system tray (near the clock, click ^ if hidden).
   Icon color: green = OK, yellow = outside hours or setup, red = error.
   Right-click: printer settings (includes test print), open log folder, exit.
   No need to keep a black console window open.

Debug (show console logs): MesaPrintAgent.exe -console

Re-open setup later: MesaPrintAgent.exe configure   (re-pair + printers, recommended)
   Or: tray icon -> Printer settings…
Printer only: MesaPrintAgent.exe setup
Pair only: MesaPrintAgent.exe pair

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
