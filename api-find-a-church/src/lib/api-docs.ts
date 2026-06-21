import { buildOpenApiDocument, type DocRegistrar } from './openapi'
import { registerHealthPaths } from '@/modules/health/schema'
import { registerChurchPaths } from '@/modules/church/schema'
import { registerMassPaths } from '@/modules/mass/schema'
// Fase 2
import { registerSuggestionPaths } from '@/modules/suggestion/schema'
import { registerRevisionPaths } from '@/modules/revision/schema'
import { registerFeedbackPaths } from '@/modules/feedback/schema'
import { registerEnrichmentPaths } from '@/modules/enrichment/schema'
// Fase 3
import { registerUserPaths } from '@/modules/user/schema'
import { registerFavoritePaths } from '@/modules/favorite/schema'
import { registerCheckinPaths } from '@/modules/checkin/schema'
import { registerNotificationPaths } from '@/modules/notification/schema'
import { registerDiscoveryPaths } from '@/modules/discovery/schema'
// Fase 4
import { registerParishPaths } from '@/modules/parish/schema'
import { registerGuardianPaths } from '@/modules/guardian/schema'
import { registerReportPaths } from '@/modules/report/schema'
import { registerConsensusPaths } from '@/modules/consensus/schema'
import { registerMuralPaths } from '@/modules/mural/schema'

/** Todos os registradores de rota documentada. Adicione novos módulos aqui. */
const registrars: DocRegistrar[] = [
  registerHealthPaths,
  registerChurchPaths,
  registerMassPaths,
  // Fase 2
  registerSuggestionPaths,
  registerRevisionPaths,
  registerFeedbackPaths,
  registerEnrichmentPaths,
  // Fase 3
  registerUserPaths,
  registerFavoritePaths,
  registerCheckinPaths,
  registerNotificationPaths,
  registerDiscoveryPaths,
  // Fase 4
  registerParishPaths,
  registerGuardianPaths,
  registerReportPaths,
  registerConsensusPaths,
  registerMuralPaths,
]

export function getOpenApiDocument() {
  return buildOpenApiDocument(registrars)
}
