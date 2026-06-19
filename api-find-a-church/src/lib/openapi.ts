import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'

/**
 * Fonte única de verdade da documentação (§2 / §3.3): o Swagger é GERADO
 * a partir dos schemas Zod, nunca escrito à mão.
 *
 * `extendZodWithOpenApi` é aplicado aqui e este módulo reexporta `z` —
 * qualquer schema que use `.openapi()` deve importar `z` daqui.
 */
extendZodWithOpenApi(z)
export { z }

/** Referência reutilizável ao componente de erro já registrado. */
export type ErrorRef = ReturnType<OpenAPIRegistry['register']>
export type DocRegistrar = (registry: OpenAPIRegistry, errorRef: ErrorRef) => void

/** Envelope de erro padrão (§3.2). Registrado uma única vez em buildOpenApiDocument. */
export function errorResponseSchema() {
  return z.object({
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z
        .array(z.object({ path: z.string().optional(), message: z.string() }))
        .optional(),
    }),
  })
}

/** Envelope de sucesso `{ data, meta }` em volta de um schema de payload. */
export function successSchema<S extends z.ZodTypeAny>(data: S, withMeta = false) {
  const shape: Record<string, z.ZodTypeAny> = { data }
  if (withMeta) {
    shape.meta = z.object({
      page: z.number().int().optional(),
      pageSize: z.number().int().optional(),
      total: z.number().int().optional(),
    })
  }
  return z.object(shape)
}

/**
 * Monta o documento OpenAPI a partir de um registry já populado.
 * `registrars` são as funções `registerXxxPaths` de cada módulo.
 */
export function buildOpenApiDocument(registrars: DocRegistrar[]) {
  const registry = new OpenAPIRegistry()
  const errorRef = registry.register('ErrorResponse', errorResponseSchema())
  for (const register of registrars) register(registry, errorRef)

  const generator = new OpenApiGeneratorV3(registry.definitions)
  return generator.generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'API Paróquias — descoberta de igrejas e missas',
      version: '0.1.0',
      description:
        'API geográfica para descobrir igrejas e missas próximas. Construção faseada (ver context.md).',
    },
    servers: [{ url: '/' }],
  })
}
