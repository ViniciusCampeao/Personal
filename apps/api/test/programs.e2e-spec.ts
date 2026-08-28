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
 * Exercises the M3 program-tree CRUD/duplicate/activate flow end to end. One global
 * exercise fixture is shared by every prescribed-exercise test (Program/WorkoutDay data
 * is per-run via `prefix`-scoped tenants, so no cross-run interference).
 */
describe('Programs (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  const prefix = `e2e-pr-${randomUUID().slice(0, 8)}`;
  const password = 'senha-forte-123';

  let tenantId: string;
  let trainerAToken: string;
  let trainerBToken: string; // same tenant, different trainer — ownership isolation
  let studentToken: string;
  let studentAId: string;
  let studentBId: string;

  let otherTenantTrainerToken: string;

  let exerciseId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app, testEnv());
    await app.init();

    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(password);

    const tenant = await prisma.tenant.create({ data: { name: 'E2E Programs', slug: prefix } });
    tenantId = tenant.id;

    const trainerA = await prisma.user.create({
      data: {
        tenantId,
        email: `${prefix}-trainer-a@e2e.local`,
        name: 'Treinador A',
        role: 'TRAINER',
        status: 'ACTIVE',
        passwordHash,
      },
    });

    await prisma.user.create({
      data: {
        tenantId,
        email: `${prefix}-trainer-b@e2e.local`,
        name: 'Treinador B',
        role: 'TRAINER',
        status: 'ACTIVE',
        passwordHash,
      },
    });

    const studentA = await prisma.user.create({
      data: {
        tenantId,
        email: `${prefix}-student-a@e2e.local`,
        name: 'Aluno A',
        role: 'STUDENT',
        status: 'ACTIVE',
        passwordHash,
        studentProfile: { create: { tenantId, trainerId: trainerA.id } },
      },
    });
    studentAId = studentA.id;

    const studentB = await prisma.user.create({
      data: {
        tenantId,
        email: `${prefix}-student-b@e2e.local`,
        name: 'Aluno B',
        role: 'STUDENT',
        status: 'ACTIVE',
        passwordHash,
        studentProfile: { create: { tenantId, trainerId: trainerA.id } },
      },
    });
    studentBId = studentB.id;

    const otherTenant = await prisma.tenant.create({
      data: { name: 'E2E Programs B', slug: `${prefix}-other` },
    });
    await prisma.user.create({
      data: {
        tenantId: otherTenant.id,
        email: `${prefix}-other-trainer@e2e.local`,
        name: 'Treinador Outro Tenant',
        role: 'TRAINER',
        status: 'ACTIVE',
        passwordHash,
      },
    });

    trainerAToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: `${prefix}-trainer-a@e2e.local`, password })
        .expect(200)
    ).body.accessToken;
    trainerBToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: `${prefix}-trainer-b@e2e.local`, password })
        .expect(200)
    ).body.accessToken;
    studentToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: `${prefix}-student-a@e2e.local`, password })
        .expect(200)
    ).body.accessToken;
    otherTenantTrainerToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: `${prefix}-other-trainer@e2e.local`, password })
        .expect(200)
    ).body.accessToken;

    const exercise = await prisma.exercise.create({
      data: {
        tenantId: null,
        name: `${prefix} Supino Reto`,
        slug: `${prefix}-supino`,
        movementPattern: 'HORIZONTAL_PUSH',
        equipment: 'BARBELL',
        muscles: { createMany: { data: [{ muscle: 'CHEST', role: 'PRIMARY' }] } },
      },
    });
    exerciseId = exercise.id;
  });

  afterAll(async () => {
    await prisma.prescribedSet.deleteMany({
      where: { prescribedExercise: { workoutDay: { program: { tenantId } } } },
    });
    await prisma.prescribedExercise.deleteMany({
      where: { workoutDay: { program: { tenantId } } },
    });
    await prisma.workoutDay.deleteMany({ where: { program: { tenantId } } });
    await prisma.program.deleteMany({ where: { tenantId } });
    await prisma.exercise.deleteMany({ where: { name: { startsWith: prefix } } });
    await prisma.studentProfile.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    const otherTenant = await prisma.tenant.findUnique({ where: { slug: `${prefix}-other` } });
    if (otherTenant) {
      await prisma.user.deleteMany({ where: { tenantId: otherTenant.id } });
      await prisma.tenant.delete({ where: { id: otherTenant.id } });
    }
    await prisma.tenant.delete({ where: { id: tenantId } });
    await app?.close();
  });

  describe('POST /api/v1/programs', () => {
    it('creates a program for a student', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/programs')
        .set('Authorization', `Bearer ${trainerAToken}`)
        .send({ studentId: studentAId, name: `${prefix} Programa A` })
        .expect(201);
      expect(res.body.studentId).toBe(studentAId);
      expect(res.body.isTemplate).toBe(false);
      expect(res.body.days).toEqual([]);
    });

    it('creates a template with no studentId', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/programs')
        .set('Authorization', `Bearer ${trainerAToken}`)
        .send({ isTemplate: true, name: `${prefix} Template` })
        .expect(201);
      expect(res.body.studentId).toBeNull();
      expect(res.body.isTemplate).toBe(true);
    });

    it('rejects a body with neither studentId nor isTemplate (shared Zod refine)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/programs')
        .set('Authorization', `Bearer ${trainerAToken}`)
        .send({ name: `${prefix} Sem Dono` })
        .expect(400);
      expect(Array.isArray(res.body.errors)).toBe(true);
    });

    it("404s creating a program for another trainer's student", async () => {
      // studentB belongs to trainerA in this fixture, so trainerB doesn't own them.
      await request(app.getHttpServer())
        .post('/api/v1/programs')
        .set('Authorization', `Bearer ${trainerBToken}`)
        .send({ studentId: studentBId, name: `${prefix} Não Deveria` })
        .expect(404);
    });

    it('forbids a STUDENT from creating a program', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/programs')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ studentId: studentAId, name: `${prefix} Aluno Não Pode` })
        .expect(403);
    });
  });

  describe('program tree + days + exercises', () => {
    let programId: string;
    let dayId: string;

    it('builds a day and replaces its exercises with a bi-set', async () => {
      const program = await request(app.getHttpServer())
        .post('/api/v1/programs')
        .set('Authorization', `Bearer ${trainerAToken}`)
        .send({ studentId: studentAId, name: `${prefix} Árvore` })
        .expect(201);
      programId = program.body.id;

      const day = await request(app.getHttpServer())
        .post(`/api/v1/programs/${programId}/days`)
        .set('Authorization', `Bearer ${trainerAToken}`)
        .send({ label: 'A', name: 'Peito e tríceps' })
        .expect(201);
      dayId = day.body.id;

      const replaced = await request(app.getHttpServer())
        .put(`/api/v1/days/${dayId}/exercises`)
        .set('Authorization', `Bearer ${trainerAToken}`)
        .send([
          {
            exerciseId,
            orderIndex: 0,
            groupKey: 'biset-1',
            sets: [{ setNumber: 1, targetLoadKg: 60, repsMin: 8, repsMax: 10 }],
          },
          {
            exerciseId,
            orderIndex: 1,
            groupKey: 'biset-1',
            sets: [
              { setNumber: 1, targetLoadKg: 40, repsMin: 10, repsMax: 12 },
              { setNumber: 2, targetLoadKg: 40, repsMin: 10, repsMax: 12 },
            ],
          },
        ])
        .expect(200);

      expect(replaced.body.exercises).toHaveLength(2);
      expect(replaced.body.exercises[0].groupKey).toBe('biset-1');
      expect(replaced.body.exercises[1].sets).toHaveLength(2);
      expect(replaced.body.exercises[0].exercise.name).toBe(`${prefix} Supino Reto`);
    });

    it('rejects a duplicate setNumber within the same exercise', async () => {
      await request(app.getHttpServer())
        .put(`/api/v1/days/${dayId}/exercises`)
        .set('Authorization', `Bearer ${trainerAToken}`)
        .send([
          {
            exerciseId,
            orderIndex: 0,
            sets: [
              { setNumber: 1, targetLoadKg: 60 },
              { setNumber: 1, targetLoadKg: 65 },
            ],
          },
        ])
        .expect(409);
    });

    it('returns the full tree on GET /programs/:id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/programs/${programId}`)
        .set('Authorization', `Bearer ${trainerAToken}`)
        .expect(200);
      expect(res.body.days).toHaveLength(1);
      expect(res.body.days[0].id).toBe(dayId);
    });

    it("404s another trainer's program in the same tenant", async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/programs/${programId}`)
        .set('Authorization', `Bearer ${trainerBToken}`)
        .expect(404);
    });

    it("404s another tenant's trainer entirely", async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/programs/${programId}`)
        .set('Authorization', `Bearer ${otherTenantTrainerToken}`)
        .expect(404);
    });

    it("404s patching another trainer's day", async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/days/${dayId}`)
        .set('Authorization', `Bearer ${trainerBToken}`)
        .send({ name: 'Invasão' })
        .expect(404);
    });

    it('updates and deletes the day', async () => {
      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/days/${dayId}`)
        .set('Authorization', `Bearer ${trainerAToken}`)
        .send({ estimatedMinutes: 55 })
        .expect(200);
      expect(updated.body.estimatedMinutes).toBe(55);

      await request(app.getHttpServer())
        .delete(`/api/v1/days/${dayId}`)
        .set('Authorization', `Bearer ${trainerAToken}`)
        .expect(204);

      const after = await request(app.getHttpServer())
        .get(`/api/v1/programs/${programId}`)
        .set('Authorization', `Bearer ${trainerAToken}`)
        .expect(200);
      expect(after.body.days).toEqual([]);
    });
  });

  describe('duplicate + activate', () => {
    it('duplicates a program (with days/exercises/sets) as a new DRAFT for another student', async () => {
      const source = await request(app.getHttpServer())
        .post('/api/v1/programs')
        .set('Authorization', `Bearer ${trainerAToken}`)
        .send({ studentId: studentAId, name: `${prefix} Fonte` })
        .expect(201);

      const day = await request(app.getHttpServer())
        .post(`/api/v1/programs/${source.body.id}/days`)
        .set('Authorization', `Bearer ${trainerAToken}`)
        .send({ label: 'A' })
        .expect(201);

      await request(app.getHttpServer())
        .put(`/api/v1/days/${day.body.id}/exercises`)
        .set('Authorization', `Bearer ${trainerAToken}`)
        .send([{ exerciseId, orderIndex: 0, sets: [{ setNumber: 1, targetLoadKg: 50 }] }])
        .expect(200);

      const duplicated = await request(app.getHttpServer())
        .post(`/api/v1/programs/${source.body.id}/duplicate`)
        .set('Authorization', `Bearer ${trainerAToken}`)
        .send({ studentId: studentBId })
        .expect(201);

      expect(duplicated.body.studentId).toBe(studentBId);
      expect(duplicated.body.status).toBe('DRAFT');
      expect(duplicated.body.sourceProgramId).toBe(source.body.id);
      expect(duplicated.body.days).toHaveLength(1);
      expect(duplicated.body.days[0].exercises).toHaveLength(1);
      expect(duplicated.body.days[0].exercises[0].sets[0].targetLoadKg).toBe(50);
      // A fresh id per row — not a shallow copy of the source day/exercise ids.
      expect(duplicated.body.days[0].id).not.toBe(day.body.id);
    });

    it("activating a program archives the student's previously active one", async () => {
      const first = await request(app.getHttpServer())
        .post('/api/v1/programs')
        .set('Authorization', `Bearer ${trainerAToken}`)
        .send({ studentId: studentAId, name: `${prefix} Ativo 1` })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/programs/${first.body.id}/activate`)
        .set('Authorization', `Bearer ${trainerAToken}`)
        .expect(200);

      const second = await request(app.getHttpServer())
        .post('/api/v1/programs')
        .set('Authorization', `Bearer ${trainerAToken}`)
        .send({ studentId: studentAId, name: `${prefix} Ativo 2` })
        .expect(201);
      const activated = await request(app.getHttpServer())
        .post(`/api/v1/programs/${second.body.id}/activate`)
        .set('Authorization', `Bearer ${trainerAToken}`)
        .expect(200);
      expect(activated.body.status).toBe('ACTIVE');

      const firstAfter = await request(app.getHttpServer())
        .get(`/api/v1/programs/${first.body.id}`)
        .set('Authorization', `Bearer ${trainerAToken}`)
        .expect(200);
      expect(firstAfter.body.status).toBe('ARCHIVED');
    });

    it('refuses to activate a template', async () => {
      const template = await request(app.getHttpServer())
        .post('/api/v1/programs')
        .set('Authorization', `Bearer ${trainerAToken}`)
        .send({ isTemplate: true, name: `${prefix} Template Ativação` })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/programs/${template.body.id}/activate`)
        .set('Authorization', `Bearer ${trainerAToken}`)
        .expect(409);
    });
  });

  describe('GET /api/v1/programs', () => {
    it("lists only the caller's own programs, filterable by studentId/isTemplate", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/programs?studentId=${studentAId}&isTemplate=false&limit=50`)
        .set('Authorization', `Bearer ${trainerAToken}`)
        .expect(200);
      expect(res.body.items.length).toBeGreaterThan(0);
      for (const item of res.body.items) {
        expect(item.studentId).toBe(studentAId);
        expect(item.isTemplate).toBe(false);
      }
    });
  });
});
