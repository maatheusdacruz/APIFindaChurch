/**
 * Classificação de risco por campo (RN04/§3.8).
 *
 * LOW  → aplica direto + registra Revision.
 * HIGH → entra como Suggestion PENDING para revisão manual (ou consenso na Fase 4).
 *
 * A tabela é o ponto único de configuração; nenhum if espalhado no código de domínio.
 */

export type RiskTier = 'LOW' | 'HIGH'

interface FieldRisk {
  tier: RiskTier
  /** Descrição do motivo, para debug/docs. */
  reason: string
}

const CHURCH_FIELDS: Record<string, FieldRisk> = {
  name: { tier: 'HIGH', reason: 'Nome é identidade da igreja; erro causa confusão grave.' },
  photoUrl: { tier: 'LOW', reason: 'Foto é facilmente reversível e sem impacto crítico.' },
  phone: { tier: 'LOW', reason: 'Telefone é verificável e de baixo alcance operacional.' },
  addressLine: { tier: 'LOW', reason: 'Endereço textual, reversível.' },
  district: { tier: 'LOW', reason: 'Bairro, reversível.' },
  city: { tier: 'HIGH', reason: 'Cidade afeta buscas geográficas; risco de duplicação.' },
  state: { tier: 'HIGH', reason: 'Estado afeta buscas; risco de duplicação.' },
  postalCode: { tier: 'LOW', reason: 'CEP, baixo impacto.' },
  lat: { tier: 'HIGH', reason: 'Coordenada afeta proximidade/mapa; erro crítico.' },
  lng: { tier: 'HIGH', reason: 'Coordenada afeta proximidade/mapa; erro crítico.' },
  type: { tier: 'HIGH', reason: 'Tipo afeta filtros e camadas do mapa.' },
}

const MASS_SCHEDULE_FIELDS: Record<string, FieldRisk> = {
  startTime: { tier: 'HIGH', reason: 'Horário de missa; erro causa ausência de fiel.' },
  dayOfWeek: { tier: 'HIGH', reason: 'Dia da semana; equivalente ao horário.' },
  date: { tier: 'HIGH', reason: 'Data pontual de missa; crítico.' },
  kind: { tier: 'HIGH', reason: 'Tipo do horário (missa/confissão); afeta filtros.' },
  note: { tier: 'LOW', reason: 'Observação, texto livre, baixo impacto.' },
}

const ATTRIBUTE_FIELDS: Record<string, FieldRisk> = {
  acessibilidade: { tier: 'LOW', reason: 'Atributo booleano, reversível.' },
  estacionamento: { tier: 'LOW', reason: 'Atributo booleano, reversível.' },
  livraria: { tier: 'LOW', reason: 'Atributo booleano, reversível.' },
  adoracao: { tier: 'LOW', reason: 'Atributo booleano, reversível.' },
  confissao: { tier: 'LOW', reason: 'Atributo booleano, reversível.' },
  grupoJovens: { tier: 'LOW', reason: 'Atributo booleano, reversível.' },
  catequese: { tier: 'LOW', reason: 'Atributo booleano, reversível.' },
}

export function getFieldRisk(targetType: string, field: string): RiskTier {
  let map: Record<string, FieldRisk> | undefined
  if (targetType === 'Church') map = { ...CHURCH_FIELDS, ...ATTRIBUTE_FIELDS }
  if (targetType === 'MassSchedule') map = MASS_SCHEDULE_FIELDS

  return map?.[field]?.tier ?? 'HIGH'
}
