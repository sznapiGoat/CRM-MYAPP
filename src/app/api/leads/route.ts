import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' }

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

    const stripBom = (s: string) => s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s
    const supabase = createClient(
      stripBom(process.env.NEXT_PUBLIC_SUPABASE_URL!),
      stripBom(process.env.SUPABASE_SERVICE_ROLE_KEY!)
    )

    const { error } = await supabase
      .from('leads')
      .upsert(body, { onConflict: 'google_maps_url', ignoreDuplicates: true })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: JSON_HEADERS }
      )
    }

    return NextResponse.json({ ok: true }, { headers: JSON_HEADERS })
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400, headers: JSON_HEADERS }
    )
  }
}
