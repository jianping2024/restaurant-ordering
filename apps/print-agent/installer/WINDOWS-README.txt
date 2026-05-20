Mesa Print Agent (Windows)
==========================

Thermal print agent for Mesa restaurant ordering. Pulls print jobs from your
Mesa server and sends ESC/POS to LAN printers (TCP port 9100).

First-time pairing
------------------
1. In Mesa Dashboard -> Settings -> Print assistant, click "Generate pairing code".
2. Run MesaPrintAgent.exe (from Start menu or this folder).
3. When prompted, pass your Mesa site URL and the 6-digit code, for example:

   MesaPrintAgent.exe -api https://your-mesa-domain.com -code 123456

   Config is saved to: %USERPROFILE%\.config\mesa-print-agent\config.json

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
