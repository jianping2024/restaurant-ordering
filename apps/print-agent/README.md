# Mesa print agent

Pulls `print_jobs` from Mesa and prints via **LAN RAW TCP port 9100** (ESC/POS).

## Commands

### Discover printers (LAN scan)

Scans local IPv4 subnets (from active NICs) for hosts with **TCP 9100** open:

```bash
go run . discover
go run . discover -json
go run . discover -timeout-ms 600 -workers 128
```

Use the printed addresses in `config.json` (see below). Map each **print station** UUID to one printer; use `default_printer` for receipts / pre-bill / connection test.

### Run agent (poll + print)

```bash
go run . -api http://localhost:3000 -code 123456
go run . -api http://localhost:3000 -default-printer 192.168.1.50:9100
```

First run with `-code` creates `~/.config/mesa-print-agent/config.json`.

## Config (`config.json`)

```json
{
  "api_base": "http://localhost:3000",
  "agentjwt": "...",
  "device_id": "...",
  "default_printer": "192.168.1.50:9100",
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

- **`station_ticket`** jobs → `station_printers[payload.print_station_id]`
- **`order_receipt` / `pre_bill`** → `default_printer` (legacy field `printer_host` still works)

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

## Local Docker dev (optional, isolated)

Fake printers on host ports **19100–19102** — does not start Mesa or touch app code. See **[dev/README.md](./dev/README.md)**.
