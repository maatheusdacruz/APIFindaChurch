import { z, successSchema, type DocRegistrar } from '@/lib/openapi'

export const scheduleReminderBodySchema = z.object({
  churchId: z.number().int().positive().openapi({ description: 'ID da igreja.' }),
  massScheduleId: z.number().int().positive().openapi({ description: 'ID do horário de missa.' }),
  offsetMinutes: z
    .array(z.number().int().positive())
    .min(1)
    .max(5)
    .default([60, 30, 10])
    .openapi({ description: 'Offsets de antecedência (min) para os lembretes. Ex: [60, 30, 10].' }),
})

export const reminderSchema = z
  .object({
    reminders: z.array(
      z.object({
        id: z.number().int(),
        kind: z.string(),
        fireAt: z.string().datetime(),
        offsetMinutes: z.number().int(),
        status: z.string(),
      }),
    ),
  })
  .openapi('ReminderResult')

export const registerNotificationPaths: DocRegistrar = (registry, errorRef) => {
  const error400 = { description: 'Erro de validação', content: { 'application/json': { schema: errorRef } } }
  const error401 = { description: 'Não autenticado', content: { 'application/json': { schema: errorRef } } }
  const error404 = { description: 'Não encontrado', content: { 'application/json': { schema: errorRef } } }

  registry.registerPath({
    method: 'post',
    path: '/api/notifications/reminders',
    summary: 'Agenda lembretes para uma missa (RF18–RF20): 1h/30min/10min antes.',
    tags: ['Notifications'],
    request: { body: { content: { 'application/json': { schema: scheduleReminderBodySchema } } } },
    responses: {
      201: {
        description: 'Lembretes agendados',
        content: { 'application/json': { schema: successSchema(reminderSchema) } },
      },
      400: error400,
      401: error401,
      404: error404,
    },
  })
}
