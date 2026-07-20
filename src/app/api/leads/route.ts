import { NextRequest, NextResponse } from 'next/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../../convex/_generated/api'

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' }

const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s)

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

    const convexUrl = stripBom(
      process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL ?? ''
    )
    if (!convexUrl) {
      return NextResponse.json(
        { error: 'CONVEX_URL is not configured' },
        { status: 500, headers: JSON_HEADERS }
      )
    }

    const convex = new ConvexHttpClient(convexUrl)
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
