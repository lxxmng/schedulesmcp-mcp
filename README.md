# SchedulesMCP — Ocean Schedules & Carrier Reliability MCP Server

Compare ocean carrier **sailing schedules, transit times, and on-time reliability** before
you book — straight from your AI client (Claude, Cursor, Windsurf, or any MCP client).

A sister product to [TrackingMCP](https://trackingmcp.com). Reliability is derived from
observed actual-vs-scheduled arrivals across tracked ocean port calls — not carrier promises.

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
| `port_reliability` | Congestion and dwell signals for a port |

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
