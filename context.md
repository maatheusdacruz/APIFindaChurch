# Contexto de Desenvolvimento — API "Paróquias" (descoberta de igrejas e missas)

> **Documento de contexto para construção incremental da API.**
> Stack: **TypeScript · Next.js (Route Handlers) · Prisma · PostgreSQL + PostGIS (Docker) · Swagger/OpenAPI**.

---

## 0. Como usar este documento (execução faseada)

Este projeto **não deve ser implementado de uma vez**. Ele está dividido em **5 fases** (0 a 4). Cada fase é uma unidade entregável, testável e que pode ser validada de forma independente antes de avançar.

**Regras de execução:**

1. Implemente **uma fase por vez**, na ordem. Não comece a Fase N+1 antes de a Fase N atender seus *critérios de aceite*.
2. Ao iniciar uma fase, leia primeiro: a seção **2 (stack)**, **3 (convenções)** e **4 (modelo de dados)** — elas são transversais e valem para todas as fases.
3. Cada fase só adiciona ao modelo de dados o que ela precisa. Não crie tabelas de fases futuras "por antecipação".
4. Ao final de cada fase, atualize o **Checklist de progresso (seção 7)** e gere/atualize a documentação Swagger.
5. As **decisões pendentes (seção 6)** que afetam uma fase devem ser confirmadas com o time **antes** de codar aquela fase. Onde não houver decisão, use o valor default sugerido e deixe-o **configurável por variável de ambiente** (não hard-coded).

**Mapa rápido das fases:**

| Fase | Tema | Entrega central |
|---|---|---|
| 0 | Fundação | Projeto, Docker, Prisma, PostGIS, Swagger, padrões de erro/validação |
| 1 | Núcleo de descoberta | Igrejas, busca geográfica, perfil, "Missa Agora" |
| 2 | Frescor dos dados | Enriquecimento, sugestão de correção, micro-feedback, versionamento |
| 3 | Recorrência | Usuário, favoritos, notificações, check-in, descoberta em viagem |
| 4 | Comunidade e governança | Papéis, validação, consenso, denúncia, paróquia, mural |

---

## 1. O que a API precisa resolver

O produto responde, de forma geográfica e contextual, à pergunta **"que missa tem perto de mim agora?"** — em casa ou em viagem — e mantém os dados confiáveis ao longo do tempo.

Três premissas guiam a API:

- **Single-player primeiro.** A API tem que ser completa e útil para um usuário sozinho e passivo. Comunidade é teto, não piso. As Fases 0–2 não dependem de nenhuma participação coletiva.
- **Frescor sem comunidade.** A confiabilidade do dado se sustenta por *enriquecimento automático + micro-feedback + versionamento*, com governança humana entrando só na Fase 4.
- **Risco proporcional.** Tudo que é sensível (horário de missa, papéis de autoridade) tem validação e reversibilidade proporcionais ao alcance da ação. Isso é regra de negócio, não detalhe de implementação.

A base inicial tem **apenas nome + localização** das igrejas. Não há telefone, e-mail nem vínculo igreja↔paróquia. A API precisa funcionar bem com **dados parciais**, sinalizando frescor em vez de exibir informação possivelmente errada sem aviso (RNF09).

---

## 2. Stack e decisões técnicas

| Camada | Escolha | Observações |
|---|---|---|
| Linguagem | **TypeScript** (strict) | `strict: true`, sem `any` implícito. |
| Runtime/API | **Next.js (App Router, Route Handlers)** | API em `app/api/**/route.ts`. O mesmo app serve futuramente as páginas web por igreja (RF16/RF17), então Next é também o renderizador SSR dessas páginas. |
| ORM | **Prisma** | Migrações versionadas. PostGIS via SQL bruto onde o Prisma não cobre (ver §3.6). |
| Banco | **PostgreSQL + PostGIS** | PostGIS é obrigatório para proximidade/raio (RF01, RF09, RNF01, RNF08). Roda em Docker. |
| Infra dev | **Docker Compose** | Serviços: `db` (postgres+postgis), `app`. |
| Validação | **Zod** | Schemas de entrada/saída são a fonte única de verdade. |
| Docs | **OpenAPI 3 + Swagger UI** | Spec gerada a partir dos schemas Zod (`zod-to-openapi`), servida em `/api/docs`. |

**Decisões fixadas aqui (resolvem DP4):**

- Imagem do banco: `postgis/postgis:16-3.4` (ou compatível). A extensão é habilitada por migração (`CREATE EXTENSION IF NOT EXISTS postgis;`).
- Geometria: coordenadas guardadas como `lat`/`lng` (Decimal) **e** uma coluna `geography(Point, 4326)` derivada, com índice **GiST**. Consultas de proximidade usam `ST_DWithin` / `ST_Distance` via `prisma.$queryRaw`.
- Swagger é gerado, não escrito à mão: cada endpoint registra seu schema Zod num *registry* OpenAPI.
- IDs públicos: as igrejas têm um identificador curto/estável para o link universal (`paroquias.app/i/987654`). Internamente pode ser `id` autoincrement/cuid; o **slug público** é separado e imutável.

---

## 3. Arquitetura e convenções (transversal a todas as fases)

### 3.1 Estrutura de pastas (alvo)

```
/app
  /api
    /churches/route.ts            # GET lista/busca
    /churches/[id]/route.ts       # GET perfil
    /churches/near/route.ts       # GET proximidade
    /mass/now/route.ts            # GET "Missa Agora"
    /docs/route.ts                # Swagger UI + /api/docs/openapi.json
/src
  /modules
    /church/{ controller, service, repository, schema }.ts
    /mass/...
    /suggestion/...
    ...
  /lib
    prisma.ts            # singleton PrismaClient
    geo.ts               # helpers PostGIS / haversine
    http.ts              # envelope de resposta, handler de erro, withValidation
    openapi.ts           # registry + geração do spec
    errors.ts            # classes de erro de domínio
  /config/env.ts         # leitura/validação de env com Zod
/prisma
  schema.prisma
  /migrations
  seed.ts
docker-compose.yml
```

Handlers (route) ficam **finos**: validam entrada → chamam *service* → formatam saída. Regra de negócio vive no *service*; acesso a dados no *repository*.

### 3.2 Formato de resposta

Sucesso:
```json
{ "data": <payload>, "meta": { "page": 1, "pageSize": 20, "total": 134 } }
```
Erro (formato único em toda a API):
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [ … ] } }
```
Um *wrapper* central captura exceções de domínio (`NotFoundError`, `ValidationError`, `ForbiddenError`, `ConflictError`) e as converte para HTTP (404/400/403/409). Nada de stack trace vazando em produção.

### 3.3 Validação

Toda entrada (query, body, params) passa por um schema Zod antes de chegar ao service. O mesmo schema alimenta o Swagger. Saídas relevantes também têm schema de resposta para documentação.

### 3.4 Paginação

Listas usam `page` + `pageSize` (default 20, máx. 100) e retornam `meta.total`. Buscas geográficas paginam por **distância crescente**, não por offset arbitrário.

### 3.5 Autenticação (evolução por fase)

- **Fases 0–2:** leitura é pública. Escrita (sugestão/feedback) é **anônima com identidade leve**: um `deviceId`/token anônimo gerado no cliente, sem login. Sem painel, sem senha.
- **Fase 3:** usuário anônimo/dispositivo vira entidade persistida (favoritos, push token, check-in). Ainda sem autenticação pesada.
- **Fase 4:** autenticação real (sessão/JWT) entra **só** para papéis (guardião/admin) e ações de governança. Autorização por papel + escopo (1 igreja / 1 paróquia / global).

Não implemente auth da Fase 4 antes da hora.

### 3.6 Geoespacial (PostGIS) — convenção

- Tabela `Church` tem `lat Decimal`, `lng Decimal` e `geom geography(Point,4326)` (mantida em sincronia por trigger ou na escrita).
- Índice: `CREATE INDEX church_geom_gix ON "Church" USING GIST (geom);`
- Proximidade (exemplo conceitual, via `$queryRaw`):
  ```sql
  SELECT id, name, ST_Distance(geom, ST_MakePoint($lng,$lat)::geography) AS distance_m
  FROM "Church"
  WHERE ST_DWithin(geom, ST_MakePoint($lng,$lat)::geography, $radius_m)
  ORDER BY distance_m ASC
  LIMIT $limit;
  ```
- O Prisma mapeia `geom` como `Unsupported("geography(Point, 4326)")`; ela nunca é lida/escrita pelo client Prisma diretamente, só via SQL.

### 3.7 Frescor (freshness) — modelo transversal

Campos de alto valor (sobretudo **horário de missa**) carregam metadados de frescor: `lastConfirmedAt`, `source` (enrichment | user_feedback | suggestion | admin | guardian), `confidence`. O perfil da igreja (RF13) e o app expõem isso como "atualizado há X". Resiliência (RNF09): nunca apague o dado por estar velho; **sinalize**.

### 3.8 Risco de edição (RN04/RN05) — modelo transversal

Toda alteração de dado é classificada por risco:

- **Baixo risco** (foto, texto de descrição): aplica direto.
- **Alto risco** (horário de missa, atributos críticos): **não** sobrescreve direto; entra como *sugestão pendente* e só vira efetiva por confirmação (na Fase 2, confirmação simples/manual leve; na Fase 4, por consenso ponderado por reputação).

A classificação risco-por-campo deve ser **uma tabela de configuração**, não `if` espalhado pelo código. Isso já é preparado na Fase 2, mesmo que o consenso completo só chegue na Fase 4.

### 3.9 Versionamento/auditoria (RF25 / RNF04)

**Toda** mutação de dado de igreja/missa gera um registro em `Revision` (entidade, id, campo, valor antigo, valor novo, autor, origem, timestamp). É a base de reversão (RN07/RN08). Implementado na Fase 2 e usado por todas as fases seguintes.

---

## 4. Modelo de dados (visão geral e evolução por fase)

O schema cresce por fase. Abaixo, o **alvo final** agrupado por fase de introdução. Cada fase implementa só os seus blocos.

**Fase 1 — descoberta**
- `Church` — id, publicSlug, name, type (`IGREJA|CAPELA|BASILICA|SANTUARIO|MOSTEIRO|SEMINARIO`), lat, lng, geom, address... , phone?, photoUrl?, createdAt, updatedAt.
- `MassSchedule` — churchId, kind (`MISSA|CONFISSAO|ADORACAO`), dayOfWeek (0–6) ou date pontual, startTime, note?, lastConfirmedAt, source, confidence, validFrom?, validTo?.
- `ChurchAttribute` — churchId + flags (acessibilidade, estacionamento, livraria, adoração, confissão, grupo de jovens, catequese). (Tabela 1:1 ou JSONB; preferir colunas booleanas nomeadas.)
- `Event` — churchId, title, description?, startsAt, endsAt?.

**Fase 2 — frescor**
- `Suggestion` — targetType, targetId, field, currentValue, proposedValue, riskTier, status (`PENDING|APPLIED|REJECTED|IN_REVIEW`), source (`APP|WHATSAPP|TELEGRAM|FORM|ENRICHMENT`), submittedByRef, confidence, createdAt.
- `Revision` — entity, entityId, field, oldValue, newValue, changedByRef, source, reversibleOf?, createdAt.
- `Feedback` — targetType, targetId (tipicamente um MassSchedule), value (`CONFIRM|DENY`), deviceRef, createdAt.
- `EnrichmentSource` / `EnrichmentJob` — origem (google_places, site, facebook, diocese), status, payload bruto, matchedChurchId, coverage/qualidade.

**Fase 3 — recorrência**
- `User` — id, deviceId (anônimo), createdAt, pushToken?, reputation (default base), (account opcional futuramente).
- `Favorite` — userId, churchId.
- `CheckIn` — userId, churchId, massScheduleId?, createdAt. (Sem ranking; só agregados.)
- `ScheduledNotification` / `NotificationPreference` — userId, churchId/massRef, fireAt, kind, status.

**Fase 4 — comunidade e governança**
- `Parish` — id, name, claimedByAdminId?, status.
- `ChurchParish` — vínculo igreja↔paróquia, reversível/contestável.
- `GuardianRole` — userId, churchId, status (`ACTIVE|FROZEN|REMOVED`), behavioralScore.
- `AdminRole` — userId, parishId, validationLevel, status.
- `Report` — denúncia: targetType, targetId, reporterRef, reason, createdAt. (Gatilho de congelamento RN08.)
- `Endorsement` — endossos entre usuários/papéis (RN01/RN02).
- `ConsensusState` — para campo de alto risco em revisão: votos, peso, limiar, resultado.
- `MuralPost` — churchId, type (aviso|evento|pedido|campanha), content, authorId, createdAt.
- (Opcional) `DiscoveryBadge` / `Route` / `ActivityAggregate` para gamificação/rotas/heatmap (RF29–RF31).

---

## 5. Fases

Cada fase declara: **Objetivo**, **Requisitos cobertos**, **Modelo de dados (delta)**, **Endpoints**, **Critérios de aceite** e **Fora desta fase**.

---

### Fase 0 — Fundação

**Objetivo.** Ter um esqueleto que sobe com `docker compose up`, conecta no Postgres+PostGIS, roda migração e serve Swagger, com padrões de erro/validação/resposta já implementados. Sem regra de negócio ainda.

**Requisitos cobertos.** Base para RNF01, RNF02, RNF04; DP4 (stack).

**Modelo de dados (delta).** Nenhuma tabela de domínio. Apenas: migração que habilita `postgis`, e uma migração inicial vazia/estrutural. Opcional: tabela `HealthCheck` ou nenhuma.

**Endpoints.**
- `GET /api/health` — retorna status do app e do banco (incluindo `SELECT postgis_version()`).
- `GET /api/docs` — Swagger UI.
- `GET /api/docs/openapi.json` — spec OpenAPI gerado.

**Entregáveis técnicos.**
- `docker-compose.yml` com `db` (postgis) e `app`.
- `prisma/schema.prisma` configurado; `prisma migrate` funcionando; extensão PostGIS criada por migração.
- `src/lib`: `prisma.ts`, `http.ts` (envelope + error handler + `withValidation`), `errors.ts`, `openapi.ts`, `config/env.ts` (validação de env por Zod).
- `seed.ts` com estrutura para importar a base nacional (nome + lat/lng) — pode rodar com um CSV de amostra.

**Critérios de aceite.**
- `docker compose up` sobe tudo; `GET /api/health` retorna 200 com versão do PostGIS.
- Uma rota de exemplo com input inválido retorna o **formato de erro padrão** (400).
- Swagger UI carrega em `/api/docs` e lista pelo menos o health.

**Fora desta fase.** Qualquer endpoint de igreja/missa, qualquer auth, qualquer enriquecimento.

---

### Fase 1 — Núcleo de descoberta

**Objetivo.** Entregar o valor central single-player: achar igrejas perto, ver o perfil com horários e frescor, e descobrir "que missa começa logo perto de mim".

**Requisitos cobertos.** RF01–RF07 (lado servidor), RF09, RF10–RF13. Mapa/marcadores/cluster são do cliente; a API fornece os dados (lista por bbox/raio, atributos, próxima missa, frescor).

**Modelo de dados (delta).** `Church`, `MassSchedule`, `ChurchAttribute`, `Event`. Coluna `geom` + índice GiST + sincronização lat/lng→geom. Importar base real (nome+localização) via seed.

**Endpoints.**

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/churches` | Lista com filtros: `type[]` (camadas RF06), `bbox` (mapa), `q` (nome), paginação. |
| GET | `/api/churches/near` | Proximidade: `lat`, `lng`, `radius_m`, `kind?` (missa/confissao/adoracao), ordenado por distância (RF03/RF07/lista por distância). |
| GET | `/api/churches/:id` | Perfil completo: horários, atributos, foto, endereço, distância (se lat/lng na query), telefone se houver, **indicador de frescor** (RF10–RF13). |
| GET | `/api/churches/:id/events` | Próximos eventos (RF12). |
| GET | `/api/mass/now` | **Missa Agora**: missas começando em até `window_min` (default 60), `lat`/`lng` obrigatórios, ordenadas por proximidade+horário (RF09). |

**Regras de cálculo.**
- "Próxima missa" por igreja: menor `startTime` futuro considerando `dayOfWeek`/data e fuso (America/Sao_Paulo).
- Frescor (RF13): derivado de `lastConfirmedAt`/`source` do `MassSchedule` mais relevante.
- Estado do marcador (RF02) é responsabilidade do cliente, mas a API entrega os insumos (próxima missa, é favorita?, há evento especial?).

**Critérios de aceite.**
- `GET /api/churches/near?lat=..&lng=..&radius_m=2000` retorna igrejas ordenadas por distância real (PostGIS), com `distance_m`.
- `GET /api/mass/now` devolve só missas dentro da janela, ordenadas corretamente, com frescor.
- Perfil expõe frescor e lida com dados parciais (telefone ausente não quebra).
- Consulta de proximidade usa índice GiST (verificável por `EXPLAIN`).

**Fora desta fase.** Favoritos persistidos (só insumo de "é favorita" se já houver user — ainda não há; tratar como vazio), sugestões/feedback, notificações, viagem.

---

### Fase 2 — Frescor: enriquecimento, correção e versionamento

**Objetivo.** Sustentar a confiabilidade do dado **sem comunidade**: pipeline de enriquecimento, correção colaborativa leve, micro-feedback de um toque, e versionamento de tudo (base de reversão).

**Requisitos cobertos.** RF21–RF25; regra de risco RN04 (versão inicial); RNF04, RNF09; trata DP3 (medir cobertura do enriquecimento) e DP5 só na medida em que registra fontes.

**Modelo de dados (delta).** `Suggestion`, `Revision`, `Feedback`, `EnrichmentSource`, `EnrichmentJob`. Tabela de **classificação de risco por campo** (config). Adicionar a toda escrita de `Church`/`MassSchedule` a gravação automática de `Revision`.

**Endpoints.**

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/churches/:id/suggestions` | Sugerir correção de um campo (RF22). Classifica risco; baixo aplica direto + Revision, alto vira `PENDING`. |
| POST | `/api/mass/:massId/feedback` | Micro-feedback um toque: confirma/nega horário (RF23). Atualiza `lastConfirmedAt`/confidence; acúmulo de `DENY` baixa confiança e pode abrir sugestão. |
| GET | `/api/churches/:id/revisions` | Histórico versionado (RF25). |
| POST | `/api/admin/revisions/:id/revert` | Reversão (backstop manual; RN07). Protegido por chave de admin de plataforma. |
| POST | `/api/ingest/enrichment` | Ingestão de dados enriquecidos (Google Places, sites, diocese) → cria/atualiza campos como `Suggestion`/`Revision` com source=ENRICHMENT (RF21). |
| POST | `/api/ingest/message` | Webhook WhatsApp/Telegram/formulário (RF24): texto livre → interpretado → vira `Suggestion`, sem login. |

**Regras.**
- Risco por campo (RN04): `photoUrl`, `description` = baixo; `MassSchedule.startTime`, atributos críticos = alto. Tudo configurável (DP1 fica como threshold de confiança).
- Enriquecimento (RF21): registrar **cobertura e qualidade** por fonte para medição (atende DP3). Telefone via Google Places é hipótese a medir, não certeza.
- Versionamento: nenhuma mutação de dado de domínio sem `Revision` correspondente.

**Critérios de aceite.**
- Sugestão de campo de baixo risco aplica e gera Revision; de alto risco fica pendente sem sobrescrever.
- Micro-feedback de "sim" atualiza frescor; sequência de "não" derruba confiança conforme limiar configurável.
- Webhook de mensagem transforma texto em sugestão estruturada.
- `revert` restaura o valor anterior a partir do histórico.
- Relatório simples de cobertura do enriquecimento por fonte.

**Fora desta fase.** Consenso ponderado por reputação, papéis, denúncia automática — isso é Fase 4. Aqui a confirmação de alto risco é **manual leve** (operação da plataforma).

---

### Fase 3 — Recorrência: usuário, favoritos, notificações, viagem

**Objetivo.** Transformar consulta única em hábito: identidade leve do usuário, favoritos, notificações acionáveis, check-in opcional e descoberta automática em viagem.

**Requisitos cobertos.** RF08, RF18–RF20, RF26, RF27; privacidade RNF03; push RNF06.

**Modelo de dados (delta).** `User` (deviceId anônimo, pushToken), `Favorite`, `CheckIn`, `ScheduledNotification`/`NotificationPreference`. Agregados de atividade derivados de `CheckIn` (sem expor indivíduo).

**Endpoints.**

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/users` | Registra usuário anônimo por `deviceId`; retorna token leve. |
| PUT | `/api/users/me/push-token` | Registra/atualiza token de push. |
| POST/DELETE | `/api/users/me/favorites/:churchId` | Favoritar/desfavoritar (RF26). |
| GET | `/api/users/me/favorites` | Lista favoritas. |
| POST | `/api/churches/:id/checkin` | Check-in opcional, sem ranking (RF27); alimenta agregados. |
| GET | `/api/churches/:id/activity` | Indicadores agregados: missa confirmada hoje, movimento, última atividade (RNF03 — só agregado). |
| POST | `/api/notifications/reminders` | Agenda lembrete (RF18–RF20); "Lembrar" 1h/30min/10min antes (RF20). |
| GET | `/api/discovery/travel` | Detecção de cidade nova por `lat`/`lng`: destaca basílicas, santuários, paróquias e missas próximas (RF08). |

**Regras.**
- Notificação acionável (RF19): payload com ações Visitar/Compartilhar/Lembrar (renderização é do cliente; a API entrega dados + agenda reminders).
- Privacidade (RNF03): `activity` nunca retorna identidades; só contagens/flags agregadas.
- "Visitar"/"Compartilhar" (RF14–RF17) são deep links/share montados no cliente; a API fornece os campos (endereço, próxima missa, slug/link universal).

**Critérios de aceite.**
- Favoritar é idempotente e por usuário.
- Reminder agendado dispara metadado correto nos três offsets.
- `discovery/travel` muda o conjunto retornado quando a cidade muda.
- `activity` não vaza dado individual.

**Fora desta fase.** Qualquer papel/autoridade, mural, consenso.

---

### Fase 4 — Comunidade e governança

**Objetivo.** Ativar as camadas colaborativas **só onde a participação aparecer**: papéis (guardião/admin), paróquia, validação, consenso ponderado, denúncia com congelamento, mural. Aqui mora a "máquina pesada de moderação".

**Requisitos cobertos.** RF24 (consolidado), RF28–RF31; RN01–RN12; auditabilidade RNF04. Resolve DP1/DP2 (limiares e transição).

**Modelo de dados (delta).** `Parish`, `ChurchParish`, `GuardianRole`, `AdminRole`, `Report`, `Endorsement`, `ConsensusState`, `MuralPost`, `Reputation` (campo/derivado em User), e opcionais de gamificação (`DiscoveryBadge`, `Route`, `ActivityAggregate`). **Autenticação real** entra aqui para papéis.

**Endpoints (principais).**

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/churches/:id/guardian/claim` | Reivindica guardião; validação comportamental (RN02): presença/check-in, geo recorrente, idade da conta, acerto de sugestões, endosso. |
| POST | `/api/parishes/claim` | Reivindica paróquia (RN01): canal verificado / diocese / presença física + cooldown + endosso → admin provisório→definitivo. |
| POST | `/api/parishes/:id/churches` | Admin declara igrejas da paróquia (RN10/RN11); anexação reversível/contestável. |
| POST | `/api/churches/:id/contest` | Guardião contesta absorção (RN12). |
| POST | `/api/reports` | Denúncia (RN08): acima de X, congela poderes do guardião e reverte edições do período — automático. |
| POST | `/api/suggestions/:id/vote` | Consenso (RN05/RN06): N confirmações independentes, peso por reputação; admin verificado = imediato. |
| CRUD | `/api/churches/:id/mural` | Mural (RF28): avisos, eventos, pedidos, campanhas. |
| — | rotas/gamificação/heatmap | RF29–RF31 (sub-fase opcional). |

**Regras-chave.**
- Força da validação ∝ inverso do alcance/reversibilidade da ação (princípio dos papéis). Validação fraca ⇒ poderes limitados e reversíveis; forte ⇒ amplos e definitivos.
- Botão de atrito por nº de guardiões (RN06): 1 guardião → ação sensível pede 1–2 confirmações; 2+ concordando → muda na hora; discordância → campo vai para "em revisão" (consenso), sem sobrescrita silenciosa.
- Reversibilidade total (RN07): nenhuma ação de guardião é irreversível/ampla.
- Reposição automática de guardião (RN09): promove o próximo frequentador mais confiável; admin é caminho adicional, não único.
- Migração validação manual→automática (RN03) só quando volume excede capacidade **e** sinais já se mostraram confiáveis.

**Decisões a fixar antes (DP1/DP2).** X denúncias para congelar; nº de confirmações de guardião solo; limiar de confiança para guardião automático; regra de transição guardião→admin na absorção. Defaults configuráveis por env.

**Critérios de aceite.**
- Denúncias acima do limiar congelam o guardião e revertem suas edições do período **sem** ação de admin.
- Edição de alto risco com guardiões em desacordo cai para "em revisão" em vez de sobrescrever.
- Consenso aplica peso por reputação; admin verificado aplica imediato.
- Anexação de igreja à paróquia é reversível e contestável.
- Toda ação de governança é auditável (Revision/Report/log).

**Fora desta fase.** Itens explicitamente fora do escopo do produto (rede social completa, streaming, pagamentos).

---

## 6. Decisões pendentes (e como tratá-las na API)

| ID | Decisão | Tratamento na API |
|---|---|---|
| DP1 | Limiares (denúncias p/ congelar; confirmações de guardião solo; confiança p/ guardião automático) | **Configuráveis por env**, com defaults; consumidos só na Fase 4. |
| DP2 | Transição guardião→admin na absorção | Modelar como estado reversível; default = manter guardião como ajudante endossado. Fase 4. |
| DP3 | Cobertura/qualidade real do enriquecimento | Medir na Fase 2 via `EnrichmentSource`/relatório de cobertura. |
| DP4 | Stack e infra geoespacial | **Resolvido neste documento** (§2). |
| DP5 | Monetização/sustentabilidade | Fora da API por ora; não bloqueia nenhuma fase. |

---

## 7. Checklist de progresso

**Fase 0 — Fundação**
- [x] Docker Compose (db postgis + app) sobe
- [x] Prisma + migração + extensão PostGIS
- [x] Envelope de resposta, handler de erro, validação Zod
- [x] Swagger em `/api/docs`
- [x] `GET /api/health` ok · seed estrutural

**Fase 1 — Núcleo de descoberta**
- [x] Modelos Church / MassSchedule / ChurchAttribute / Event + `geom`/GiST
- [x] `/churches`, `/churches/near`, `/churches/:id`, `/churches/:id/events`
- [x] `/mass/now` (Missa Agora)
- [x] Frescor no perfil · base nacional importada (seed de amostra; CSV real plugável via `SEED_CSV`)

**Fase 2 — Frescor**
- [ ] Suggestion / Revision / Feedback / Enrichment
- [ ] Classificação de risco por campo (config)
- [ ] `/suggestions`, `/feedback`, `/revisions`, `/revert`
- [ ] `/ingest/enrichment`, `/ingest/message`
- [ ] Versionamento em toda mutação · relatório de cobertura

**Fase 3 — Recorrência**
- [ ] User / Favorite / CheckIn / ScheduledNotification
- [ ] Favoritos, check-in, atividade agregada
- [ ] Reminders acionáveis (1h/30min/10min)
- [ ] Descoberta em viagem

**Fase 4 — Comunidade e governança**
- [ ] Auth real + papéis (guardião/admin)
- [ ] Paróquia / absorção / contestação
- [ ] Consenso ponderado · denúncia + congelamento automático
- [ ] Mural · (opcional) gamificação/rotas/heatmap
- [ ] Limiares DP1/DP2 fixados e configuráveis