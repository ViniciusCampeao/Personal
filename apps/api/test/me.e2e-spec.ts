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
 * Exercises the self-service surface every signed-in user has over their own data:
 * profile read/edit, the LGPD export (§10.4) and the LGPD erasure (§10.5), plus the
 * versioned legal texts a consent record points at (§10.8).
 */
describe('Me and legal (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  const prefix = `e2e-me-${randomUUID().slice(0, 8)}`;
  const password = 'senha-forte-123';

  let tenantId: string;
  let trainerToken: string;
  let studentToken: string;
  let studentId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app, testEnv());
    await app.init();

    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(password);

    const tenant = await prisma.tenant.create({ data: { name: 'E2E Me', slug: prefix } });
    tenantId = tenant.id;

    const trainer = await prisma.user.create({
      data: {
        tenantId,
        email: `${prefix}-trainer@e2e.local`,
        name: 'Treinador',
        role: 'TRAINER',
        status: 'ACTIVE',
        passwordHash,
      },
    });

    const student = await prisma.user.create({
      data: {
        tenantId,
        email: `${prefix}-student@e2e.local`,
        name: 'Aluno',
        role: 'STUDENT',
        status: 'ACTIVE',
        passwordHash,
        studentProfile: { create: { tenantId, trainerId: trainer.id } },
        consents: {
          create: { tenantId, type: 'TERMS', version: 'v1' },
        },
      },
    });
    studentId = student.id;

    const login = (email: string) =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200)
        .then((res) => res.body.accessToken as string);

    trainerToken = await login(`${prefix}-trainer@e2e.local`);
    studentToken = await login(`${prefix}-student@e2e.local`);
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { tenantId } });
    await prisma.studentProfile.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await app?.close();
  });

  describe('GET /api/v1/legal/:type', () => {
    it('serves the versioned terms without requiring a session', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/legal/terms').expect(200);
      expect(res.body).toMatchObject({ type: 'terms', version: 'v1' });
      expect(res.body.body.length).toBeGreaterThan(200);
    });

    it('404s an unknown document instead of serving an empty one', async () => {
      await request(app.getHttpServer()).get('/api/v1/legal/cookies').expect(404);
    });
  });

  describe('GET /api/v1/me/profile', () => {
    it('returns the student profile with the trainer behind it', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/me/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(res.body).toMatchObject({ email: `${prefix}-student@e2e.local`, role: 'STUDENT' });
      expect(res.body.student).toMatchObject({ trainerName: 'Treinador' });
      expect(res.body.consents).toEqual([expect.objectContaining({ type: 'TERMS' })]);
    });

    it('has no student block for a trainer', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/me/profile')
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);
      expect(res.body.student).toBeNull();
    });
  });

  describe('PATCH /api/v1/me/profile', () => {
    it('updates the user and the measurement fields together', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/me/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ name: 'Aluno Editado', heightCm: 175, experienceLevel: 'INTERMEDIATE' })
        .expect(200);

      expect(res.body.name).toBe('Aluno Editado');
      expect(res.body.student).toMatchObject({
        heightCm: 175,
        experienceLevel: 'INTERMEDIATE',
      });
    });

    it('rejects an impossible height instead of storing it', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/me/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ heightCm: 12 })
        .expect(400);
    });

    it('ignores the e-mail: it is the login identity, not a profile field', async () => {
      await request(app.getHttpServer())
        .patch('/api/v1/me/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ email: 'outro@e2e.local' })
        .expect(200);

      const user = await prisma.user.findUnique({ where: { id: studentId } });
      expect(user?.email).toBe(`${prefix}-student@e2e.local`);
    });
  });

  describe('GET /api/v1/me/export', () => {
    it('hands the data subject every section, even the empty ones', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/me/export')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(res.body).toMatchObject({ format: 'json' });
      expect(res.body.user.email).toBe(`${prefix}-student@e2e.local`);
      // Every section is present so the dump is self-describing, not a guess.
      for (const section of [
        'consents',
        'anamneses',
        'assessments',
        'checkIns',
        'sessions',
        'personalRecords',
        'notifications',
      ]) {
        expect(Array.isArray(res.body[section])).toBe(true);
      }
    });
  });

  describe('DELETE /api/v1/me', () => {
    it('refuses without the typed confirmation', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ password, confirmation: 'excluir' })
        .expect(400);
    });

    it('refuses with the wrong password', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ password: 'senha-errada', confirmation: 'EXCLUIR' })
        .expect(401);
    });

    it('refuses to erase a trainer from self-service', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/me')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ password, confirmation: 'EXCLUIR' })
        .expect(403);
    });

    it('erases the student, keeping only the audit trail of the deletion', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ password, confirmation: 'EXCLUIR' })
        .expect(204);

      expect(await prisma.user.findUnique({ where: { id: studentId } })).toBeNull();
      expect(await prisma.studentProfile.findUnique({ where: { userId: studentId } })).toBeNull();
      const audit = await prisma.auditLog.findFirst({
        where: { tenantId, action: 'DELETE_ACCOUNT', entityId: studentId },
      });
      expect(audit).not.toBeNull();
    });
  });
});
