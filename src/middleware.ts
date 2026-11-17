import { NextRequest, NextResponse } from 'next/server'

// Celé CRM je za heslem. Stránky: HTTP Basic Auth (CRM_USER / CRM_PASSWORD),
// prohlížeč si ho pamatuje. /api: hlavička `x-api-key: CRM_API_KEY` pro skripty
// a Grok boty, nebo stejné Basic Auth z prohlížeče. Bez nastavených proměnných
// se nepustí nikdo (radši zamčeno než otevřené).

const unauthorized = (api: boolean) =>
  api
    ? NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    : new NextResponse('Přihlášení vyžadováno', {
        status: 401,
        headers: { 'WWW-Authenticate': 'Basic realm="CRM", charset="UTF-8"' },
      })

function basicOk(req: NextRequest): boolean {
  const user = process.env.CRM_USER
  const pass = process.env.CRM_PASSWORD
  const header = req.headers.get('authorization')
  if (!user || !pass || !header?.startsWith('Basic ')) return false
  try {
    const bytes = Uint8Array.from(atob(header.slice(6)), (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes) === `${user}:${pass}`
  } catch {
    return false
  }
}

export function middleware(req: NextRequest) {
  const api = req.nextUrl.pathname.startsWith('/api/')
  if (api) {
    const key = process.env.CRM_API_KEY
    if (key && req.headers.get('x-api-key') === key) return NextResponse.next()
  }
  return basicOk(req) ? NextResponse.next() : unauthorized(api)
}

export const config = {
  matcher: ['/((?!favicon.ico).*)'],
}
