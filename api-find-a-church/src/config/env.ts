import { z } from 'zod'

/**
 * Validação central das variáveis de ambiente (Fase 0).
 * Tudo que é "decisão pendente / configurável" entra aqui com default,
 * nunca hard-coded no código de domínio.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),

  // Fuso usado para cálculo de "próxima missa" / "missa agora".
  APP_TIMEZONE: z.string().default('America/Sao_Paulo'),

  // Paginação (§3.4)
  DEFAULT_PAGE_SIZE: z.coerce.number().int().positive().default(20),
  MAX_PAGE_SIZE: z.coerce.number().int().positive().default(100),

  // Busca geográfica (§3.6)
  NEAR_DEFAULT_RADIUS_M: z.coerce.number().int().positive().default(2000),
  NEAR_MAX_RADIUS_M: z.coerce.number().int().positive().default(50000),

  // "Missa Agora" (RF09)
  MASS_NOW_WINDOW_MIN: z.coerce.number().int().positive().default(60),
  MASS_NOW_MAX_WINDOW_MIN: z.coerce.number().int().positive().default(360),

  // Frescor (§3.7): a partir de quantos dias um horário é considerado "antigo".
  FRESHNESS_STALE_DAYS: z.coerce.number().int().positive().default(90),
})

function loadEnv() {
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n')
    throw new Error(`Variáveis de ambiente inválidas:\n${issues}`)
  }
  return parsed.data
}

export const env = loadEnv()
export type Env = typeof env
