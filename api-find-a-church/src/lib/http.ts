import { NextResponse } from 'next/server'
import { z } from 'zod'
import { DomainError, ValidationError, type ErrorDetail } from './errors'
import { env } from '@/config/env'

/**
 * Camada HTTP transversal (§3.2 / §3.3):
 * - envelope único de sucesso/erro
 * - handler central que converte erro de domínio / Zod em HTTP
 * - helpers de validação de entrada (query / body / params)
 */

export type Meta = {
  page?: number
  pageSize?: number
  total?: number
  [k: string]: unknown
}

export function ok<T>(data: T, meta?: Meta, status = 200) {
  return NextResponse.json(meta ? { data, meta } : { data }, { status })
}

export function created<T>(data: T) {
  return ok(data, undefined, 201)
}

function errorBody(code: string, message: string, details?: ErrorDetail[]) {
  return { error: { code, message, ...(details ? { details } : {}) } }
}

function zodToDetails(err: z.ZodError): ErrorDetail[] {
  return err.issues.map((i) => ({
    path: i.path.join('.') || undefined,
    message: i.message,
  }))
}

/**
 * Envolve um route handler capturando qualquer exceção e devolvendo
 * sempre o formato de erro padrão. Use em TODA rota.
 */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args)
    } catch (err) {
      if (err instanceof DomainError) {
        return NextResponse.json(
          errorBody(err.code, err.message, err.details),
          { status: err.status },
        )
      }
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          errorBody('VALIDATION_ERROR', 'Dados de entrada inválidos.', zodToDetails(err)),
          { status: 400 },
        )
      }
      // Erro inesperado: não vaza stack em produção.
      if (env.NODE_ENV !== 'production') {
        console.error('[unhandled]', err)
      }
      return NextResponse.json(
        errorBody('INTERNAL_ERROR', 'Erro interno inesperado.'),
        { status: 500 },
      )
    }
  }
}

/** Valida os query params de uma URL contra um schema Zod. */
export function parseQuery<S extends z.ZodTypeAny>(req: Request, schema: S): z.infer<S> {
  const url = new URL(req.url)
  const raw: Record<string, string | string[]> = {}
  for (const key of url.searchParams.keys()) {
    if (key in raw) continue
    const all = url.searchParams.getAll(key)
    raw[key] = all.length > 1 ? all : all[0]
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    throw new ValidationError('Query string inválida.', zodToDetails(parsed.error))
  }
  return parsed.data
}

/** Valida o corpo JSON de uma request contra um schema Zod. */
export async function parseBody<S extends z.ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    throw new ValidationError('Corpo da requisição deve ser JSON válido.')
  }
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    throw new ValidationError('Corpo da requisição inválido.', zodToDetails(parsed.error))
  }
  return parsed.data
}

/** Valida os route params (já resolvidos) contra um schema Zod. */
export function parseParams<S extends z.ZodTypeAny>(raw: unknown, schema: S): z.infer<S> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    throw new ValidationError('Parâmetros de rota inválidos.', zodToDetails(parsed.error))
  }
  return parsed.data
}
