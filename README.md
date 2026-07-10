# SchedulesMCP — Ocean Schedules & Carrier Reliability MCP Server

Compare ocean carrier **sailing schedules, transit times, and on-time reliability** before
you book — 60+ carriers, 72,000+ forward sailings across 5,000+ lanes and 255 ports —
straight from your AI client (Claude, Cursor, Windsurf, or any MCP client).

A sister product to [TrackingMCP](https://trackingmcp.com). Reliability is derived from
observed actual-vs-scheduled arrivals across 4,200+ scored ocean port calls — not carrier promises.

This repo is the **public MCP server** for [schedulesmcp.com](https://schedulesmcp.com). It runs
as a remote Streamable HTTP server; you don't need to host it. Use the public demo key to try
it with no signup.

## Tools

| Tool | What it does |
|---|---|
| `compare_lanes` | Rank carriers on an origin→destination pair by on-time reliability + transit time |
| `carrier_reliability` | On-time % and delay distribution for a carrier, optionally per lane |
| `transit_time` | Observed median / p90 transit time for a carrier on a lane |
| `find_sailings` | Observed and derived upcoming departures on a lane |
| `get_schedules` | Published forward sailings on a lane: carrier, vessel, voyage, ETD/ETA and cut-offs |
| `find_best_sailings` | Best upcoming sailings on a lane, one per carrier, ranked — filter by dates, transit, reliability, open cut-offs |
| `watch_lane` | Watch a lane for schedule alerts — blank sailings, closing cut-offs, slips, reliability drops (paid) |
| `port_reliability` | Congestion and dwell signals for a port |
| `carrier_league` | League table of carriers ranked by overall on-time reliability |
| `port_congestion` | Fused port-congestion signal: level, expected added wait in days, confidence |
| `active_cyclones` | Live tropical cyclones currently active on ocean trade lanes |
| `lane_storm_exposure` | Whether a lane currently passes through an active cyclone's forecast gale field |

## Connect

### Claude Desktop
```json
{
  "mcpServers": {
    "ocean-schedules": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.schedulesmcp.com/mcp",
               "--header", "Authorization: Bearer YOUR_API_KEY"]
    }
  }
}
```

### Cursor / Windsurf / VS Code (native HTTP MCP)
```json
{
  "mcpServers": {
    "ocean-schedules": {
      "url": "https://mcp.schedulesmcp.com/mcp",
      "headers": { "Authorization": "Bearer YOUR_API_KEY" }
    }
  }
}
```

Replace `YOUR_API_KEY` with a key from your dashboard, or use the public demo key
`smcp_demo_public` for synthetic demo data (no signup). Don't add `"type": "streamable-http"`
— Claude Desktop rejects unknown config fields; Cursor/Windsurf infer transport from `url`.

## Endpoint

- Remote: `https://mcp.schedulesmcp.com/mcp`
- Health: `https://mcp.schedulesmcp.com/health`

## License

MIT
