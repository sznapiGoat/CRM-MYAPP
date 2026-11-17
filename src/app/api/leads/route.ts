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

    if (!body || typeof body !== 'object' || (!body.google_maps_url && !body.ico)) {
      return NextResponse.json(
        { error: 'google_maps_url or ico is required' },
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
// Grok boti: `?draha=B` jen dráha B, `?status=k_schvaleni` jeden stav,
// `?due=1` follow-up dnes nebo po termínu (ranní „kdo čeká na koho“).
export async function GET(req: NextRequest) {
  const url = convexUrl()
  if (!url) return missingConvexUrl()

  const convex = new ConvexHttpClient(url)
  const leads = await convex.query(api.leads.list, {})

  const params = req.nextUrl.searchParams
  const draha = params.get('draha')
  const status = params.get('status')
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  const rows = leads.filter((l) => {
    if (params.get('missing_priority') === '1' && l.priority_score != null) return false
    if (draha && l.draha !== draha) return false
    if (status && l.status !== status) return false
    if (params.get('due') === '1' && !(l.follow_up_at && new Date(l.follow_up_at) <= todayEnd)) return false
    return true
  })

  return NextResponse.json({ count: rows.length, leads: rows }, { headers: JSON_HEADERS })
}

// Patch a single lead by id. Deliberately narrow: the backfill workflow may
// only write the scoring fields, and Grok boti only their research and draft
// fields, never the sales columns a human owns (status, poznámka, termíny).
const BOT_FIELDS = [
  'icp_score', 'email', 'jednatel', 'kategorie', 'problem_webu', 'zdroje',
  'email_predmet', 'email_text', 'telefon_osnova', 'kontrola',
] as const

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
    for (const f of BOT_FIELDS) if (f in body) updates[f] = body[f] ?? null

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
