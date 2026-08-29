import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { type NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { hashPassword } from '../src/common/auth/password';
import { mondayOfUtc } from '../src/common/util/week';
import { testEnv } from './test-env';

/**
 * Exercises the M8 weekly check-in: server-derived `weekStart`, upsert on a second
 * submission in the same week, and who may read a student's history.
 */
describe('Check-ins (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  const prefix = `e2e-ci-${randomUUID().slice(0, 8)}`;
  const password = 'senha-forte-123';

  let tenantId: string;
  let trainerToken: string;
  let studentToken: string;
  let otherStudentToken: string;
  let studentId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app, testEnv());
    await app.init();

    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(password);

    const tenant = await prisma.tenant.create({ data: { name: 'E2E CheckIns', slug: prefix } });
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
      },
    });
    studentId = student.id;

    await prisma.user.create({
      data: {
        tenantId,
        email: `${prefix}-other-student@e2e.local`,
        name: 'Outro Aluno',
        role: 'STUDENT',
        status: 'ACTIVE',
        passwordHash,
        studentProfile: { create: { tenantId, trainerId: trainer.id } },
      },
    });

    trainerToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: `${prefix}-trainer@e2e.local`, password })
        .expect(200)
    ).body.accessToken;
    studentToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: `${prefix}-student@e2e.local`, password })
        .expect(200)
    ).body.accessToken;
    otherStudentToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: `${prefix}-other-student@e2e.local`, password })
        .expect(200)
    ).body.accessToken;
  });

  afterAll(async () => {
    await prisma.checkIn.deleteMany({ where: { tenantId } });
    await prisma.notification.deleteMany({ where: { tenantId } });
    await prisma.studentProfile.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await app?.close();
  });

  describe('GET /api/v1/me/check-in/current', () => {
    it('returns null before the first check-in of the week', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/me/check-in/current')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      expect(res.body).toEqual({});
    });

    it('forbids a TRAINER from a student-only endpoint', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/me/check-in/current')
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(403);
    });
  });

  describe('POST /api/v1/me/check-in', () => {
    it('creates the check-in for the current week, with a server-derived weekStart', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/me/check-in')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ sleepQuality: 4, energy: 3, soreness: 2, stress: 2, weightKg: 78.5 })
        .expect(201);

      expect(res.body.weekStart).toBe(mondayOfUtc(new Date()));
      expect(res.body.sleepQuality).toBe(4);
      expect(res.body.weightKg).toBe(78.5);
    });

    it('ignores a client-supplied weekStart', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/me/check-in')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ energy: 5, weekStart: '2020-01-06' })
        .expect(201);

      expect(res.body.weekStart).toBe(mondayOfUtc(new Date()));
    });

    it('upserts instead of duplicating on a second submission the same week', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/me/check-in')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ sleepQuality: 1, stress: 5 })
        .expect(201);

      const rows = await prisma.checkIn.findMany({ where: { studentId } });
      expect(rows).toHaveLength(1);
      expect(rows[0].sleepQuality).toBe(1);
      expect(rows[0].stress).toBe(5);
    });

    it('now returns the current check-in', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/me/check-in/current')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      expect(res.body.stress).toBe(5);
    });

    it('rejects a slider value out of the 1-5 range', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/me/check-in')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ stress: 9 })
        .expect(400);
    });
  });

  describe('GET /api/v1/students/:id/check-ins', () => {
    it('lets the owning trainer read the history', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/students/${studentId}/check-ins`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);
      expect(res.body.items).toHaveLength(1);
    });

    it('lets the student read their own history', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/students/${studentId}/check-ins`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      expect(res.body.items).toHaveLength(1);
    });

    it('hides another student history', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/students/${studentId}/check-ins`)
        .set('Authorization', `Bearer ${otherStudentToken}`)
        .expect(404);
    });
  });
});
