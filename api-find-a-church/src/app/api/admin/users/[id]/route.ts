import { z } from 'zod'
import { route, ok, parseBody } from '@/lib/http'
import { requirePlatformAdmin } from '@/lib/auth'
import { editUser, deleteUser } from '@/modules/admin/service'

const editBodySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().email().optional(),
})

export const PUT = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requirePlatformAdmin(req)
  const { id } = await params
  const body = await parseBody(req, editBodySchema)
  const result = await editUser(Number(id), body)
  return ok(result.data)
})

export const DELETE = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requirePlatformAdmin(req)
  const { id } = await params
  const result = await deleteUser(Number(id))
  return ok(result.data)
})
