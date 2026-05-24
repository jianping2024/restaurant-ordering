# Mesa print agent

Pulls `print_jobs` from Mesa and prints via **LAN TCP :9100** or **Windows USB** (WinSpool RAW, UNYKA UK56009). ESC/POS.

## Commands

### Discover printers (LAN scan)

Scans local IPv4 subnets (from active NICs) for hosts with **TCP 9100** open:

```bash
go run . discover
go run . discover -json
go run . discover -timeout-ms 600 -workers 128
```

Use the printed addresses in `config.json` (see below). Map each **print station** in `configure` / first-run setup. Mapped stations appear on Mesa checkout/bill pages; staff must pick a printer there (default **do not print**).

### Run agent (poll + print)

```bash
go run . -api http://localhost:3000 -code 123456
go run . -api http://localhost:3000 -default-printer 192.168.1.50:9100
```

**First run:** double-click `MesaPrintAgent` (or run without args) — a browser opens the **local pairing page** at `http://127.0.0.1:17890/pair` (no command line). Saves `~/.config/mesa-print-agent/config.json`. Advanced: `-api URL -code 123456` or `MesaPrintAgent pair` to re-open the wizard.

## Config (`config.json`)

```json
{
  "api_base": "http://localhost:3000",
  "agentjwt": "...",
  "device_id": "...",
  "station_printers": {
    "uuid-of-kitchen-station": "192.168.1.51:9100",
    "uuid-of-bar-station": "192.168.1.52:9100"
  },
  "schedule": {
    "timezone": "Europe/Lisbon",
    "weekday": {
      "windows": [
        { "start": "12:00", "end": "15:00" },
        { "start": "19:30", "end": "23:00" }
      ]
    }
  },
  "poll": {
    "idle_interval_sec": 10,
    "busy_interval_sec": 5,
    "after_print_interval_sec": 5,
    "warm_interval_sec": 5,
    "warm_after_activity_sec": 1800,
    "closed_check_sec": 60
  }
}
```

- **`station_ticket`** → `station_printers[payload.print_station_id]` only (no fallback)
- **`order_receipt` / `pre_bill`** → `payload.receipt_printer_id` = `station:{uuid}` when chosen on checkout/bill; if omitted, agent retries up to **20 minutes** and prints when exactly one station is mapped (or when mapping appears)

### Schedule (optional)

When `schedule` is set, the agent **does not call** `pending-jobs` outside the configured windows (saves API traffic). Times are **local wall clock** in `timezone` (IANA name, e.g. `Europe/Lisbon`).

| Key | Meaning |
|-----|---------|
| `weekday` | Default for **every day** (Mon–Sun) unless overridden |
| `saturday`, `sunday` | Optional overrides for those days |
| `monday` … `friday` | Optional per-day override (wins over `weekday`) |

Each window is half-open `[start, end)` using `"HH:MM"` or `"HH:MM:SS"`. Omit `schedule` entirely to poll 24/7 while the process runs.

### Poll (optional, dynamic intervals)

While **inside** schedule:

| Phase | When | Default interval |
|-------|------|------------------|
| **after_print** | After the whole fetched batch is printed | `after_print_interval_sec` (default 5s) before next `pending-jobs` pull |
| **busy** | Failed to claim job (`processing`) | `busy_interval_sec` (default 5s) |
| **warm** | No pending jobs, but printed or saw pending within `warm_after_activity_sec` | 5s |
| **idle** | Open hours, no recent activity | 10s |

While **outside** schedule: sleep `closed_check_sec` (default 60s), no HTTP polls.

Set `poll.fixed_interval_sec` to disable dynamic tiers and use a single interval (legacy behaviour).

See **[dev/config.example.json](./dev/config.example.json)** for a Pirata-style template.

Get station UUIDs from **Dashboard → 餐厅设置 → 出品档口** (`print_stations.id`).

## Windows release (installers)

Version is in **[VERSION](./VERSION)**. Production builds run on **GitHub Actions** (`.github/workflows/print-agent-release.yml`).

### Publish a release

```bash
git tag print-agent-v0.1.0
git push origin print-agent-v0.1.0
```

Assets (stable names for Dashboard `latest/download` links):

| File | Use |
|------|-----|
| `MesaPrintAgent-Setup-amd64.exe` | Inno installer, x64; wizard **checks “run at user logon” by default** (HKCU Run; uninstall removes) |
| `MesaPrintAgent-Setup-arm64.exe` | Inno installer, ARM64 Windows |
| `MesaPrintAgent-windows-amd64.zip` | Portable zip |
| `MesaPrintAgent-windows-arm64.zip` | Portable zip, ARM64 |
| `SHA256SUMS` | Hashes |

### Build on Windows locally

Requires [Go](https://go.dev/) and [Inno Setup 6](https://jrsoftware.org/isinfo.php):

```powershell
cd apps/print-agent
.\scripts\build-release.ps1
```

First run on a POS PC (after pairing code from Dashboard):

```text
MesaPrintAgent.exe -api https://your-mesa.example.com -code 123456
```

Config: `%USERPROFILE%\.config\mesa-print-agent\config.json`

Mesa Dashboard reads `NEXT_PUBLIC_PRINT_AGENT_GITHUB_REPO` (see `.env.local.example`) for download buttons.

## Local Docker dev (optional, isolated)

Fake printers on host ports **19100–19102** — does not start Mesa or touch app code. See **[dev/README.md](./dev/README.md)**.
