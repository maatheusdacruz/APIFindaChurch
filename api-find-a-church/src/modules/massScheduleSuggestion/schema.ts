import { z } from 'zod'
import { env } from '@/config/env'

export const MASS_KINDS = ['MISSA', 'CONFISSAO', 'ADORACAO'] as const
export const CHANGE_TYPES = ['ADD', 'EDIT', 'DELETE'] as const
export const MS_SUGGESTION_STATUSES = ['PENDENT', 'REVISION', 'APPLY', 'REJECTED'] as const

// ───────────────────── Entrada ─────────────────────

export const createMSSuggestionBodySchema = z.object({
  changeType: z.enum(CHANGE_TYPES).default('ADD'),
  targetScheduleId: z.number().int().positive().optional().nullable(),
  kind: z.enum(MASS_KINDS).default('MISSA'),
  dayOfWeek: z.number().int().min(0).max(6).optional().nullable(),
  date: z.string().optional().nullable(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Formato deve ser HH:MM').optional().nullable(),
  note: z.string().max(500).optional().nullable(),
  validFrom: z.string().datetime().optional().nullable(),
  validTo: z.string().datetime().optional().nullable(),
})

export const listMSSuggestionsQuerySchema = z.object({
  status: z.enum(MS_SUGGESTION_STATUSES).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(env.MAX_PAGE_SIZE).default(env.DEFAULT_PAGE_SIZE),
})

export const msSuggestionIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const churchIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const rejectMSSuggestionBodySchema = z.object({
  reason: z.string().max(500).optional(),
})

// ───────────────────── Saída ─────────────────────

export const msSuggestionSchema = z.object({
  id: z.number().int(),
  churchId: z.number().int(),
  changeType: z.enum(CHANGE_TYPES),
  targetScheduleId: z.number().int().nullable(),
  kind: z.enum(MASS_KINDS),
  dayOfWeek: z.number().int().nullable(),
  date: z.string().nullable(),
  startTime: z.string().nullable(),
  note: z.string().nullable(),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
  status: z.enum(MS_SUGGESTION_STATUSES),
  rejectionReason: z.string().nullable(),
  suggestedById: z.number().int().nullable(),
  reviewedById: z.number().int().nullable(),
  reviewedAt: z.string().nullable(),
  createdAt: z.string(),
})
