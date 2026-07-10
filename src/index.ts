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
// The weather surface is public (free upstream data) and mounted OUTSIDE /v1 — strip the version.
const WEATHER_BASE = API_BASE.replace(/\/v1\/?$/, '')
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

async function apiPost(path: string, apiKey: string, body: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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
    'On-time performance and delay distribution for a specific carrier (by SCAC), optionally on a given lane.',
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

  server.tool(
    'transit_time',
    'Observed transit-time distribution (median / p90, in days) for a carrier on an origin→destination lane.',
    {
      origin: z.string().describe('Origin port UN/LOCODE'),
      destination: z.string().describe('Destination port UN/LOCODE'),
      carrier_code: z.string().optional().describe('Optional carrier SCAC to filter'),
    },
    async ({ origin, destination, carrier_code }) => {
      const carriers = lookupDemo(origin, destination)
        .filter((c) => !carrier_code || c.carrier_code === carrier_code.toUpperCase())
        .map((c) => ({ carrier_code: c.carrier_code, transit_p50_days: c.transit_p50_days }))
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                origin,
                destination,
                carriers,
                note: isDemo ? 'Demo data (synthetic).' : 'Live transit endpoint lands in Phase 2.',
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  server.tool(
    'find_sailings',
    'Observed and derived upcoming departures on an origin→destination lane, with carrier and frequency.',
    {
      origin: z.string().describe('Origin port UN/LOCODE'),
      destination: z.string().describe('Destination port UN/LOCODE'),
    },
    async ({ origin, destination }) => {
      const sailings = lookupDemo(origin, destination).map((c) => ({
        carrier_code: c.carrier_code,
        carrier_name: c.carrier_name,
        frequency_days: c.frequency_days,
        transit_p50_days: c.transit_p50_days,
      }))
      const note = isDemo
        ? 'Demo data (synthetic). Observed cadence from tracked sailings. For published forward departures with vessel/voyage/cutoffs, use get_schedules.'
        : 'Observed cadence from tracking exhaust. For published forward departures with vessel/voyage/cutoffs, use get_schedules.'
      return {
        content: [
          { type: 'text', text: JSON.stringify({ origin, destination, sailings, note }, null, 2) },
        ],
      }
    }
  )

  server.tool(
    'get_schedules',
    'Published forward sailing schedules on an origin→destination lane: carrier, vessel, voyage, ETD/ETA and cut-offs, soonest first. Sourced from carrier connectors (and aggregator coverage). Use this to find concrete upcoming departures to book.',
    {
      origin: z.string().describe('Origin port UN/LOCODE, e.g. CNSHA'),
      destination: z.string().describe('Destination port UN/LOCODE, e.g. NLRTM'),
    },
    async ({ origin, destination }) => {
      if (isDemo) {
        // Synthetic forward sailings derived from the demo lane carriers.
        const base = lookupDemo(origin, destination)
        const sailings = base.map((c, i) => ({
          carrier_code: c.carrier_code,
          vessel_name: `${c.carrier_name.toUpperCase()} DEMO ${i + 1}`,
          voyage_number: `${String(i + 1).padStart(3, '0')}W`,
          published_departure: `(demo, ~${(i + 1) * c.frequency_days}d out)`,
          source: 'connector',
        }))
        const note =
          sailings.length === 0
            ? 'No demo data for this lane. Try CNSHA→NLRTM or CNSHA→USLAX, or sign up at schedulesmcp.com.'
            : 'Demo data (synthetic). Real keys return live published_sailings with actual ETD/ETA and cut-offs.'
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ origin, destination, sailings, note }, null, 2),
            },
          ],
        }
      }
      const data = await apiGet(`/schedules?origin=${origin}&destination=${destination}`, apiKey)
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'find_best_sailings',
    'Decision query: the best upcoming sailings on a lane, ONE per carrier (next bookable departure), ranked. Filter by date window, max transit days, min on-time reliability, cut-off still open, and direct-vs-transshipment. Use this to answer "what should I book?".',
    {
      origin: z.string().describe('Origin port UN/LOCODE or name resolves upstream, e.g. CNSHA'),
      destination: z.string().describe('Destination port UN/LOCODE, e.g. NLRTM'),
      from: z.string().optional().describe('Earliest departure date YYYY-MM-DD (default: today)'),
      to: z.string().optional().describe('Latest departure date YYYY-MM-DD (default: +60 days)'),
      max_transit_days: z.number().optional().describe('Maximum transit time in days'),
      reliability_floor: z.number().optional().describe('Minimum 90-day on-time %, 0-100'),
      cutoff_open: z
        .boolean()
        .optional()
        .describe('Only sailings whose booking cut-off has not passed'),
      direct_only: z.boolean().optional().describe('Exclude transshipment routings'),
      sort: z
        .enum(['recommended', 'reliability', 'fastest', 'soonest'])
        .optional()
        .describe('Ranking (default recommended = reliability blended with transit)'),
    },
    async ({
      origin,
      destination,
      from,
      to,
      max_transit_days,
      reliability_floor,
      cutoff_open,
      direct_only,
      sort,
    }) => {
      if (isDemo) {
        const carriers = lookupDemo(origin, destination)
          .map((c) => ({
            carrier_code: c.carrier_code,
            carrier_name: c.carrier_name,
            transit_days: c.transit_p50_days,
            reliability_pct: c.on_time_pct,
            direct: true,
            note: 'demo',
          }))
          .sort(
            (a, b) =>
              b.reliability_pct - 0.8 * b.transit_days - (a.reliability_pct - 0.8 * a.transit_days)
          )
        const note =
          carriers.length === 0
            ? 'No demo data for this lane. Try CNSHA→NLRTM or CNSHA→USLAX, or subscribe at schedulesmcp.com/pricing.'
            : 'Demo data (synthetic). Real keys return live ranked sailings with vessel/voyage, ETD/ETA and cut-offs.'
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ origin, destination, options: carriers, note }, null, 2),
            },
          ],
        }
      }
      const params = new URLSearchParams({ origin, destination })
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (max_transit_days != null) params.set('max_transit_days', String(max_transit_days))
      if (reliability_floor != null) params.set('reliability_floor', String(reliability_floor))
      if (cutoff_open) params.set('cutoff_open', 'true')
      if (direct_only) params.set('direct_only', 'true')
      if (sort) params.set('sort', sort)
      const data = await apiGet(`/best-sailings?${params.toString()}`, apiKey)
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'watch_lane',
    'Watch a lane for schedule alerts (PAID): get emailed when a sailing on it is blanked, a booking cut-off is about to close, or a sailing slips. Also alerts on reliability drops. Returns the created watch.',
    {
      origin: z.string().describe('Origin port UN/LOCODE, e.g. CNNGB'),
      destination: z.string().describe('Destination port UN/LOCODE, e.g. NLRTM'),
      carrier_code: z
        .string()
        .optional()
        .describe('Optional SCAC to scope the watch to one carrier'),
      alert_blank: z
        .boolean()
        .optional()
        .describe('Alert on suspected blank sailings (default true)'),
      alert_cutoff: z
        .boolean()
        .optional()
        .describe('Alert when a booking cut-off is closing (default true)'),
      alert_slip: z
        .boolean()
        .optional()
        .describe('Alert when a sailing slips vs schedule (default true)'),
      cutoff_lead_hours: z
        .number()
        .optional()
        .describe('Hours before cut-off to alert (default 48)'),
    },
    async (args) => {
      if (isDemo) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  note: 'Demo key cannot create watches. Subscribe and use your real key at schedulesmcp.com/pricing to set schedule alerts.',
                },
                null,
                2
              ),
            },
          ],
        }
      }
      const data = await apiPost('/watches', apiKey, args)
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'port_reliability',
    'Congestion and dwell signals for a port (UN/LOCODE) — average wait and vessels at anchor.',
    { port: z.string().describe('Port UN/LOCODE, e.g. NLRTM') },
    async ({ port }) => {
      const DEMO: Record<
        string,
        { name: string; level: string; avg_wait_hours: number; at_anchor: number }
      > = {
        NLRTM: { name: 'Rotterdam', level: 'moderate', avg_wait_hours: 18, at_anchor: 12 },
        DEHAM: { name: 'Hamburg', level: 'high', avg_wait_hours: 34, at_anchor: 8 },
        USLAX: { name: 'Los Angeles', level: 'severe', avg_wait_hours: 72, at_anchor: 31 },
        SGSIN: { name: 'Singapore', level: 'low', avg_wait_hours: 4, at_anchor: 2 },
        CNSHA: { name: 'Shanghai', level: 'low', avg_wait_hours: 6, at_anchor: 3 },
      }
      const d = DEMO[port.toUpperCase()] ?? {
        name: port.toUpperCase(),
        level: 'unknown',
        avg_wait_hours: 0,
        at_anchor: 0,
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                port: port.toUpperCase(),
                ...d,
                note: isDemo
                  ? 'Demo data (synthetic).'
                  : 'Live signal from port_delay_observations.',
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )

  server.tool(
    'carrier_league',
    'Carrier league table — ocean carriers ranked by overall on-time reliability across all tracked lanes.',
    {},
    async () => {
      if (isDemo) {
        const seen = new Map<
          string,
          { carrier_code: string; carrier_name: string; on_time_pct: number }
        >()
        for (const rows of Object.values(DEMO_LANES)) {
          for (const c of rows) {
            const e = seen.get(c.carrier_code)
            if (!e)
              seen.set(c.carrier_code, {
                carrier_code: c.carrier_code,
                carrier_name: c.carrier_name,
                on_time_pct: c.on_time_pct,
              })
            else e.on_time_pct = Math.round((e.on_time_pct + c.on_time_pct) / 2)
          }
        }
        const league = [...seen.values()].sort((a, b) => b.on_time_pct - a.on_time_pct)
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ league, note: 'Demo data (synthetic).' }, null, 2),
            },
          ],
        }
      }
      const data = await apiGet('/reliability/leaderboard?min_obs=20', apiKey)
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'port_congestion',
    'Fused port-congestion signal for a port (UN/LOCODE): effective level (mild/moderate/severe), ' +
      'expected added wait in days (for ETA-band widening), a 0–1 confidence, and per-source detail — ' +
      'weiyun broad-AIS analysis + IMF PortWatch throughput + our own AIS wait/density.',
    { port: z.string().describe('Port UN/LOCODE, e.g. NLRTM') },
    async ({ port }) => {
      const up = port.toUpperCase()
      if (isDemo) {
        const DEMO: Record<
          string,
          { level: string; expected_wait_days: number; confidence: number }
        > = {
          CNSHA: { level: 'severe', expected_wait_days: 4.5, confidence: 0.82 },
          NLRTM: { level: 'moderate', expected_wait_days: 1.5, confidence: 0.6 },
          SGSIN: { level: 'mild', expected_wait_days: 0.5, confidence: 0.5 },
        }
        const d = DEMO[up] ?? { level: 'mild', expected_wait_days: 0.5, confidence: 0.4 }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                { port: up, congested: up in DEMO, ...d, note: 'Demo data (synthetic).' },
                null,
                2
              ),
            },
          ],
        }
      }
      const data = await apiGet(`/port-congestion?port=${encodeURIComponent(up)}`, apiKey)
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'active_cyclones',
    'Live tropical cyclones (typhoons/hurricanes) currently active on ocean trade lanes — name, basin, category, center position, max wind, pressure and movement, from CMA (NW-Pacific) + NHC (Atlantic/E-Pacific) + JTWC (Indian/Southern Hemisphere) + GDACS (global). Use this to see which storms are at sea right now.',
    {},
    async () => {
      const res = await fetch(`${WEATHER_BASE}/weather/cyclones`)
      const data = await res.json()
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    'lane_storm_exposure',
    'Whether an origin→destination ocean lane currently passes through an active cyclone\'s forecast gale field (a "storm-exposed" sailing at risk of weather delay). Omit ports to list every exposed lane.',
    {
      origin: z.string().optional().describe('Origin port UN/LOCODE, e.g. CNSHA'),
      destination: z.string().optional().describe('Destination port UN/LOCODE, e.g. USLAX'),
    },
    async ({ origin, destination }) => {
      const qs = new URLSearchParams()
      if (origin) qs.set('pol', origin)
      if (destination) qs.set('pod', destination)
      const res = await fetch(`${WEATHER_BASE}/weather/exposure?${qs.toString()}`)
      const data = await res.json()
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
    }
  )

  return server
}

// ── HTTP transport (Streamable HTTP) ──────────────────────────────────────────
// ── Per-IP rate limiting (in-memory; mirrors trackingmcp's demo limiter) ──────
// Protects the open demo endpoint from abuse/cost without requiring a key. Counters
// are per-machine (Fly may run >1) so treat as approximate guards; tune via env.
const RL_PER_MIN = Number.parseInt(process.env.MCP_RATE_PER_IP_PER_MIN ?? '60')
const RL_GLOBAL_PER_DAY = Number.parseInt(process.env.MCP_RATE_GLOBAL_PER_DAY ?? '20000')
const rlIpHits = new Map<string, { count: number; resetAt: number }>()
let rlDayCount = 0
let rlDayReset = 0

function rateLimit(ip: string): { ok: boolean; reason?: string; retryAfter?: number } {
  const now = Date.now()
  if (now > rlDayReset) {
    rlDayCount = 0
    rlDayReset = now + 86_400_000
  }
  if (rlDayCount >= RL_GLOBAL_PER_DAY)
    return {
      ok: false,
      reason: 'Daily capacity reached — please try again later.',
      retryAfter: 3600,
    }
  const e = rlIpHits.get(ip)
  if (e && now < e.resetAt) {
    if (e.count >= RL_PER_MIN)
      return {
        ok: false,
        reason: `Rate limit: ${RL_PER_MIN} requests/minute per IP — slow down and retry shortly.`,
        retryAfter: Math.ceil((e.resetAt - now) / 1000),
      }
    e.count++
  } else {
    rlIpHits.set(ip, { count: 1, resetAt: now + 60_000 })
  }
  rlDayCount++
  return { ok: true }
}

const handler = async (req: Request): Promise<Response> => {
  const url = new URL(req.url)
  if (url.pathname === '/health') return new Response('ok', { status: 200 })
  if (url.pathname !== '/mcp') return new Response('Not found', { status: 404 })

  // Per-IP rate limit before any work (cheap rejection of floods).
  const clientIp =
    req.headers.get('fly-client-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '0.0.0.0'
  const rl = rateLimit(clientIp)
  if (!rl.ok)
    return Response.json(
      { error: rl.reason },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60) } }
    )

  const authHeader = req.headers.get('Authorization')
  const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : DEMO_KEY

  const server = buildServer(apiKey)
  const transport = new WebStandardStreamableHTTPServerTransport()
  await server.connect(transport)
  return transport.handleRequest(req)
}

Bun.serve({ port: PORT, fetch: handler })
