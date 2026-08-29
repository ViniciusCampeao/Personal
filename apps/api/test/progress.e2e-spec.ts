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
 * Exercises the M5 progress endpoints: exercise time series, volume by muscle,
 * adherence, PR listing, and double-progression suggestions (spec §6). Fixtures reuse
 * M3/M4 endpoints for program/session setup, same approach as sessions.e2e-spec.ts.
 */
describe('Progress (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  const prefix = `e2e-pg-${randomUUID().slice(0, 8)}`;
  const password = 'senha-forte-123';

  let tenantId: string;
  let trainerToken: string;
  let studentToken: string;
  let studentId: string;
  let otherTenantTrainerToken: string;

  // Day A / exercise A: single completed session that meets the "increase" criteria.
  let exerciseAId: string;
  let dayAId: string;

  // Day B / exercise B: two completed sessions that both fail the minimum rep range.
  let exerciseBId: string;
  let dayBId: string;

  let programId: string;

  async function runSession(
    workoutDayId: string,
    exerciseId: string,
    reps: number,
    loadKg: number,
    rir: number,
  ) {
    const start = await request(app.getHttpServer())
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ clientUuid: randomUUID(), workoutDayId, startedAt: new Date() })
      .expect(201);
    const sessionId: string = start.body.id;
    const sessionExercise = start.body.exercises.find(
      (e: { exerciseId: string }) => e.exerciseId === exerciseId,
    );

    await request(app.getHttpServer())
      .post(`/api/v1/sessions/${sessionId}/sets`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        clientUuid: randomUUID(),
        sessionExerciseId: sessionExercise.id,
        setNumber: 1,
        reps,
        loadKg,
        rir,
        doneAt: new Date(),
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/sessions/${sessionId}/finish`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ finishedAt: new Date() })
      .expect(201);

    return sessionId;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app, testEnv());
    await app.init();

    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(password);

    const tenant = await prisma.tenant.create({ data: { name: 'E2E Progress', slug: prefix } });
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

    const otherTenant = await prisma.tenant.create({
      data: { name: 'E2E Progress B', slug: `${prefix}-other` },
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
    otherTenantTrainerToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: `${prefix}-other-trainer@e2e.local`, password })
        .expect(200)
    ).body.accessToken;

    // movementPattern SQUAT -> the +5% branch; primary muscle CHEST just so the volume
    // assertion below has a stable, exclusive bucket to check.
    const exerciseA = await prisma.exercise.create({
      data: {
        tenantId: null,
        name: `${prefix} Agachamento`,
        slug: `${prefix}-agachamento`,
        movementPattern: 'SQUAT',
        equipment: 'BARBELL',
        muscles: { createMany: { data: [{ muscle: 'CHEST', role: 'PRIMARY' }] } },
      },
    });
    exerciseAId = exerciseA.id;

    const exerciseB = await prisma.exercise.create({
      data: {
        tenantId: null,
        name: `${prefix} Remada`,
        slug: `${prefix}-remada`,
        movementPattern: 'HORIZONTAL_PULL',
        equipment: 'BARBELL',
        muscles: { createMany: { data: [{ muscle: 'BACK', role: 'PRIMARY' }] } },
      },
    });
    exerciseBId = exerciseB.id;

    const program = await request(app.getHttpServer())
      .post('/api/v1/programs')
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ studentId, name: `${prefix} Programa` })
      .expect(201);
    programId = program.body.id;

    const dayA = await request(app.getHttpServer())
      .post(`/api/v1/programs/${programId}/days`)
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ label: 'A' })
      .expect(201);
    dayAId = dayA.body.id;

    const dayB = await request(app.getHttpServer())
      .post(`/api/v1/programs/${programId}/days`)
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ label: 'B', orderIndex: 1 })
      .expect(201);
    dayBId = dayB.body.id;

    await request(app.getHttpServer())
      .put(`/api/v1/days/${dayAId}/exercises`)
      .set('Authorization', `Bearer ${trainerToken}`)
      .send([
        {
          exerciseId: exerciseAId,
          orderIndex: 0,
          sets: [{ setNumber: 1, repsMin: 6, repsMax: 8, targetRir: 2, targetLoadKg: 100 }],
        },
      ])
      .expect(200);

    await request(app.getHttpServer())
      .put(`/api/v1/days/${dayBId}/exercises`)
      .set('Authorization', `Bearer ${trainerToken}`)
      .send([
        {
          exerciseId: exerciseBId,
          orderIndex: 0,
          sets: [{ setNumber: 1, repsMin: 6, repsMax: 10, targetRir: 2, targetLoadKg: 50 }],
        },
      ])
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/programs/${programId}/activate`)
      .set('Authorization', `Bearer ${trainerToken}`)
      .expect(200);

    // Exercise A: one session at the top of the rep range with RIR at target -> increase.
    await runSession(dayAId, exerciseAId, 8, 100, 2);

    // Exercise B: two consecutive sessions below the minimum rep range -> decrease.
    await runSession(dayBId, exerciseBId, 4, 50, 5);
    await runSession(dayBId, exerciseBId, 4, 50, 5);
  });

  afterAll(async () => {
    await prisma.personalRecord.deleteMany({ where: { tenantId } });
    await prisma.setLog.deleteMany({ where: { sessionExercise: { session: { tenantId } } } });
    await prisma.sessionExercise.deleteMany({ where: { session: { tenantId } } });
    await prisma.workoutSession.deleteMany({ where: { tenantId } });
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

  describe('GET /api/v1/students/:id/progress/exercises/:exerciseId', () => {
    it("returns only the sets logged under that exercise's own id", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/students/${studentId}/progress/exercises/${exerciseAId}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].reps).toBe(8);
      expect(res.body[0].loadKg).toBe(100);
      expect(res.body[0].volumeKg).toBe(800);
    });

    it('404s a studentId the trainer does not own', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/students/${studentId}/progress/exercises/${exerciseAId}`)
        .set('Authorization', `Bearer ${otherTenantTrainerToken}`)
        .expect(404);
    });
  });

  describe('GET /api/v1/students/:id/progress/volume', () => {
    it('attributes volume to the exercise primary muscle for the current week', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/students/${studentId}/progress/volume?muscle=CHEST`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].muscle).toBe('CHEST');
      expect(res.body[0].volumeKg).toBe(800);
    });
  });

  describe('GET /api/v1/students/:id/progress/adherence', () => {
    it('divides completed sessions by the active program day count', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/students/${studentId}/progress/adherence?weeks=1`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].expectedSessions).toBe(2); // day A + day B
      expect(res.body[0].completedSessions).toBe(3); // 1 on day A + 2 on day B
      expect(res.body[0].adherenceRatio).toBeCloseTo(1.5, 5);
    });
  });

  describe('GET /api/v1/students/:id/records', () => {
    it('lists the PRs recorded by M4 finish()', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/students/${studentId}/records`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);
      const exerciseIds = res.body.map((r: { exerciseId: string }) => r.exerciseId);
      expect(exerciseIds).toContain(exerciseAId);
      expect(exerciseIds).toContain(exerciseBId);
    });
  });

  describe('GET /api/v1/students/:id/progression-suggestions', () => {
    it('suggests +5% for a lower body compound that met the top-of-range + RIR criteria', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/students/${studentId}/progression-suggestions`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);

      const suggestionA = res.body.find(
        (s: { exerciseId: string }) => s.exerciseId === exerciseAId,
      );
      expect(suggestionA).toBeDefined();
      expect(suggestionA.direction).toBe('INCREASE');
      expect(suggestionA.pct).toBe(0.05);
      expect(suggestionA.suggestedLoadKg).toBe(105);

      const suggestionB = res.body.find(
        (s: { exerciseId: string }) => s.exerciseId === exerciseBId,
      );
      expect(suggestionB).toBeDefined();
      expect(suggestionB.direction).toBe('DECREASE');
      expect(suggestionB.pct).toBe(-0.1);
      expect(suggestionB.suggestedLoadKg).toBe(45);
    });

    it('lets the student read their own suggestions', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/students/${studentId}/progression-suggestions`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
    });

    it("404s another student's id", async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/students/${randomUUID()}/progression-suggestions`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(404);
    });
  });
});
