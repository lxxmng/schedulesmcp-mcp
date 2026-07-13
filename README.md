# Sailing Schedule MCP Server

[![npm](https://img.shields.io/npm/v/schedulesmcp-mcp)](https://www.npmjs.com/package/schedulesmcp-mcp)

**Compare ocean sailing schedules, transit times, and carrier on-time reliability across 60+ carriers from Claude, Cursor, or any MCP client.**

SchedulesMCP is an ocean-freight sailing-schedule MCP server that lets an AI assistant find sailings and rank shipping lines before you book. It covers **60+ carriers, 72,000+ forward sailings, and 5,000+ point-to-point lanes across 255 ports**. Carrier reliability is derived from **observed actual-vs-scheduled arrivals** across 4,200+ scored ocean port calls — not carrier promises. It runs as a hosted remote server, so there is nothing to self-host.

Ask your AI: *"Compare Shanghai→Rotterdam carriers by reliability"* or *"What's the median transit time for Maersk on CNSHA→USLAX?"*

## Coverage

- **60+ ocean carriers** ranked head-to-head on any lane (Maersk, MSC, CMA CGM, COSCO, Hapag-Lloyd, ONE, Evergreen, HMM, Yang Ming, ZIM, and more)
- **72,000+ forward sailings** — observed and derived upcoming departures
- **5,000+ point-to-point lanes** across **255 ports** (UN/LOCODE)
- **On-time reliability** scored from 4,200+ observed actual-vs-scheduled port calls, with median / p90 transit-time distributions

Sister product to [TrackingMCP](https://trackingmcp.com) (ocean container tracking) and [LoadingMCP](https://loadingmcp.com) (container load planning).

## Tools

| Tool | What it does |
|------|-------------|
| `compare_lanes` | Rank carriers serving an origin→destination port pair by on-time reliability and transit time. Use this to decide which line to book. |
| `carrier_reliability` | On-time performance and delay distribution for a specific carrier (by SCAC), optionally on a given lane. |
| `transit_time` | Observed transit-time distribution (median / p90, in days) for a carrier on an origin→destination lane. |
| `find_sailings` | Observed and derived upcoming departures on an origin→destination lane, with carrier and frequency. |
| `port_reliability` | Congestion and dwell signals for a port (UN/LOCODE): average wait and vessels at anchor. |

## Quick connect

The server is hosted at `https://mcp.schedulesmcp.com/mcp`. Try it with **zero signup** using the public demo key `smcp_demo_public` (synthetic demo data; try lanes `CNSHA→NLRTM` or `CNSHA→USLAX`).

### Claude Desktop

```json
{
  "mcpServers": {
    "ocean-schedules": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.schedulesmcp.com/mcp",
               "--header", "Authorization: Bearer smcp_demo_public"]
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
      "headers": { "Authorization": "Bearer smcp_demo_public" }
    }
  }
}
```

Replace `smcp_demo_public` with a key from your dashboard for full coverage. Don't add `"type": "streamable-http"` — Claude Desktop rejects unknown config fields; Cursor/Windsurf infer transport from `url`. Registry ID: `io.github.lxxmng/ocean-schedules`.

## Example prompts

- *"Compare Shanghai→Rotterdam carriers by reliability."*
- *"Which line is most on-time from CNSHA to USLAX?"*
- *"What's Maersk's on-time performance on the transpacific?"*
- *"Give me the median and p90 transit time for CMA CGM from Ningbo to Los Angeles."*
- *"Show upcoming sailings from Shanghai to Rotterdam."*
- *"How congested is the port of Rotterdam right now?"*

## Endpoint

- Remote: `https://mcp.schedulesmcp.com/mcp`
- Health: `https://mcp.schedulesmcp.com/health`

## Links

- Product: [schedulesmcp.com](https://schedulesmcp.com)
- Sister product: [trackingmcp.com](https://trackingmcp.com)

## License

MIT
