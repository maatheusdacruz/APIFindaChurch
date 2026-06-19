import { NextResponse } from 'next/server'
import { route } from '@/lib/http'
import { getOpenApiDocument } from '@/lib/api-docs'

// GET /api/docs/openapi.json — spec OpenAPI gerado a partir dos schemas Zod.
export const GET = route(async () => {
  return NextResponse.json(getOpenApiDocument())
})
