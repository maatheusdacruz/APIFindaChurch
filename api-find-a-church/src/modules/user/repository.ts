import { prisma } from '@/lib/prisma'

export async function findUserByDeviceId(deviceId: string) {
  return prisma.user.findUnique({ where: { deviceId } })
}

export async function findUserById(id: number) {
  return prisma.user.findUnique({ where: { id } })
}

export async function createUser(deviceId: string) {
  return prisma.user.create({ data: { deviceId } })
}

export async function updatePushToken(userId: number, pushToken: string) {
  return prisma.user.update({ where: { id: userId }, data: { pushToken } })
}
