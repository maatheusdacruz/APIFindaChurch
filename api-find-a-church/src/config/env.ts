import { z } from 'zod'

/**
 * Validação central das variáveis de ambiente.
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

  // Fase 2 — Frescor
  // Confidence mínima para auto-aplicar sugestão de baixo risco.
  SUGGESTION_AUTO_APPLY_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.8),
  // Quantos DENY acumulados antes de baixar a confidence do horário.
  FEEDBACK_DENY_THRESHOLD: z.coerce.number().int().positive().default(3),
  // Chave de API para endpoints administrativos (/api/admin/*).
  ADMIN_API_KEY: z.string().default('dev-admin-key'),

  // Fase 3 — Recorrência
  // Segredo para assinar tokens de usuário.
  TOKEN_SECRET: z.string().min(16).default('dev-token-secret-change-in-prod'),
  // Janela (dias) para cálculo de atividade agregada de uma igreja.
  CHECKIN_ACTIVITY_DAYS: z.coerce.number().int().positive().default(30),

  // Segurança / CORS
  // Origens permitidas (separadas por vírgula). Em dev: http://localhost:3000
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),

  // Fase 4 — Comunidade e governança (DP1/DP2)
  // Nº de denúncias para congelar o guardião automaticamente.
  GUARDIAN_REPORT_FREEZE_THRESHOLD: z.coerce.number().int().positive().default(5),
  // Confirmações necessárias para guardião solo aplicar edição de alto risco.
  GUARDIAN_SOLO_CONFIRM_COUNT: z.coerce.number().int().positive().default(2),
  // Score mínimo para promoção automática de guardião.
  GUARDIAN_AUTO_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.8),
  // Peso total mínimo de votos para consenso ser aprovado.
  CONSENSUS_THRESHOLD: z.coerce.number().positive().default(3.0),
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
