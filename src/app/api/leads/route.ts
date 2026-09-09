import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../convex/_generated/api'

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' }

const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s)

const convexUrl = () =>
  stripBom(process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL ?? '')

const missingConvexUrl = () =>
  NextResponse.json(
    { error: 'CONVEX_URL is not configured' },
    { status: 500, headers: JSON_HEADERS }
  )

export async function POST(req: NextRequest) {
  try {
    // Read raw bytes and decode explicitly as UTF-8 — avoids any charset mismatch
    // from the Content-Type header (e.g. n8n omitting "; charset=utf-8")
    const buffer = await req.arrayBuffer()
    const text = new TextDecoder('utf-8').decode(buffer)
    let body = JSON.parse(text)

    // n8n HTTP Request node sometimes double-encodes the body (sends a JSON string
    // whose value is itself a JSON object). Unwrap one level if that's the case.
    if (typeof body === 'string') {
      body = JSON.parse(body)
    }

    if (!body || typeof body !== 'object' || !body.google_maps_url) {
      return NextResponse.json(
        { error: 'google_maps_url is required' },
        { status: 400, headers: JSON_HEADERS }
      )
    }

    const url = convexUrl()
    if (!url) return missingConvexUrl()

    const convex = new ConvexHttpClient(url)
    // upsert-by-google_maps_url with ignoreDuplicates semantics lives in Convex
    const { inserted } = await convex.mutation(api.leads.upsert, { rows: [body] })

    return NextResponse.json({ ok: true, inserted }, { headers: JSON_HEADERS })
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400, headers: JSON_HEADERS }
    )
  }
}

// Read leads back out — used by the n8n backfill workflow, which needs the
// rows the scoring step never saw. `?missing_priority=1` narrows the response
// to exactly those, so the workflow doesn't page through the whole CRM.
export async function GET(req: NextRequest) {
  const url = convexUrl()
  if (!url) return missingConvexUrl()

  const convex = new ConvexHttpClient(url)
  const leads = await convex.query(api.leads.list, {})

  const onlyMissing = req.nextUrl.searchParams.get('missing_priority') === '1'
  const rows = onlyMissing
    ? leads.filter((l) => l.priority_score == null)
    : leads

  return NextResponse.json({ count: rows.length, leads: rows }, { headers: JSON_HEADERS })
}

// Patch a single lead by id. Deliberately narrow: the backfill workflow may
// only write the scoring fields, never the sales columns a human owns.
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    if (!body?.id || typeof body.id !== 'string') {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400, headers: JSON_HEADERS }
      )
    }

    const updates: Record<string, unknown> = {}
    if ('priority_score' in body) updates.priority_score = body.priority_score ?? null
    if ('platform_tag' in body) updates.platform_tag = body.platform_tag ?? null
    if (typeof body.duvod === 'string') updates.duvod = body.duvod

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'nothing to update' },
        { status: 400, headers: JSON_HEADERS }
      )
    }

    const url = convexUrl()
    if (!url) return missingConvexUrl()

    const convex = new ConvexHttpClient(url)
    const lead = await convex.mutation(api.leads.update, {
      id: body.id as never,
      updates,
    })

    return NextResponse.json({ ok: true, lead }, { headers: JSON_HEADERS })
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400, headers: JSON_HEADERS }
    )
  }
}
