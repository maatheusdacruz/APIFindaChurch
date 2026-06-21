import { NextResponse, type NextRequest } from 'next/server'

/**
 * CORS + origem confiável.
 * Em produção, ALLOWED_ORIGINS deve ser a URL do frontend (ex: https://findachurch.app).
 * Em desenvolvimento, aceita localhost:3000 e qualquer origem sem Origin (ex: curl, Postman).
 */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,x-admin-key',
  'Access-Control-Max-Age': '86400',
}

export function middleware(req: NextRequest) {
  const origin = req.headers.get('origin') ?? ''
  const isAllowed = !origin || ALLOWED_ORIGINS.includes(origin)

  // Preflight (OPTIONS)
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': isAllowed ? origin || '*' : '',
        ...CORS_HEADERS,
      },
    })
  }

  // Bloqueia origens não autorizadas em produção
  if (origin && !isAllowed && process.env.NODE_ENV === 'production') {
    return new NextResponse(
      JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Origem não autorizada.' } }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const res = NextResponse.next()
  if (origin) {
    res.headers.set('Access-Control-Allow-Origin', isAllowed ? origin : '')
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v))
  }
  return res
}

export const config = {
  matcher: '/api/:path*',
}
