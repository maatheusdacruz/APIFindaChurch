import { buildOpenApiDocument, type DocRegistrar } from './openapi'
import { registerHealthPaths } from '@/modules/health/schema'
import { registerChurchPaths } from '@/modules/church/schema'
import { registerMassPaths } from '@/modules/mass/schema'

/** Todos os registradores de rota documentada. Adicione novos módulos aqui. */
const registrars: DocRegistrar[] = [registerHealthPaths, registerChurchPaths, registerMassPaths]

export function getOpenApiDocument() {
  return buildOpenApiDocument(registrars)
}
