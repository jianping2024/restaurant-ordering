Mesa Print Agent (Windows)
==========================

Thermal print agent for Mesa restaurant ordering. Pulls print jobs from your
Mesa server and sends ESC/POS to LAN printers (TCP port 9100).

First-time pairing (no command line)
-----------------------------------
1. In Mesa Dashboard -> Settings -> Print assistant, click "Generate pairing code".
2. On this PC, double-click MesaPrintAgent.exe (installer or portable zip).
3. Your browser opens a local pairing page (http://127.0.0.1:17890/pair).
4. Confirm Mesa URL is https://your-mesa-site.vercel.app (root only, no /dashboard path).
5. Enter the 6-digit code from the dashboard, click Connect.

   From the dashboard you can also click "Open local pairing page" after generating a code.

   Config is saved to: %USERPROFILE%\.config\mesa-print-agent\config.json

   To pair again later: MesaPrintAgent.exe pair

Printers
--------
- Run: MesaPrintAgent.exe discover
- Edit config.json: default_printer and station_printers (station UUIDs from
  Dashboard -> Print stations).

SmartScreen / "Unknown publisher"
---------------------------------
This build is not Authenticode-signed. If Windows blocks the installer:
- Click "More info" -> "Run anyway", or
- Right-click the .exe -> Properties -> Unblock -> OK.

Support
-------
https://github.com/jianping2024/restaurant-ordering
