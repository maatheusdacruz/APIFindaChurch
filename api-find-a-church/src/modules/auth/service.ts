import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { signToken } from '@/lib/auth'
import { ConflictError, ForbiddenError } from '@/lib/errors'
import { env } from '@/config/env'
import type { registerBodySchema, loginBodySchema } from './schema'

const BCRYPT_ROUNDS = 12

type User = {
  id: number
  name: string | null
  email: string | null
  deviceId: string
  reputation: number
  isPlatformAdmin: boolean
  createdAt: Date
}

function toDto(user: User, token: string) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    reputation: user.reputation,
    isPlatformAdmin: user.isPlatformAdmin,
    createdAt: user.createdAt.toISOString(),
    token,
  }
}

export async function registerUser(body: z.infer<typeof registerBodySchema>) {
  const existing = await prisma.user.findUnique({ where: { email: body.email } })
  if (existing) throw new ConflictError('E-mail já cadastrado.')

  const passwordHash = await bcrypt.hash(body.password, BCRYPT_ROUNDS)
  // deviceId derivado do email para manter compatibilidade com o modelo atual
  const deviceId = `email:${body.email}`

  const user = await prisma.user.upsert({
    where: { deviceId },
    update: { email: body.email, passwordHash, name: body.name },
    create: { deviceId, email: body.email, passwordHash, name: body.name },
  })

  const token = signToken(user.id, user.deviceId)
  return { data: toDto(user, token) }
}

export async function loginUser(body: z.infer<typeof loginBodySchema>) {
  const user = await prisma.user.findUnique({ where: { email: body.email } })

  if (!user || !user.passwordHash) {
    throw new ForbiddenError('E-mail ou senha inválidos.')
  }

  const valid = await bcrypt.compare(body.password, user.passwordHash)
  if (!valid) throw new ForbiddenError('E-mail ou senha inválidos.')

  const token = signToken(user.id, user.deviceId)
  return { data: toDto(user, token) }
}

export async function getMe(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      guardianRoles: {
        where: { status: 'ACTIVE' },
        select: { churchId: true },
      },
      adminRoles: {
        where: { status: 'ACTIVE' },
        select: { parishId: true },
      },
    },
  })

  if (!user) throw new ForbiddenError('Usuário não encontrado.')

  // Admin de plataforma: campo no modelo OU chave de admin
  const isPlatformAdmin = user.isPlatformAdmin || user.deviceId === `admin:${env.ADMIN_API_KEY}`

  return {
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      reputation: user.reputation,
      isPlatformAdmin,
      createdAt: user.createdAt.toISOString(),
      guardianOf: user.guardianRoles.map((g) => g.churchId),
      parishAdminOf: user.adminRoles.map((a) => a.parishId),
    },
  }
}
