# Plataforma de Personal Trainer

Monolito modular NestJS + PWA React, monorepo pnpm.
Especificação completa em [`SPEC-personal-trainer.md`](./SPEC-personal-trainer.md).

**Estado: completo.** Backend (M0–M8) e frontend (F1–F8) implementados: auth,
biblioteca de exercícios, programas, execução offline-first, avaliações, LGPD,
dashboard do trainer, editor de programas e PWA com Web Push. Além do escopo original:
dieta (plano + comentário do aluno/trainer), agenda (treinos e reuniões) e um painel
administrativo básico (`role: ADMIN`).
Guia de uso em [`docs/COMO-USAR.md`](./docs/COMO-USAR.md).

---

## Pré-requisitos

- Node 22+ e pnpm 11 (`corepack enable pnpm`)
- Docker com o plugin Compose v2 (`docker compose version`)

## Subir para desenvolver

```bash
cp .env.example .env          # ajuste as senhas
pnpm install

# só a infraestrutura; a API e o front rodam nativos, com reload
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis minio minio-init

pnpm db:migrate               # aplica a migration inicial
pnpm db:seed                  # tenant + trainer + 2 alunos
pnpm dev                      # API em :3000, web em :5173
```

Existe um `.env` só, na raiz. Os comandos do Prisma passam por `dotenv-cli` para
enxergá-lo de dentro de `apps/api`; dentro do Docker e no CI o arquivo não existe e as
variáveis vêm do ambiente, sem quebrar nada.

O front chama sempre `/api/v1` na mesma origem — em dev o proxy do Vite encaminha para a
API, em produção o nginx faz o mesmo. Não existe URL de API em build time.

## Subir a pilha inteira (como roda na VPS)

```bash
docker compose up -d --build
```

Sobe `postgres`, `redis`, `minio`, `api` e `web`. A API aplica as migrations no boot
(`RUN_MIGRATIONS=true`) e, se `RUN_SEED=true`, roda o seed. Só o container `web` publica
porta, em `127.0.0.1:${WEB_PORT:-8080}`.

## Deploy atrás do Cloudflare Tunnel

O `web` é a única origem pública: serve o SPA e faz proxy de `/api` para a API na rede
interna do Compose. Isso mantém o cookie httpOnly de refresh como first-party e elimina
CORS em produção. Basta apontar o túnel já configurado para a porta local:

```yaml
# ~/.cloudflared/config.yml
ingress:
  - hostname: treino.seudominio.com.br
    service: http://127.0.0.1:8080
  # Necessário a partir do M2, quando entram vídeo e foto: as presigned URLs são
  # assinadas para este host, que precisa bater com S3_PUBLIC_ENDPOINT.
  - hostname: media.seudominio.com.br
    service: http://127.0.0.1:9000
  - service: http_status:404
```

Depois: `PUBLIC_APP_URL=https://treino.seudominio.com.br` no `.env`.

## Comandos

| Comando                                                   | O que faz                                 |
| --------------------------------------------------------- | ----------------------------------------- |
| `pnpm dev`                                                | API e web em watch                        |
| `pnpm build`                                              | Build de produção dos três pacotes        |
| `pnpm lint` / `pnpm format`                               | ESLint / Prettier                         |
| `pnpm typecheck`                                          | `tsc --noEmit` em todos os workspaces     |
| `pnpm test`                                               | Testes unitários (shared, api, web)       |
| `pnpm --filter @pt/api test:e2e`                          | e2e da API — exige Postgres e Redis no ar |
| `pnpm db:migrate` / `db:deploy` / `db:seed` / `db:studio` | Prisma                                    |
| `pnpm --filter @pt/web icons`                             | Regera os ícones do PWA                   |

## Estrutura

```
apps/api/          NestJS. src/common (infra transversal), src/modules (domínio)
apps/api/prisma/   schema.prisma, migrations, seed
apps/web/          React + Vite + PWA
packages/shared/   cálculos puros (e1RM, volume, dobras) usados pelo back e pelo front
infra/nginx/       origem única que serve o SPA e faz proxy da API
```

`packages/shared/calc` não tem dependência nenhuma de propósito: o front precisa rodar os
mesmos cálculos offline durante o treino.

## Regras que o código precisa respeitar

- Toda tabela com `tenantId` só pode ser consultada com filtro de tenant. A Prisma Client
  Extension que garante isso entra no M1; até lá, filtre à mão.
- `PrescribedSet` (o que foi prescrito) e `SetLog` (o que foi feito) nunca se fundem.
- Erros da API sempre em RFC 7807 (`application/problem+json`).
- Toda variável de ambiente nova entra no `.env.example`.
- UI em português; código, tabelas, colunas e commits em inglês.

## Endpoints disponíveis hoje

```
GET /health         liveness — usado pelo healthcheck do container
GET /health/ready   readiness — pinga Postgres e Redis
```

## Credenciais do seed

| Papel   | E-mail               | Senha         |
| ------- | -------------------- | ------------- |
| ADMIN   | `admin@demo.local`   | `changeme123` |
| TRAINER | `trainer@demo.local` | `changeme123` |
| STUDENT | `ana@demo.local`     | `changeme123` |
| STUDENT | `bruno@demo.local`   | `changeme123` |

A senha padrão só existe fora de produção: com `NODE_ENV=production` o seed aborta se
`SEED_TRAINER_PASSWORD`, `SEED_STUDENT_PASSWORD` e `SEED_ADMIN_PASSWORD` não estiverem
definidas.
