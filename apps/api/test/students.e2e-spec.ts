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
 * The trainer's roster: search, filters, the derived activity columns, and the tenancy
 * boundary that makes another trainer's student a 404 rather than a 403.
 */
describe('Students (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  const prefix = `e2e-st-${randomUUID().slice(0, 8)}`;
  const password = 'senha-forte-123';

  let tenantId: string;
  let trainerToken: string;
  let otherTrainerToken: string;
  let studentToken: string;
  let anaId: string;
  let brunoId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app, testEnv());
    await app.init();

    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(password);

    const tenant = await prisma.tenant.create({ data: { name: 'E2E Students', slug: prefix } });
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

    const otherTrainer = await prisma.user.create({
      data: {
        tenantId,
        email: `${prefix}-other@e2e.local`,
        name: 'Outro Treinador',
        role: 'TRAINER',
        status: 'ACTIVE',
        passwordHash,
      },
    });

    const ana = await prisma.user.create({
      data: {
        tenantId,
        email: `${prefix}-ana@e2e.local`,
        name: 'Ana Souza',
        role: 'STUDENT',
        status: 'ACTIVE',
        passwordHash,
        studentProfile: { create: { tenantId, trainerId: trainer.id, goal: 'Hipertrofia' } },
      },
    });
    anaId = ana.id;

    const bruno = await prisma.user.create({
      data: {
        tenantId,
        email: `${prefix}-bruno@e2e.local`,
        name: 'Bruno Lima',
        role: 'STUDENT',
        status: 'ACTIVE',
        passwordHash,
        studentProfile: { create: { tenantId, trainerId: trainer.id } },
      },
    });
    brunoId = bruno.id;

    // Belongs to the other trainer: must never appear in this trainer's roster.
    await prisma.user.create({
      data: {
        tenantId,
        email: `${prefix}-carla@e2e.local`,
        name: 'Carla Dias',
        role: 'STUDENT',
        status: 'ACTIVE',
        passwordHash,
        studentProfile: { create: { tenantId, trainerId: otherTrainer.id } },
      },
    });

    const login = (email: string) =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password })
        .expect(200)
        .then((res) => res.body.accessToken as string);

    trainerToken = await login(`${prefix}-trainer@e2e.local`);
    otherTrainerToken = await login(`${prefix}-other@e2e.local`);
    studentToken = await login(`${prefix}-ana@e2e.local`);
  });

  afterAll(async () => {
    await prisma.studentProfile.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await app?.close();
  });

  describe('GET /api/v1/students', () => {
    it("lists only the caller's own students", async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/students')
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);

      expect(res.body.items.map((s: { name: string }) => s.name)).toEqual([
        'Ana Souza',
        'Bruno Lima',
      ]);
      expect(res.body.items[0]).toMatchObject({
        goal: 'Hipertrofia',
        lastSessionAt: null,
        adherenceRatio: 0,
        activeProgramId: null,
        hasPendingCheckIn: true,
      });
    });

    it('searches by name and by e-mail', async () => {
      const byName = await request(app.getHttpServer())
        .get('/api/v1/students?q=bruno')
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);
      expect(byName.body.items).toHaveLength(1);

      const byEmail = await request(app.getHttpServer())
        .get(`/api/v1/students?q=${prefix}-ana`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);
      expect(byEmail.body.items[0].id).toBe(anaId);
    });

    it('filters by how long a student has been away', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/students?inactiveDays=7')
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);
      // Neither has ever trained, so both count as inactive.
      expect(res.body.items).toHaveLength(2);
    });

    it('is closed to students', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/students')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
    });
  });

  describe('GET /api/v1/students/:id', () => {
    it('gives the trainer the private notes field', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/students/${anaId}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);
      expect(res.body).toHaveProperty('privateNotes');
      expect(res.body.totalSessions).toBe(0);
    });

    it('lets a student read their own row', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/students/${anaId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      // The trainer's notes about the student are not the student's to read.
      expect(res.body.privateNotes).toBeNull();
    });

    it("hides another trainer's student behind a 404", async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/students/${anaId}`)
        .set('Authorization', `Bearer ${otherTrainerToken}`)
        .expect(404);
    });

    it('hides another student behind a 404', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/students/${brunoId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/v1/students/:id', () => {
    it('updates the trainer-owned fields', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/students/${brunoId}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ goal: 'Resistência', privateNotes: 'Ombro sensível', status: 'PAUSED' })
        .expect(200);

      expect(res.body).toMatchObject({
        goal: 'Resistência',
        privateNotes: 'Ombro sensível',
        status: 'PAUSED',
      });
    });

    it('is closed to the student themselves', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/students/${anaId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ goal: 'Qualquer' })
        .expect(403);
    });
  });
});
