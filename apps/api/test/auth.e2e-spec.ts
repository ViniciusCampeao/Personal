import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { type NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { hashPassword } from '../src/common/auth/password';
import { testEnv } from './test-env';

/**
 * Exercises the M1 auth + invite flow end to end against a real Postgres and Redis
 * (`pnpm docker:up`, then `pnpm --filter @pt/api test:e2e`). Fixtures are created
 * through the raw `PrismaService` (unextended — no tenant context exists yet in a test
 * file), mirroring how `seed.ts` works outside any request.
 */
describe('Auth + Invites (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  let tenantId: string;
  let trainerId: string;
  let studentId: string;
  const trainerEmail = `trainer-${randomUUID()}@e2e.local`;
  const studentEmail = `aluno-${randomUUID()}@e2e.local`;
  const password = 'senha-forte-123';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app, testEnv());
    await app.init();

    prisma = app.get(PrismaService);
    const tenant = await prisma.tenant.create({
      data: { name: 'E2E Tenant', slug: `e2e-${randomUUID()}` },
    });
    tenantId = tenant.id;

    const passwordHash = await hashPassword(password);
    const trainer = await prisma.user.create({
      data: {
        tenantId,
        email: trainerEmail,
        name: 'Treinador E2E',
        role: 'TRAINER',
        status: 'ACTIVE',
        passwordHash,
      },
    });
    trainerId = trainer.id;

    const student = await prisma.user.create({
      data: {
        tenantId,
        email: studentEmail,
        name: 'Aluno E2E',
        role: 'STUDENT',
        status: 'ACTIVE',
        passwordHash,
        studentProfile: { create: { tenantId, trainerId } },
      },
    });
    studentId = student.id;
  });

  afterAll(async () => {
    // Children first — nothing here relies on cascading deletes so the test stays
    // explicit about what it created.
    await prisma.consent.deleteMany({ where: { tenantId } });
    await prisma.invite.deleteMany({ where: { tenantId } });
    await prisma.studentProfile.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await app?.close();
  });

  describe('POST /api/v1/auth/login', () => {
    it('rejects a wrong password with a generic message', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: trainerEmail, password: 'wrong-password' })
        .expect(401);
      expect(res.body.title).toBeDefined();
      expect(res.body.detail).toMatch(/inválidos/i);
    });

    it('rejects a malformed body with the shared Zod schema', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: '' })
        .expect(400);
      expect(Array.isArray(res.body.errors)).toBe(true);
    });

    it('logs the trainer in, sets the refresh cookie, and returns an access token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: trainerEmail, password })
        .expect(200);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({ email: trainerEmail, role: 'TRAINER', tenantId });

      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies.some((c) => c.startsWith('pt_refresh=') && c.includes('HttpOnly'))).toBe(true);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('rejects a request with no access token', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });

    it('returns the authenticated user for a valid access token', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: studentEmail, password })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .expect(200);
      expect(res.body).toMatchObject({ id: studentId, role: 'STUDENT', tenantId });
    });
  });

  describe('refresh + logout rotation', () => {
    it('rotates the refresh token and the old cookie can no longer be reused', async () => {
      const agent = request.agent(app.getHttpServer());
      await agent.post('/api/v1/auth/login').send({ email: trainerEmail, password }).expect(200);

      const first = await agent.post('/api/v1/auth/refresh').expect(200);
      expect(first.body.accessToken).toEqual(expect.any(String));

      // Replay the ORIGINAL login cookie (the agent has already moved on to the
      // rotated one) — it must have been burned by the refresh above.
      const staleCookie = (
        (await agent.post('/api/v1/auth/login').send({ email: trainerEmail, password })).headers[
          'set-cookie'
        ] as unknown as string[]
      )[0];

      await agent.post('/api/v1/auth/refresh').expect(200); // consumes the fresh cookie
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('Cookie', staleCookie)
        .expect(401);
    });

    it('logout clears the cookie and it can no longer refresh', async () => {
      const agent = request.agent(app.getHttpServer());
      await agent.post('/api/v1/auth/login').send({ email: trainerEmail, password }).expect(200);
      await agent.post('/api/v1/auth/logout').expect(204);
      await agent.post('/api/v1/auth/refresh').expect(401);
    });
  });

  describe('RBAC', () => {
    it('lets a TRAINER create an invite', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: trainerEmail, password })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post('/api/v1/invites')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .send({ email: `convidado-${randomUUID()}@e2e.local` })
        .expect(201);

      expect(res.body.url).toContain('/convite/');
      expect(res.body.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    });

    it('forbids a STUDENT from creating an invite', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: studentEmail, password })
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/v1/invites')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .send({ email: 'x@example.com' })
        .expect(403);
    });
  });

  describe('invite accept flow', () => {
    it('previews, accepts, and logs the new student in with a single consent per type', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: trainerEmail, password })
        .expect(200);

      const inviteEmail = `novo-aluno-${randomUUID()}@e2e.local`;
      const created = await request(app.getHttpServer())
        .post('/api/v1/invites')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .send({ email: inviteEmail })
        .expect(201);

      const preview = await request(app.getHttpServer())
        .get(`/api/v1/invites/${created.body.token}`)
        .expect(200);
      expect(preview.body.email).toBe(inviteEmail);
      expect(preview.body.trainerName).toBe('Treinador E2E');

      const accept = await request(app.getHttpServer())
        .post(`/api/v1/invites/${created.body.token}/accept`)
        .send({
          name: 'Novo Aluno',
          password: 'outra-senha-forte',
          consents: { terms: true, privacy: true },
        })
        .expect(200);
      expect(accept.body.user).toMatchObject({ email: inviteEmail, role: 'STUDENT', tenantId });

      const newUser = await prisma.user.findUniqueOrThrow({
        where: { tenantId_email: { tenantId, email: inviteEmail } },
      });
      const consents = await prisma.consent.findMany({ where: { userId: newUser.id } });
      expect(consents.map((c) => c.type).sort()).toEqual(['PRIVACY', 'TERMS']);

      // Re-accepting the same (now-used) token must fail.
      await request(app.getHttpServer())
        .post(`/api/v1/invites/${created.body.token}/accept`)
        .send({
          name: 'Outra Pessoa',
          password: 'outra-senha-forte',
          consents: { terms: true, privacy: true },
        })
        .expect(410);
    });

    it('404s on an unknown invite token', async () => {
      await request(app.getHttpServer()).get('/api/v1/invites/does-not-exist').expect(404);
    });
  });

  describe('tenant isolation', () => {
    it('refuses to log in when the same e-mail exists in two tenants, even with the right password', async () => {
      // Login resolves the tenant by e-mail alone (see AuthService.login) — a genuine
      // cross-tenant collision must be refused rather than guessed at, until a
      // "choose your workspace" flow exists.
      const otherTenant = await prisma.tenant.create({
        data: { name: 'Outro Tenant', slug: `e2e-other-${randomUUID()}` },
      });
      const collidingEmail = `colisao-${randomUUID()}@e2e.local`;
      const passwordHash = await hashPassword(password);
      await prisma.user.create({
        data: {
          tenantId,
          email: collidingEmail,
          name: 'A',
          role: 'STUDENT',
          status: 'ACTIVE',
          passwordHash,
        },
      });
      await prisma.user.create({
        data: {
          tenantId: otherTenant.id,
          email: collidingEmail,
          name: 'B',
          role: 'STUDENT',
          status: 'ACTIVE',
          passwordHash,
        },
      });

      try {
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ email: collidingEmail, password })
          .expect(401);
      } finally {
        await prisma.user.deleteMany({ where: { email: collidingEmail } });
        await prisma.tenant.delete({ where: { id: otherTenant.id } });
      }
    });
  });
});
