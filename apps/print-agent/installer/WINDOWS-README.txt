Mesa Print Agent (Windows) — v0.2+
===================================

Thermal print agent for Mesa (UNYKA UK56009). One installer for LAN and USB.

Installer autostart (Setup .exe only)
-------------------------------------
The installer wizard includes "Start Mesa Print Agent when the current user logs on"
(checked by default). Uncheck if you do not want it to run at Windows sign-in.
This writes HKCU\Software\Microsoft\Windows\CurrentVersion\Run (removed on uninstall).
Portable zip does not configure autostart.

First-time setup (no command line)
----------------------------------
1. Install UNYKA UK56009 driver if using USB (Unyka website).
2. Mesa Dashboard -> Settings -> Print assistant -> Generate pairing code.
3. Double-click MesaPrintAgent.exe (or sign in to Windows if autostart was enabled).
4. Browser: pairing page — enter Mesa URL (https://your-site.vercel.app) and 6-digit code.
5. Browser: Cashier printer (pre-bill/split/final) + kitchen station maps (station tickets).
6. Keep the black agent window open for automatic printing.

Re-open setup later: MesaPrintAgent.exe configure   (re-pair + printers, recommended)
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
