import { createHmac } from 'crypto'
import { env } from '@/config/env'
import { ForbiddenError } from './errors'
import { prisma } from './prisma'

/**
 * Autenticação leve baseada em HMAC (Fase 3+).
 * Fase 3: deviceId → token anônimo.
 * Fase 4: mesmo token, verificado no middleware de guardião/admin.
 */

export interface TokenPayload {
  userId: number
  deviceId: string
}

export function signToken(userId: number, deviceId: string): string {
  const payloadB64 = Buffer.from(JSON.stringify({ userId, deviceId })).toString('base64url')
  const sig = createHmac('sha256', env.TOKEN_SECRET).update(payloadB64).digest('hex')
  return `${payloadB64}.${sig}`
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const dot = token.indexOf('.')
    if (dot === -1) return null
    const payloadB64 = token.slice(0, dot)
    const sig = token.slice(dot + 1)
    const expected = createHmac('sha256', env.TOKEN_SECRET).update(payloadB64).digest('hex')
    if (sig !== expected) return null
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
    if (typeof payload.userId !== 'number' || typeof payload.deviceId !== 'string') return null
    return { userId: payload.userId, deviceId: payload.deviceId }
  } catch {
    return null
  }
}

export function extractToken(req: Request): TokenPayload | null {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  return verifyToken(authHeader.slice(7))
}

/** Lança ForbiddenError se não houver token válido. */
export function requireAuth(req: Request): TokenPayload {
  const payload = extractToken(req)
  if (!payload) throw new ForbiddenError('Token de autenticação inválido ou ausente.')
  return payload
}

/** Verifica chave de admin de plataforma (para endpoints /api/admin/*). */
export function requireAdminKey(req: Request): void {
  const key = req.headers.get('x-admin-key')
  if (!key || key !== env.ADMIN_API_KEY) {
    throw new ForbiddenError('Chave de administrador inválida.')
  }
}

/**
 * Verifica se o usuário pode editar diretamente os dados de uma igreja
 * (admin geral ou admin de paróquia que contenha a igreja).
 * Guardiões NÃO têm edição direta — eles aprovam sugestões.
 */
export async function requireDirectEditor(
  req: Request,
  churchId: number,
): Promise<{ userId: number }> {
  const payload = requireAuth(req)

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { isPlatformAdmin: true },
  })

  if (user?.isPlatformAdmin) return { userId: payload.userId }

  const churchParishes = await prisma.churchParish.findMany({
    where: { churchId },
    select: { parishId: true },
  })
  if (churchParishes.length > 0) {
    const parishIds = churchParishes.map((cp) => cp.parishId)
    const adminRole = await prisma.adminRole.findFirst({
      where: { userId: payload.userId, parishId: { in: parishIds }, status: 'ACTIVE' },
    })
    if (adminRole) return { userId: payload.userId }
  }

  throw new ForbiddenError('Apenas administradores podem editar diretamente os dados da igreja.')
}

/**
 * Verifica se o usuário autenticado pode aprovar sugestões de horário para a igreja.
 * Regras: isPlatformAdmin OU GuardianRole ativo na igreja OU AdminRole ativo numa paróquia que contenha a igreja.
 */
export async function requireScheduleApprover(
  req: Request,
  churchId: number,
): Promise<{ userId: number }> {
  const payload = requireAuth(req)

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { isPlatformAdmin: true },
  })

  if (user?.isPlatformAdmin) return { userId: payload.userId }

  const guardian = await prisma.guardianRole.findFirst({
    where: { userId: payload.userId, churchId, status: 'ACTIVE' },
  })
  if (guardian) return { userId: payload.userId }

  const churchParishes = await prisma.churchParish.findMany({
    where: { churchId },
    select: { parishId: true },
  })
  if (churchParishes.length > 0) {
    const parishIds = churchParishes.map((cp) => cp.parishId)
    const adminRole = await prisma.adminRole.findFirst({
      where: { userId: payload.userId, parishId: { in: parishIds }, status: 'ACTIVE' },
    })
    if (adminRole) return { userId: payload.userId }
  }

  throw new ForbiddenError('Sem permissão para aprovar sugestões desta igreja.')
}

/**
 * Aceita x-admin-key OU Bearer token de usuário com isPlatformAdmin=true.
 * Use nos endpoints do painel de administração do frontend.
 */
export async function requirePlatformAdmin(req: Request): Promise<{ userId: number | null }> {
  const key = req.headers.get('x-admin-key')
  if (key && key === env.ADMIN_API_KEY) {
    return { userId: null }
  }

  const payload = requireAuth(req)
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { isPlatformAdmin: true },
  })
  if (!user?.isPlatformAdmin) {
    throw new ForbiddenError('Acesso restrito a administradores de plataforma.')
  }
  return { userId: payload.userId }
}
