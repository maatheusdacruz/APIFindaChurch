import { z } from 'zod'
import { NotFoundError } from '@/lib/errors'
import { signToken } from '@/lib/auth'
import { findUserByDeviceId, createUser, updatePushToken, findUserById } from './repository'
import { registerUserBodySchema, pushTokenBodySchema, userSchema } from './schema'

type UserRow = NonNullable<Awaited<ReturnType<typeof findUserById>>>

function toDto(u: UserRow, token?: string): z.infer<typeof userSchema> {
  return {
    id: u.id,
    deviceId: u.deviceId,
    reputation: u.reputation,
    createdAt: u.createdAt.toISOString(),
    ...(token ? { token } : {}),
  }
}

/** Registra ou recupera usuário; sempre retorna token. */
export async function registerOrLoginUser(body: z.infer<typeof registerUserBodySchema>) {
  const existing = await findUserByDeviceId(body.deviceId)
  if (existing) {
    const token = signToken(existing.id, existing.deviceId)
    return { data: toDto(existing, token), isNew: false }
  }
  const user = await createUser(body.deviceId)
  const token = signToken(user.id, user.deviceId)
  return { data: toDto(user, token), isNew: true }
}

export async function savePushToken(userId: number, body: z.infer<typeof pushTokenBodySchema>) {
  const user = await updatePushToken(userId, body.pushToken)
  if (!user) throw new NotFoundError('Usuário não encontrado.')
  return { data: toDto(user) }
}
