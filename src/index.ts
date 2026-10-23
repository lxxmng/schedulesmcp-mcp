/**
 * SchedulesMCP MCP Server — ocean sailing-schedule & carrier-reliability for AI clients.
 *
 * Remote Streamable HTTP server at https://mcp.schedulesmcp.com/mcp
 * Generate your API key at https://app.schedulesmcp.com/settings → API Keys.
 *
 * Same connection pattern as TrackingMCP (mcp-remote stdio bridge for Claude Desktop,
 * native HTTP for Cursor/Windsurf). Do NOT add "type": "streamable-http" — Claude Desktop
 * rejects unknown config fields.
 *
 * Auth: a public demo key (smcp_demo_public) returns synthetic data with no signup. A real
 * key is validated by the API, which also enforces the 'schedules' product entitlement.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { z } from 'zod'

const API_BASE = process.env.API_BASE_URL ?? 'https://schedulesmcp-api.fly.dev/v1'
const PORT = Number.parseInt(process.env.MCP_PORT ?? '3002')
const DEMO_KEY = process.env.MCP_DEMO_API_KEY ?? 'smcp_demo_public'

// ── Synthetic demo data — realistic-looking, zero real org data ───────────────
const DEMO_LANES: Record<
  string,
  Array<{
    carrier_code: string
    carrier_name: string
    on_time_pct: number
    transit_p50_days: number
    avg_delay_hours: number
    frequency_days: number
  }>
> = {
  'CNSHA|NLRTM': [
    {
      carrier_code: 'MAEU',
      carrier_name: 'Maersk',
      on_time_pct: 78,
      transit_p50_days: 31,
      avg_delay_hours: 22,
      frequency_days: 7,
    },
    {
      carrier_code: 'MSCU',
      carrier_name: 'MSC',
      on_time_pct: 71,
      transit_p50_days: 33,
      avg_delay_hours: 38,
      frequency_days: 7,
    },
    {
      carrier_code: 'CMAU',
      carrier_name: 'CMA CGM',
      on_time_pct: 69,
      transit_p50_days: 32,
      avg_delay_hours: 41,
      frequency_days: 7,
    },
    {
      carrier_code: 'COSU',
      carrier_name: 'COSCO',
      on_time_pct: 64,
      transit_p50_days: 34,
      avg_delay_hours: 55,
      frequency_days: 7,
    },
  ],
  'CNSHA|USLAX': [
    {
      carrier_code: 'ONEY',
      carrier_name: 'ONE',
      on_time_pct: 81,
      transit_p50_days: 16,
      avg_delay_hours: 14,
      frequency_days: 7,
    },
    {
      carrier_code: 'MAEU',
      carrier_name: 'Maersk',
      on_time_pct: 76,
      transit_p50_days: 15,
      avg_delay_hours: 19,
      frequency_days: 7,
    },
    {
      carrier_code: 'MSCU',
      carrier_name: 'MSC',
      on_time_pct: 70,
      transit_p50_days: 17,
      avg_delay_hours: 33,
      frequency_days: 7,
    },
  ],
}

function lookupDemo(origin: string, destination: string) {
  return DEMO_LANES[`${origin.toUpperCase()}|${destination.toUpperCase()}`] ?? []
}

async function apiGet(path: string, apiKey: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  return res.json()
}

function buildServer(apiKey: string) {
  const isDemo = apiKey === DEMO_KEY
  const server = new McpServer({ name: 'ocean-schedules', version: '0.1.0' })

  server.tool(
    'compare_lanes',
    'Compare ocean carriers serving an origin→destination port pair, ranked by on-time reliability and transit time. Use this to decide which line to book.',
    {
      origin: z.string().describe('Origin port UN/LOCODE, e.g. CNSHA'),
      destination: z.string().describe('Destination port UN/LOCODE, e.g. NLRTM'),
    },
    async ({ origin, destination }) => {
      if (isDemo) {
        const carriers = lookupDemo(origin, destination)
        const note =
          carriers.length === 0
            ? 'No demo data for this lane. Try CNSHA→NLRTM or CNSHA→USLAX, or sign up for full coverage at schedulesmcp.com.'
            : 'Demo data (synthetic). Reliability is derived from observed actual-vs-scheduled arrivals.'
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ origin, destination, carriers, note }, null, 2),
            },
          ],
        }
      }
      const data = await apiGet(
        `/reliability/lanes?origin=${origin}&destination=${destination}`,
        apiKey
      )
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'carrier_reliability',
    'On-time performance and delay distribution for a specific carrier (by SCAC).',
    { carrier_code: z.string().describe('Carrier SCAC, e.g. MAEU') },
    async ({ carrier_code }) => {
      if (isDemo) {
        const lanes = Object.entries(DEMO_LANES).flatMap(([lane, cs]) =>
          cs
            .filter((c) => c.carrier_code === carrier_code.toUpperCase())
            .map((c) => ({ lane, ...c }))
        )
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { carrier_code, lanes, note: 'Demo data (synthetic).' },
                null,
                2
              ),
            },
          ],
        }
      }
      const data = await apiGet(`/reliability/carrier/${carrier_code}`, apiKey)
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  return server
}

// ── HTTP transport (Streamable HTTP) ──────────────────────────────────────────
const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url)
  if (url.pathname === '/health') return new Response('ok', { status: 200 })
  if (url.pathname !== '/mcp') return new Response('Not found', { status: 404 })

  const authHeader = req.headers.get('Authorization')
  const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : DEMO_KEY

  const server = buildServer(apiKey)
  const transport = new WebStandardStreamableHTTPServerTransport()
  await server.connect(transport)
  return transport.handleRequest(req)
}

Bun.serve({ port: PORT, fetch: handler })
console.log(`schedulesmcp-mcp listening on :${PORT}`)
