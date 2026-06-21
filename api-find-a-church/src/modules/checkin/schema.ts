import { z, successSchema, type DocRegistrar } from '@/lib/openapi'

export const checkInBodySchema = z.object({
  massScheduleId: z.number().int().positive().optional().openapi({ description: 'ID do horário assistido (opcional).' }),
})

export const checkInSchema = z
  .object({
    id: z.number().int(),
    churchId: z.number().int(),
    massScheduleId: z.number().int().nullable(),
    createdAt: z.string().datetime(),
  })
  .openapi('CheckIn')

export const activitySchema = z
  .object({
    churchId: z.number().int(),
    checkInsLast30Days: z.number().int(),
    uniqueVisitorsLast30Days: z.number().int(),
    lastActivityAt: z.string().datetime().nullable(),
    confirmedTodayCount: z.number().int(),
  })
  .openapi('ChurchActivity')

export const registerCheckinPaths: DocRegistrar = (registry, errorRef) => {
  const idParam = z.object({ id: z.coerce.number().int().positive() })
  const error401 = { description: 'Não autenticado', content: { 'application/json': { schema: errorRef } } }
  const error404 = { description: 'Não encontrado', content: { 'application/json': { schema: errorRef } } }

  registry.registerPath({
    method: 'post',
    path: '/api/churches/{id}/checkin',
    summary: 'Check-in opcional em uma igreja (RF27). Alimenta agregados sem expor indivíduo.',
    tags: ['CheckIn'],
    request: {
      params: idParam,
      body: { content: { 'application/json': { schema: checkInBodySchema } } },
    },
    responses: {
      201: {
        description: 'Check-in registrado',
        content: { 'application/json': { schema: successSchema(checkInSchema) } },
      },
      401: error401,
      404: error404,
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/api/churches/{id}/activity',
    summary: 'Indicadores de atividade agregados de uma igreja (RNF03 — sem dados individuais).',
    tags: ['CheckIn'],
    request: { params: idParam },
    responses: {
      200: {
        description: 'Atividade agregada',
        content: { 'application/json': { schema: successSchema(activitySchema) } },
      },
      404: error404,
    },
  })
}
