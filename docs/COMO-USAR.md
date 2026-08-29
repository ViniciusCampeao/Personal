# Como usar a plataforma

Guia prático nos três papéis: **operação** (quem hospeda), **personal trainer** e
**aluno**. A referência técnica completa continua na
[especificação](../SPEC-personal-trainer.md) e no [README](../README.md).

---

## 1. Operação (você)

### Rodar em desenvolvimento

```bash
cp .env.example .env          # ajuste as senhas
pnpm install
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d postgres redis minio minio-init
pnpm db:migrate
pnpm db:seed                  # cria tenant demo + trainer + 2 alunos
pnpm dev                      # API em :3000, web em :5173
```

Contas do seed (senha `changeme123` para todas, trocável via `SEED_*` no `.env`):

| Papel    | E-mail               |
| -------- | -------------------- |
| Personal | `trainer@demo.local` |
| Aluno    | `ana@demo.local`     |
| Aluno    | `bruno@demo.local`   |

### Rodar a pilha inteira (produção / VPS)

```bash
docker compose up -d --build
```

Só o container `web` publica porta (`127.0.0.1:8080`); ele serve o SPA e faz proxy de
`/api` para a API interna. Aponte o Cloudflare Tunnel para essa porta. A API aplica as
migrations no boot (`RUN_MIGRATIONS=true`).

### Web Push (obrigatório para notificações no celular)

Gere um par de chaves VAPID uma única vez e preencha no `.env`:

```bash
pnpm dlx web-push generate-vapid-keys
# copie para VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY e ajuste VAPID_SUBJECT
```

Sem essas variáveis o app funciona normalmente, mas o botão "Ativar" notificações
falha ao registrar a inscrição. Push e instalação do PWA exigem **HTTPS** (o túnel já
resolve isso; `localhost` também vale para teste).

### Verificação e manutenção

```bash
pnpm lint && pnpm typecheck && pnpm format:check
pnpm test                         # unit de shared, api e web
pnpm --filter @pt/api test:e2e    # exige postgres/redis/minio de pé
pnpm --filter @pt/web build
```

- **Backup**: o estado vive no Postgres (dados) e no MinIO (vídeos, fotos, avatares).
- **Criar um novo personal/estúdio**: não há painel de admin (fora de escopo, §13).
  Crie via seed ou SQL direto — cada `tenant` é um estúdio isolado.
- **Lacunas conhecidas e aceitas**: sem "esqueci minha senha" (exigiria infra de
  e-mail — se um usuário perder a senha, atualize o hash no banco), sem painel admin,
  tema escuro apenas.

---

## 2. Personal trainer

Entre em `/entrar` com seu e-mail. Sua área é o **`/gestao`**, com menu lateral.

### Dashboard (`/gestao`)

Visão do dia: alunos em risco (sem treinar há dias), treinos previstos para hoje,
PRs recentes e check-ins pendentes de leitura.

### Alunos (`/gestao/alunos`)

- Lista com busca, filtros (aderência, dias inativo) e resumo de cada aluno
  (último treino, aderência na janela, check-ins).
- **Convidar aluno**: botão "Convidar" → informe e-mail (ou telefone). O sistema gera
  um **link de convite** para você mandar por WhatsApp/e-mail. O aluno cria a própria
  conta e senha por esse link; o convite expira e só vale uma vez.
- **Ficha do aluno** (`/gestao/alunos/:id`), em 7 abas: Resumo, Programa, Histórico,
  Progresso, Avaliações, Check-ins e Anamnese. As anotações privadas da ficha nunca
  aparecem para o aluno.
- **Pausar/arquivar**: na ficha, mude o status do aluno (férias, saída do studio).

### Programas de treino

- **Criar**: na ficha do aluno → "Novo programa", do zero ou a partir de um template.
- **Editor** (`/gestao/programas/:id`): dias em abas (A, B, C…); cada dia é uma grade
  tipo planilha — exercícios com séries, repetições (faixa), carga-alvo, RIR, descanso,
  tempo e observações. Arraste para reordenar; **"Agrupar com o anterior"** cria
  bi-set/tri-set. Nada é enviado até clicar em **Salvar**.
- **Ativar**: um programa só passa a valer para o aluno depois de ativado; ativar um
  novo desativa o anterior.
- **Templates** (`/gestao/templates`): salve qualquer programa como template e
  reaproveite para outros alunos; duplicar também funciona direto.

### Biblioteca de exercícios (`/gestao/biblioteca`)

Acervo global + seus exercícios próprios. Crie/edite os seus com músculos,
equipamento e **vídeo de demonstração** (upload direto, o aluno vê na execução).

### Avaliações físicas

Na ficha do aluno → Avaliações → "Nova avaliação": peso, dobras cutâneas,
circunferências e fotos. Percentual de gordura e resumos são calculados em tempo real
enquanto você digita. O aluno vê a evolução e compara fotos lado a lado.

### Notificações (`/gestao/notificacoes`)

Check-ins respondidos, PRs dos alunos etc. Ative "Notificações no dispositivo" para
receber push mesmo com o app fechado.

---

## 3. Aluno

Você entra pelo **link de convite** do seu personal: cria nome, senha e aceita os
Termos e a Política de Privacidade. Depois disso, login em `/entrar`. Sua área é o
**`/app`**, com navegação inferior.

### Instalar no celular (recomendado)

O app é um PWA: no navegador, use "Adicionar à tela inicial" (Android/Chrome oferece
sozinho; no iPhone: Safari → Compartilhar → Adicionar à Tela de Início). Instalado,
abre em tela cheia e funciona offline.

### Treinar (Início → "Começar treino")

- A home mostra **o treino de hoje** do seu programa ativo.
- Na execução: cada exercício mostra a prescrição (séries × reps, carga-alvo, RIR),
  o **seu desempenho anterior** e o vídeo de demonstração. Registre cada série com os
  botões grandes; o **timer de descanso** dispara sozinho. Dá para desfazer uma série,
  substituir um exercício e finalizar quando quiser.
- **Funciona 100% sem internet**: registre tudo no vagão do metrô ou na academia sem
  sinal — sincroniza sozinho quando a conexão voltar (ícone de sync no topo mostra se
  há algo pendente). Nada é perdido nem duplicado.

### Acompanhar

- **Histórico**: todos os treinos feitos, com detalhe série a série.
- **Progresso**: gráficos de aderência, volume por grupo muscular e evolução de força
  (e1RM) por exercício, com filtros de período.
- **Avaliações**: linha do tempo das avaliações físicas com medidas e comparação de
  fotos.
- **Check-in semanal**: responda como foi a semana (sono, dor, energia…) — seu
  personal recebe.

### Perfil e seus direitos (LGPD)

Em Perfil você edita seus dados e foto, e ainda:

- **Baixar meus dados**: exporta tudo que o sistema tem sobre você (art. 18, V).
- **Excluir minha conta**: apaga a conta e os dados definitivamente — confirme com a
  senha e digitando `EXCLUIR` (art. 18, VI). Não tem volta.

### Notificações

Em Notificações, ative "Notificações no dispositivo" para receber lembrete de treino
e de check-in por push, mesmo com o app fechado.
