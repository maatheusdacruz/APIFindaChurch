import { NextResponse } from 'next/server'
import { route, ok, created, parseParams } from '@/lib/http'
import { requireAuth } from '@/lib/auth'
import { churchIdParamSchema } from '@/modules/favorite/schema'
import { addFavorite, removeFavorite } from '@/modules/favorite/service'

export const POST = route(async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
  const { userId } = requireAuth(req)
  const { churchId } = parseParams(await ctx.params, churchIdParamSchema)
  const result = await addFavorite(userId, churchId)
  return result.isNew ? created(result.data) : ok(result.data)
})

export const DELETE = route(async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
  const { userId } = requireAuth(req)
  const { churchId } = parseParams(await ctx.params, churchIdParamSchema)
  await removeFavorite(userId, churchId)
  return new NextResponse(null, { status: 204 })
})
