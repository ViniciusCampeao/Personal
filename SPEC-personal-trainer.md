# Plataforma de Personal Trainer — Especificação Técnica

Documento de referência para implementação. Escopo: **Fase 1 + Fase 2**.
Financeiro, agenda e cobrança ficam **fora** desta rodada.

---

## 0. Regras do projeto

- Nasce para **um personal só**, mas **todo modelo tem `tenantId`** e todo acesso a dado passa por filtro de tenant. Não existe UI de gestão de tenants agora — o tenant é criado no seed. O objetivo é poder virar SaaS depois sem migration destrutiva.
- Nunca escrever query que acesse tabela com `tenantId` sem filtrar por ele. Isso é regra de arquitetura, não sugestão.
- Português brasileiro na UI. Código, nomes de tabela/coluna e commits em inglês.
- Nada de microserviço. Monolito modular NestJS.
- Sem prescrição de dieta em nenhum lugar (é privativo de nutricionista pelo CFN). Só registro alimentar, e nem isso nesta fase.

---

## 1. Stack

| Camada | Escolha |
|---|---|
| Backend | NestJS 10 (TypeScript, modular) |
| ORM | Prisma |
| Banco | PostgreSQL 16 |
| Cache/fila | Redis + BullMQ |
| Frontend | React 18 + Vite + TypeScript, PWA (`vite-plugin-pwa`) |
| Estado servidor | TanStack Query |
| Offline | Dexie (IndexedDB) + fila de outbox |
| UI | Tailwind + shadcn/ui |
| Gráficos | Recharts |
| Forms | React Hook Form + Zod (schemas compartilhados com o back) |
| Storage | MinIO (S3-compatible, presigned URLs) — trocável por R2 sem mudar código |
| Auth | JWT access (15 min, em memória) + refresh (7 dias, cookie httpOnly) |
| Push | Web Push (VAPID) |
| PDF | Puppeteer no worker |
| Testes | Jest (unit) + Supertest (e2e) + Testcontainers |
| Deploy | Docker Compose, atrás de Cloudflare Tunnel |

### Monorepo

```
/
├── apps/
│   ├── api/            # NestJS
│   └── web/            # React + Vite PWA
├── packages/
│   └── shared/         # tipos, schemas Zod, cálculos puros (e1RM, dobras)
├── docker-compose.yml
├── docker-compose.dev.yml
└── .env.example
```

Gerenciador: **pnpm workspaces**.

Os cálculos de e1RM, %gordura e volume ficam em `packages/shared/calc/` como **funções puras sem dependência**, usadas pelo back e pelo front (o front calcula offline).

---

## 2. Atores

- **TRAINER** — dono da conta. Cria alunos, monta programas, avalia, acompanha.
- **STUDENT** — executa treino, registra carga, preenche check-in e anamnese, vê evolução.
- **ADMIN** — só eu. Acesso a health check e métricas internas. Não é foco.

Um `User` tem um `role`. `STUDENT` sempre pertence a um `TRAINER` (`studentProfile.trainerId`).

---

## 3. Modelo de dados

Prisma schema (compacto — adicionar `@@index` nos FKs e nos campos usados em filtro).

```prisma
enum Role { ADMIN TRAINER STUDENT }
enum UserStatus { PENDING ACTIVE PAUSED ARCHIVED }
enum Sex { MALE FEMALE }
enum ExperienceLevel { BEGINNER INTERMEDIATE ADVANCED }
enum MuscleGroup {
  CHEST BACK SHOULDERS BICEPS TRICEPS FOREARMS
  QUADS HAMSTRINGS GLUTES CALVES ADDUCTORS ABDUCTORS
  ABS LOWER_BACK TRAPS NECK FULL_BODY CARDIO
}
enum MuscleRole { PRIMARY SECONDARY }
enum Equipment {
  BARBELL DUMBBELL MACHINE CABLE SMITH KETTLEBELL
  BODYWEIGHT BAND SUSPENSION MEDICINE_BALL CARDIO_MACHINE OTHER
}
enum MovementPattern {
  HORIZONTAL_PUSH VERTICAL_PUSH HORIZONTAL_PULL VERTICAL_PULL
  SQUAT HINGE LUNGE CARRY ROTATION ISOLATION CONDITIONING MOBILITY
}
enum LoadType { EXTERNAL BODYWEIGHT BODYWEIGHT_PLUS TIME DISTANCE NONE }
enum ProgramStatus { DRAFT ACTIVE FINISHED ARCHIVED }
enum Technique { NORMAL BISET TRISET CIRCUIT DROPSET REST_PAUSE CLUSTER AMRAP PYRAMID ISOMETRIC }
enum SetType { WARMUP WORK BACKOFF DROP FAILURE }
enum SessionStatus { IN_PROGRESS COMPLETED ABANDONED SKIPPED }
enum SkinfoldProtocol { NONE POLLOCK_3 POLLOCK_7 GUEDES FAULKNER }
enum PhotoPose { FRONT BACK SIDE_LEFT SIDE_RIGHT }
enum ConsentType { TERMS PRIVACY HEALTH_DATA PHOTO }
enum PrType { MAX_LOAD MAX_REPS EST_1RM MAX_SET_VOLUME }

model Tenant {
  id        String   @id @default(uuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
}

model User {
  id           String     @id @default(uuid())
  tenantId     String
  email        String
  passwordHash String?
  name         String
  phone        String?
  role         Role
  avatarKey    String?
  status       UserStatus @default(PENDING)
  lastLoginAt  DateTime?
  createdAt    DateTime   @default(now())
  deletedAt    DateTime?
  @@unique([tenantId, email])
}

model TrainerProfile {
  userId      String   @id
  cref        String?
  bio         String?
  specialties String[]
}

model StudentProfile {
  userId             String          @id
  tenantId           String
  trainerId          String
  birthDate          DateTime?
  sex                Sex?
  heightCm           Float?
  goal               String?
  experienceLevel    ExperienceLevel @default(BEGINNER)
  weeklyAvailability Int?            // dias/semana
  privateNotes       String?         // só o trainer vê
  startedAt          DateTime        @default(now())
}

model Invite {
  id         String    @id @default(uuid())
  tenantId   String
  trainerId  String
  email      String?
  phone      String?
  token      String    @unique
  expiresAt  DateTime
  acceptedAt DateTime?
  createdAt  DateTime  @default(now())
}

model Consent {
  id         String      @id @default(uuid())
  tenantId   String
  userId     String
  type       ConsentType
  version    String
  acceptedAt DateTime    @default(now())
  ip         String?
  userAgent  String?
  revokedAt  DateTime?
}

model Anamnesis {
  id           String   @id @default(uuid())
  tenantId     String
  studentId    String
  parq         Json     // 7 perguntas PAR-Q+, {questionKey: bool, note?}
  injuries     Json     // [{region, description, since, limitations}]
  conditions   String?
  medications  String?
  surgeries    String?
  smokes       Boolean  @default(false)
  alcohol      String?
  sleepHours   Float?
  trainingHistory String?
  notes        String?
  answeredAt   DateTime @default(now())
  version      Int      @default(1)
}

model MedicalClearance {
  id         String    @id @default(uuid())
  tenantId   String
  studentId  String
  fileKey    String
  issuedAt   DateTime?
  expiresAt  DateTime?
  verifiedAt DateTime?
  verifiedBy String?
}

// ---------- Biblioteca ----------

model Exercise {
  id              String          @id @default(uuid())
  tenantId        String?         // null = exercício global da base
  name            String
  slug            String
  description     String?
  instructions    String?
  cues            String[]        // dicas curtas de execução
  commonMistakes  String[]
  movementPattern MovementPattern
  equipment       Equipment
  loadType        LoadType        @default(EXTERNAL)
  unilateral      Boolean         @default(false)
  videoUrl        String?
  thumbKey        String?
  substitutionGroup String?       // exercícios com o mesmo valor são trocáveis entre si
  createdById     String?
  isActive        Boolean         @default(true)
  createdAt       DateTime        @default(now())
  @@unique([tenantId, slug])
}

model ExerciseMuscle {
  exerciseId String
  muscle     MuscleGroup
  role       MuscleRole
  @@id([exerciseId, muscle])
}

// ---------- Prescrição ----------

model Program {
  id              String        @id @default(uuid())
  tenantId        String
  trainerId       String
  studentId       String?       // null = template reutilizável
  isTemplate      Boolean       @default(false)
  sourceProgramId String?       // de onde foi duplicado
  name            String
  goal            String?
  notes           String?
  weeks           Int?
  startDate       DateTime?
  endDate         DateTime?
  status          ProgramStatus @default(DRAFT)
  createdAt       DateTime      @default(now())
}

model WorkoutDay {
  id               String  @id @default(uuid())
  programId        String
  label            String  // "A", "B", "Push"
  name             String? // "Peito e tríceps"
  orderIndex       Int
  notes            String?
  estimatedMinutes Int?
}

model PrescribedExercise {
  id             String     @id @default(uuid())
  workoutDayId   String
  exerciseId     String
  orderIndex     Int
  groupKey       String?    // exercícios com mesmo groupKey = bi-set/tri-set/circuito
  groupOrder     Int?
  technique      Technique  @default(NORMAL)
  restSeconds    Int?
  tempo          String?    // "3-1-1-0"
  notes          String?
  progressionRule Json?     // {type:"DOUBLE_PROGRESSION", incrementKg:2.5}
}

model PrescribedSet {
  id                   String  @id @default(uuid())
  prescribedExerciseId String
  setNumber            Int
  setType              SetType @default(WORK)
  repsMin              Int?
  repsMax              Int?
  targetLoadKg         Float?
  targetRir            Int?
  targetRpe            Float?
  targetSeconds        Int?
  targetDistanceM      Float?
  restSecondsOverride  Int?
}

// ---------- Execução ----------

model WorkoutSession {
  id              String        @id @default(uuid())
  tenantId        String
  studentId       String
  programId       String?
  workoutDayId    String?
  clientUuid      String        @unique  // idempotência do offline
  status          SessionStatus @default(IN_PROGRESS)
  startedAt       DateTime
  finishedAt      DateTime?
  durationSeconds Int?
  perceivedEffort Int?          // 1-10
  mood            Int?          // 1-5
  notes           String?
  totalVolumeKg   Float?        // denormalizado no fechamento
  syncedAt        DateTime?
}

model SessionExercise {
  id                     String  @id @default(uuid())
  sessionId              String
  prescribedExerciseId   String?
  exerciseId             String
  orderIndex             Int
  substitutedFromExerciseId String?
  substitutionReason     String?
  skipped                Boolean @default(false)
  notes                  String?
}

model SetLog {
  id                String   @id @default(uuid())
  sessionExerciseId String
  clientUuid        String   @unique
  setNumber         Int
  setType           SetType  @default(WORK)
  reps              Int?
  loadKg            Float?
  rir               Int?
  rpe               Float?
  seconds           Int?
  distanceM         Float?
  toFailure         Boolean  @default(false)
  estimated1rm      Float?   // calculado no save
  doneAt            DateTime
  notes             String?
}

model PersonalRecord {
  id         String   @id @default(uuid())
  tenantId   String
  studentId  String
  exerciseId String
  type       PrType
  value      Float
  reps       Int?
  setLogId   String?
  achievedAt DateTime
  @@unique([studentId, exerciseId, type])
}

// ---------- Avaliação ----------

model Assessment {
  id          String           @id @default(uuid())
  tenantId    String
  studentId   String
  trainerId   String
  assessedAt  DateTime
  protocol    SkinfoldProtocol @default(NONE)
  weightKg    Float?
  heightCm    Float?
  bmi         Float?
  bodyFatPct  Float?
  fatMassKg   Float?
  leanMassKg  Float?
  restingHr   Int?
  bloodPressure String?
  notes       String?
  createdAt   DateTime         @default(now())
}

model AssessmentMeasurement {
  id           String @id @default(uuid())
  assessmentId String
  site         String // NECK, CHEST, WAIST, ABDOMEN, HIP, ARM_R, ARM_L, FOREARM_R, ...
  valueCm      Float
}

model AssessmentSkinfold {
  id           String @id @default(uuid())
  assessmentId String
  site         String // TRICEPS, SUBSCAPULAR, CHEST, MIDAXILLARY, SUPRAILIAC, ABDOMINAL, THIGH
  valueMm      Float
}

model AssessmentPhoto {
  id           String    @id @default(uuid())
  assessmentId String
  pose         PhotoPose
  fileKey      String
  takenAt      DateTime  @default(now())
}

// ---------- Acompanhamento ----------

model CheckIn {
  id           String   @id @default(uuid())
  tenantId     String
  studentId    String
  weekStart    DateTime // segunda-feira da semana
  sleepQuality Int?     // 1-5
  energy       Int?
  soreness     Int?
  stress       Int?
  weightKg     Float?
  notes        String?
  createdAt    DateTime @default(now())
  @@unique([studentId, weekStart])
}

model SessionComment {
  id        String   @id @default(uuid())
  tenantId  String
  sessionId String
  authorId  String
  body      String
  createdAt DateTime @default(now())
  readAt    DateTime?
}

model PushSubscription {
  id        String   @id @default(uuid())
  tenantId  String
  userId    String
  endpoint  String   @unique
  p256dh    String
  auth      String
  userAgent String?
  createdAt DateTime @default(now())
}

model Notification {
  id        String    @id @default(uuid())
  tenantId  String
  userId    String
  type      String
  title     String
  body      String
  data      Json?
  readAt    DateTime?
  sentAt    DateTime?
  createdAt DateTime  @default(now())
}

model MediaAsset {
  id        String   @id @default(uuid())
  tenantId  String
  ownerId   String
  key       String   @unique
  mime      String
  sizeBytes Int
  kind      String   // AVATAR, EXERCISE_VIDEO, ASSESSMENT_PHOTO, MEDICAL_DOC, FORM_VIDEO
  createdAt DateTime @default(now())
}

model AuditLog {
  id          String   @id @default(uuid())
  tenantId    String
  actorId     String?
  action      String   // READ_SENSITIVE, EXPORT, DELETE_ACCOUNT, ...
  entity      String
  entityId    String?
  isSensitive Boolean  @default(false)
  ip          String?
  createdAt   DateTime @default(now())
}
```

**Decisão importante:** `PrescribedSet` (o que foi mandado) e `SetLog` (o que foi feito) são tabelas separadas de propósito. Não juntar. Todo o valor do histórico e da progressão vem dessa diferença.

---

## 4. Módulos do backend

```
apps/api/src/
├── common/          # guards, interceptors, filtros, decorators
│   ├── tenant/      # TenantContext (AsyncLocalStorage) + Prisma extension
│   ├── auth/        # JwtGuard, RolesGuard, @CurrentUser()
│   └── audit/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── students/
│   ├── invites/
│   ├── anamnesis/
│   ├── exercises/
│   ├── programs/
│   ├── sessions/
│   ├── progress/
│   ├── assessments/
│   ├── check-ins/
│   ├── media/
│   ├── notifications/
│   ├── reports/     # PDF
│   └── health/
└── jobs/            # BullMQ workers
```

### Isolamento de tenant

Usar **Prisma Client Extension** que injeta `tenantId` em todo `where` e todo `create`, lendo de um `AsyncLocalStorage` populado por middleware a partir do JWT. Models sem `tenantId` (Tenant, Exercise global) ficam numa allowlist explícita.

Isso não substitui autorização: um `STUDENT` só acessa os próprios dados, um `TRAINER` só acessa alunos onde `studentProfile.trainerId = user.id`. Guard dedicado (`OwnsStudentGuard`).

---

## 5. Endpoints

Prefixo `/api/v1`. Tudo com validação Zod/class-validator e paginação cursor-based nas listagens.

**Auth**
```
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
POST   /auth/forgot-password
POST   /auth/reset-password
GET    /auth/me
```

**Convite e onboarding**
```
POST   /invites                      (trainer) gera link + QR
GET    /invites/:token               público, valida
POST   /invites/:token/accept        cria usuário, aceita termos
```

**Alunos**
```
GET    /students                     lista com filtros (status, busca, "sumidos")
POST   /students
GET    /students/:id
PATCH  /students/:id
DELETE /students/:id                 soft delete
GET    /students/:id/overview        card resumo: aderência, PRs, último treino, próximo treino
```

**Anamnese**
```
GET    /students/:id/anamnesis
POST   /students/:id/anamnesis       cria nova versão (nunca sobrescreve)
POST   /students/:id/medical-clearance
```

**Exercícios**
```
GET    /exercises                    ?q=&muscle=&equipment=&pattern=&scope=global|custom|all
POST   /exercises                    custom do tenant
GET    /exercises/:id
PATCH  /exercises/:id
GET    /exercises/:id/substitutes    mesmo substitutionGroup / mesmo padrão+músculo primário
```

**Programas**
```
GET    /programs                     ?studentId=&isTemplate=
POST   /programs
GET    /programs/:id                 árvore completa (days > exercises > sets)
PATCH  /programs/:id
POST   /programs/:id/duplicate       body: {studentId?, asTemplate?}
POST   /programs/:id/activate        desativa o programa ativo anterior do aluno
DELETE /programs/:id

POST   /programs/:id/days
PATCH  /days/:id
DELETE /days/:id
PUT    /days/:id/exercises           bulk: substitui a lista inteira (drag-and-drop salva assim)
```

**Sessão de treino**
```
GET    /me/today                     treino do dia + últimas cargas pré-preenchidas
POST   /sessions                     idempotente por clientUuid
GET    /sessions/:id
POST   /sessions/:id/sets            idempotente por clientUuid
PATCH  /sessions/:id/exercises/:seId/substitute
POST   /sessions/:id/finish
POST   /sessions/sync                lote do outbox offline
GET    /students/:id/sessions        histórico
POST   /sessions/:id/comments
```

**Progresso**
```
GET    /students/:id/progress/exercises/:exerciseId   série temporal: carga, e1RM, volume
GET    /students/:id/progress/volume                  ?groupBy=week&muscle=
GET    /students/:id/progress/adherence               ?weeks=12
GET    /students/:id/records
GET    /students/:id/progression-suggestions          próximas cargas sugeridas
```

**Avaliação**
```
GET    /students/:id/assessments
POST   /students/:id/assessments      calcula %BF, massa magra, IMC no servidor
GET    /assessments/:id
GET    /assessments/compare?a=&b=     diff numérico + fotos lado a lado
POST   /assessments/:id/photos        presigned upload
GET    /assessments/:id/pdf
```

**Check-in**
```
GET    /me/check-in/current
POST   /me/check-in
GET    /students/:id/check-ins
```

**Mídia**
```
POST   /media/presign                {kind, mime, sizeBytes} -> {uploadUrl, key}
GET    /media/:key/url               URL assinada, expira em 5 min
```

**Notificações**
```
POST   /push/subscribe
DELETE /push/subscribe
GET    /notifications
POST   /notifications/:id/read
```

---

## 6. Regras de negócio

### Pré-preenchimento de carga
Ao abrir o treino do dia, para cada exercício prescrito buscar o último `SetLog` daquele aluno naquele exercício e pré-preencher carga e reps. É o que faz o app ser usável na academia.

### Sugestão de progressão (dupla progressão)
Se na última sessão o aluno completou **todas as séries de trabalho** no topo da faixa de reps **e** o RIR reportado foi ≥ o alvo:
- membros inferiores / composto pesado: sugerir **+5%**
- membros superiores / isolado: sugerir **+2.5%**
Arredondar para o múltiplo de 2.5 kg (barra) ou 1 kg (halter/máquina).
Se falhou a faixa mínima em 2 sessões seguidas: sugerir **−10%** e recomeçar.
A sugestão é **sugestão** — aparece como chip clicável, nunca força a carga.

### Substituição de exercício
Só permite trocar por exercício do mesmo `substitutionGroup`, ou (fallback) mesmo `movementPattern` + mesmo músculo primário. Registra `substitutedFromExerciseId` e o motivo. O gráfico de progressão do exercício original **não** incorpora o substituto.

### Aderência
`sessões concluídas / sessões esperadas na semana`, onde esperadas = nº de `WorkoutDay` do programa ativo. Semana começa na segunda.

### Aluno em risco (dashboard do trainer)
Marcar como risco quem tiver:
- nenhuma sessão há ≥ 10 dias, **ou**
- aderência < 50% nas últimas 3 semanas, **ou**
- e1RM estagnado ou em queda em ≥ 60% dos exercícios principais nas últimas 6 semanas, **ou**
- check-in com soreness ou stress ≥ 4 por 2 semanas seguidas

### PR
Recalcular no `finish` da sessão, não a cada série. Job assíncrono. Se bater PR, gerar notificação.

---

## 7. Cálculos (em `packages/shared/calc`, com teste unitário)

```
e1RM (Epley):    load × (1 + reps / 30)
e1RM (Brzycki):  load × 36 / (37 − reps)
```
Usar Epley como padrão. Só calcular para reps entre 1 e 12; acima disso a estimativa é lixo — retornar `null`.

```
Volume da série = reps × loadKg
Tonelagem da sessão = Σ volume das séries WORK e BACKOFF (warmup não conta)
```

**Densidade corporal — Pollock 3 dobras**
- Homem (peitoral, abdominal, coxa):
  `Dc = 1.10938 − 0.0008267·Σ + 0.0000016·Σ² − 0.0002574·idade`
- Mulher (tríceps, suprailíaca, coxa):
  `Dc = 1.0994921 − 0.0009929·Σ + 0.0000023·Σ² − 0.0001392·idade`

**Pollock 7 dobras** (subescapular, tríceps, peitoral, axilar média, suprailíaca, abdominal, coxa)
- Homem: `Dc = 1.112 − 0.00043499·Σ + 0.00000055·Σ² − 0.00028826·idade`
- Mulher: `Dc = 1.097 − 0.00046971·Σ + 0.00000056·Σ² − 0.00012828·idade`

**Siri:** `%G = (4.95 / Dc − 4.50) × 100`

**Faulkner** (tríceps, subescapular, suprailíaca, abdominal): `%G = Σ × 0.153 + 5.783`

```
massaGorda  = peso × %G / 100
massaMagra  = peso − massaGorda
IMC         = peso / (altura_m)²
```

Validar entradas: idade obrigatória para Pollock, todas as dobras do protocolo presentes, senão erro 422 explicando qual falta.

---

## 8. Frontend — telas

### Aluno (mobile-first, é onde o app é usado de verdade)

| Tela | Conteúdo |
|---|---|
| Home | Treino de hoje (card grande), streak, aderência da semana, último PR |
| **Execução** | A tela mais importante. Ver detalhamento abaixo |
| Histórico | Lista de sessões, filtro por dia de treino |
| Progresso | Seletor de exercício → gráfico de carga/e1RM; volume por grupo muscular |
| Avaliações | Timeline, comparação de fotos com slider, gráficos de peso e %BF |
| Check-in | 5 sliders + peso, uma vez por semana, notificação na segunda |
| Perfil | Dados, anamnese, atestado, termos aceitos, exportar meus dados, excluir conta |

### Tela de execução — requisitos duros

- Um exercício por vez, séries em lista vertical
- Alvos aparecem esmaecidos como placeholder; o aluno confirma ou corrige
- Botão de concluir série ocupando largura total, mínimo 56px de altura
- Timer de descanso dispara sozinho ao concluir a série, com vibração e som ao terminar. Continua contando com a tela bloqueada
- Steppers de +/− para carga (passo 2.5 kg) e reps (passo 1) — teclado numérico é o último recurso
- Acesso ao vídeo do exercício em 1 toque, fecha em 1 toque
- Botão de trocar exercício sempre visível
- Barra de progresso da sessão no topo
- **Funciona 100% sem rede**
- Wake lock ativo durante a sessão

### Trainer (desktop-first, mas responsivo)

| Tela | Conteúdo |
|---|---|
| Dashboard | Alunos em risco, treinos feitos hoje, PRs da semana, check-ins pendentes |
| Alunos | Tabela com aderência, último treino, próxima avaliação; busca e filtros |
| Ficha do aluno | Abas: Programa, Histórico, Progresso, Avaliações, Check-ins, Anamnese |
| **Editor de programa** | Coluna de dias + drag-and-drop de exercícios; painel lateral com biblioteca e busca; editar séries em grid tipo planilha; agrupar em bi-set arrastando um sobre o outro |
| Biblioteca | CRUD de exercícios custom, upload de vídeo |
| Templates | Programas salvos, duplicar para aluno |
| Avaliação | Formulário com o protocolo escolhido, cálculo em tempo real, upload de fotos |

O editor de programa é onde o trainer passa o tempo dele. Atalhos de teclado, duplicar série com um clique, copiar dia inteiro.

---

## 9. Offline (PWA)

- **Service worker** (Workbox): app shell em precache; vídeos e thumbs em `CacheFirst` com expiração; API em `NetworkFirst` exceto os endpoints de escrita.
- Ao abrir o app com rede, **pré-baixar o treino do dia inteiro** (exercícios, últimas cargas, thumbs) para o IndexedDB.
- Toda escrita durante a sessão vai para uma tabela `outbox` no Dexie com `clientUuid` gerado no cliente.
- Ao voltar a rede (`online` event + retry com backoff), envia `POST /sessions/sync` em lote.
- **Idempotência pelo `clientUuid`**: se o registro já existe, o servidor devolve 200 com o existente, não duplica.
- Conflito: **last-write-wins por sessão**, comparando `finishedAt`. Não implementar CRDT. Não vale a complexidade.
- Indicador visual de "X registros pendentes de sincronizar" no header.

---

## 10. LGPD

Anamnese, lesão, medicação, atestado e foto corporal são **dado pessoal sensível de saúde** (Art. 5º, II). Não é opcional:

1. Consentimento **específico e destacado** para dados de saúde e para fotos, separados do aceite de termos. Registrar versão, timestamp, IP e user-agent na tabela `Consent`.
2. Fotos e atestados **nunca** com URL pública. Só presigned URL com expiração de 5 minutos.
3. Criptografia em repouso nos campos de anamnese (pgcrypto ou cripto na aplicação com chave em env).
4. `GET /me/export` devolve JSON com todos os dados do usuário.
5. `DELETE /me` faz exclusão real (anonimiza o que precisa ser mantido, apaga mídia do storage) após confirmação e prazo de 7 dias.
6. `AuditLog` em todo acesso a anamnese, atestado e foto por quem não é o titular.
7. Retenção: fotos e avaliações por 5 anos após o fim do vínculo, depois apaga.
8. Textos de Termos de Uso e Política de Privacidade versionados em arquivo, servidos pela API.

---

## 11. Ordem de implementação

**M0 — Fundação**
Monorepo, Docker Compose (postgres, redis, minio, api, web), Prisma schema completo, migration inicial, seed de tenant + trainer + 2 alunos, CI rodando lint e teste.

**M1 — Auth e usuários**
Login, refresh, guards, tenant context, RBAC, convite de aluno com token, aceite com consentimento.

**M2 — Biblioteca de exercícios**
CRUD, busca com filtros, seed importando a Free Exercise DB (~800 exercícios) como globais, mapeando para os enums do projeto. Upload de vídeo custom via MinIO presigned.

**M3 — Programas**
CRUD completo da árvore, editor drag-and-drop, agrupamento bi-set/tri-set, templates, duplicação.

**M4 — Execução**
`/me/today`, tela de execução, timer, registro de séries, substituição, finalização, cálculo de e1RM e volume.

**M5 — Histórico e progressão**
Gráficos por exercício, volume por grupo muscular, aderência, PRs, sugestão de carga.

**M6 — Anamnese e avaliação física**
Formulário de anamnese, protocolos de dobras com cálculo, medidas, upload e comparação de fotos, PDF.

**M7 — Offline**
Service worker, Dexie, outbox, endpoint de sync, idempotência, indicador de pendências.

**M8 — Engajamento**
Web Push, treino do dia, lembrete de check-in, notificação de PR, check-in semanal, comentários do trainer na sessão, dashboard de alunos em risco.

Cada milestone tem que ficar deployável e testável isolado. Não começar o próximo com o anterior quebrado.

---

## 12. Critérios de aceite

- [ ] Nenhuma query acessa tabela com `tenantId` sem filtro — teste automatizado que varre o Prisma extension
- [ ] Um `STUDENT` recebe 403 ao tentar acessar dado de outro aluno (teste e2e)
- [ ] `TRAINER` recebe 403 em aluno que não é dele (teste e2e)
- [ ] Cálculos de e1RM e %BF com teste unitário contra valores de referência conhecidos
- [ ] Sessão de treino completa funciona com o wifi desligado e sincroniza ao reconectar sem duplicar série
- [ ] Enviar a mesma série duas vezes com o mesmo `clientUuid` cria um registro só
- [ ] Lighthouse PWA ≥ 90 e instalável no Android
- [ ] Tela de execução usável com uma mão, alvos de toque ≥ 48px
- [ ] Duplicar um programa de 4 dias e 30 exercícios leva < 3 segundos
- [ ] Foto de avaliação não é acessível por URL direta sem assinatura
- [ ] `docker compose up` sobe tudo e o seed deixa o sistema navegável

---

## 13. Fora de escopo (não implementar)

- Financeiro, planos, Pix, cobrança — fica pra parte separada
- Agenda e agendamento de aula
- Prescrição ou cálculo de dieta e macros
- Chat em tempo real (só comentário em sessão)
- App nativo
- Microserviços, GraphQL, event sourcing, CRDT
- Multi-idioma
- Painel de administração de tenants

---

## 14. Convenções

- Commits: Conventional Commits
- Branch: `main` protegida, feature branches
- Migrations sempre versionadas, nunca `db push` fora do dev
- Datas em UTC no banco, `America/Sao_Paulo` na apresentação
- Peso sempre em kg, medida em cm, dobra em mm — sem conversão de unidade
- IDs em UUID v4
- Erros no formato RFC 7807 (`application/problem+json`)
- Logs estruturados em JSON (pino), com `requestId` e `tenantId`
- `.env.example` sempre atualizado com toda variável nova
