import { route, created, parseBody } from '@/lib/http'
import { requireAuth } from '@/lib/auth'
import { scheduleReminderBodySchema } from '@/modules/notification/schema'
import { scheduleReminders } from '@/modules/notification/service'

export const POST = route(async (req: Request) => {
  const { userId } = requireAuth(req)
  const body = await parseBody(req, scheduleReminderBodySchema)
  const result = await scheduleReminders(userId, body)
  return created(result.data)
})
