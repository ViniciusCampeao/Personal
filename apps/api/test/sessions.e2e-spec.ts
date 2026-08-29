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
 * Exercises the M4 execution flow end to end: `/me/today`, session lifecycle (start,
 * log sets, substitute, finish), idempotency by `clientUuid`, and PR recalculation.
 * Program/day/prescription fixtures are built through the already-tested M3 endpoints
 * rather than raw Prisma, so this spec exercises the real stack top to bottom.
 */
describe('Sessions (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  const prefix = `e2e-se-${randomUUID().slice(0, 8)}`;
  const password = 'senha-forte-123';

  let tenantId: string;
  let trainerToken: string;
  let studentToken: string;
  let studentId: string;

  let otherTenantTrainerToken: string;

  let exerciseAId: string; // prescribed originally
  let exerciseBId: string; // valid substitute (same pattern + primary muscle)
  let exerciseCId: string; // invalid substitute (different pattern)

  let programId: string;
  let dayAId: string;
  let dayBId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app, testEnv());
    await app.init();

    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(password);

    const tenant = await prisma.tenant.create({ data: { name: 'E2E Sessions', slug: prefix } });
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
      data: { name: 'E2E Sessions B', slug: `${prefix}-other` },
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

    // `movementPattern: CARRY` deliberately — same reasoning as exercises.e2e-spec.ts:
    // the seeded Free Exercise DB catalog has hundreds of HORIZONTAL_PUSH/CHEST rows,
    // which would make `substitutes()`'s unordered `take: 20` miss this fixture
    // non-deterministically. CARRY has only a handful of real matches.
    const exerciseA = await prisma.exercise.create({
      data: {
        tenantId: null,
        name: `${prefix} Supino Reto`,
        slug: `${prefix}-supino-reto`,
        movementPattern: 'CARRY',
        equipment: 'BARBELL',
        muscles: { createMany: { data: [{ muscle: 'CHEST', role: 'PRIMARY' }] } },
      },
    });
    exerciseAId = exerciseA.id;

    const exerciseB = await prisma.exercise.create({
      data: {
        tenantId: null,
        name: `${prefix} Supino Halteres`,
        slug: `${prefix}-supino-halteres`,
        movementPattern: 'CARRY',
        equipment: 'DUMBBELL',
        muscles: { createMany: { data: [{ muscle: 'CHEST', role: 'PRIMARY' }] } },
      },
    });
    exerciseBId = exerciseB.id;

    const exerciseC = await prisma.exercise.create({
      data: {
        tenantId: null,
        name: `${prefix} Remada Curvada`,
        slug: `${prefix}-remada-curvada`,
        movementPattern: 'HORIZONTAL_PULL',
        equipment: 'BARBELL',
        muscles: { createMany: { data: [{ muscle: 'BACK', role: 'PRIMARY' }] } },
      },
    });
    exerciseCId = exerciseC.id;

    // Build program → day A / day B → prescribed exercise, through the M3 endpoints.
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
        { exerciseId: exerciseAId, orderIndex: 0, sets: [{ setNumber: 1, targetLoadKg: 60 }] },
      ])
      .expect(200);
  });

  afterAll(async () => {
    await prisma.personalRecord.deleteMany({ where: { tenantId } });
    await prisma.sessionComment.deleteMany({ where: { tenantId } });
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

  describe('GET /api/v1/me/today', () => {
    it('reports no active program before activation', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/me/today')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      expect(res.body.hasActiveProgram).toBe(false);
    });

    it('forbids a TRAINER from calling a student-only endpoint', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/me/today')
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(403);
    });

    it('returns day A once the program is active, with no prefill yet', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/programs/${programId}/activate`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/api/v1/me/today')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      expect(res.body.hasActiveProgram).toBe(true);
      expect(res.body.workoutDayId).toBe(dayAId);
      expect(res.body.exercises).toHaveLength(1);
      expect(res.body.exercises[0].exerciseId).toBe(exerciseAId);
      expect(res.body.exercises[0].lastPerformance).toBeNull();
    });
  });

  describe('session lifecycle', () => {
    let sessionId: string;
    let sessionExerciseId: string;
    const startClientUuid = randomUUID();

    it('starts a session idempotently, snapshotting the prescribed exercises', async () => {
      const first = await request(app.getHttpServer())
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ clientUuid: startClientUuid, workoutDayId: dayAId, startedAt: new Date() })
        .expect(201);
      sessionId = first.body.id;
      sessionExerciseId = first.body.exercises[0].id;
      expect(first.body.status).toBe('IN_PROGRESS');
      expect(first.body.exercises).toHaveLength(1);

      const replay = await request(app.getHttpServer())
        .post('/api/v1/sessions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ clientUuid: startClientUuid, workoutDayId: dayAId, startedAt: new Date() })
        .expect(201);
      expect(replay.body.id).toBe(sessionId);

      const count = await prisma.workoutSession.count({ where: { clientUuid: startClientUuid } });
      expect(count).toBe(1);
    });

    it('logs a set idempotently and computes estimated1rm', async () => {
      const setClientUuid = randomUUID();
      const first = await request(app.getHttpServer())
        .post(`/api/v1/sessions/${sessionId}/sets`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          clientUuid: setClientUuid,
          sessionExerciseId,
          setNumber: 1,
          reps: 8,
          loadKg: 60,
          doneAt: new Date(),
        })
        .expect(201);
      expect(first.body.estimated1rm).toBeCloseTo(60 * (1 + 8 / 30), 5);

      const replay = await request(app.getHttpServer())
        .post(`/api/v1/sessions/${sessionId}/sets`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          clientUuid: setClientUuid,
          sessionExerciseId,
          setNumber: 1,
          reps: 8,
          loadKg: 60,
          doneAt: new Date(),
        })
        .expect(201);
      expect(replay.body.id).toBe(first.body.id);

      const count = await prisma.setLog.count({ where: { clientUuid: setClientUuid } });
      expect(count).toBe(1);
    });

    it('rejects an invalid substitute (different pattern/muscle)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/sessions/${sessionId}/exercises/${sessionExerciseId}/substitute`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ exerciseId: exerciseCId })
        .expect(422);
    });

    it('accepts a valid substitute (same pattern + primary muscle)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/sessions/${sessionId}/exercises/${sessionExerciseId}/substitute`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ exerciseId: exerciseBId, reason: 'barra ocupada' })
        .expect(200);
      expect(res.body.exerciseId).toBe(exerciseBId);
      expect(res.body.substitutedFromExerciseId).toBe(exerciseAId);
    });

    it('finishes the session, computing totalVolumeKg and recording a PR for the substitute', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/sessions/${sessionId}/finish`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ finishedAt: new Date(), perceivedEffort: 7 })
        .expect(201);
      expect(res.body.status).toBe('COMPLETED');
      expect(res.body.totalVolumeKg).toBeCloseTo(8 * 60, 5);

      // The set was logged before the substitution took effect on the SessionExercise,
      // so the PR attaches to exerciseB (what the session ended up crediting) — the
      // original exercise's own PR history is untouched (spec §6).
      const prs = await prisma.personalRecord.findMany({
        where: { studentId, exerciseId: exerciseBId },
      });
      expect(prs.map((pr) => pr.type).sort()).toEqual([
        'EST_1RM',
        'MAX_LOAD',
        'MAX_REPS',
        'MAX_SET_VOLUME',
      ]);
      const maxLoad = prs.find((pr) => pr.type === 'MAX_LOAD');
      expect(maxLoad?.value).toBe(60);

      const untouched = await prisma.personalRecord.count({
        where: { studentId, exerciseId: exerciseAId },
      });
      expect(untouched).toBe(0);
    });

    it('refuses to log a set on an already-finished session', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/sessions/${sessionId}/sets`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ clientUuid: randomUUID(), sessionExerciseId, setNumber: 2, doneAt: new Date() })
        .expect(409);
    });

    it('advances /me/today to day B after finishing day A', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/me/today')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      expect(res.body.workoutDayId).toBe(dayBId);
    });

    it("lets the trainer read the student's finished session and comment on it", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);
      expect(res.body.status).toBe('COMPLETED');

      await request(app.getHttpServer())
        .post(`/api/v1/sessions/${sessionId}/comments`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ body: 'Bom treino!' })
        .expect(201);

      const comments = await prisma.sessionComment.findMany({ where: { sessionId } });
      expect(comments).toHaveLength(1);
    });


    it("404s another tenant's trainer trying to read the session", async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${otherTenantTrainerToken}`)
        .expect(404);
    });

    it('lists the session in the student history', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/students/${studentId}/sessions`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);
      expect(res.body.items.some((s: { id: string }) => s.id === sessionId)).toBe(true);
    });
  });

  describe('POST /api/v1/sessions/sync (M7 offline outbox replay)', () => {
    let dayBPrescribedExerciseId: string;

    beforeAll(async () => {
      // Day B was untouched by the earlier lifecycle block — assign it a prescribed
      // exercise so the sync batch below has something to reference.
      await request(app.getHttpServer())
        .put(`/api/v1/days/${dayBId}/exercises`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send([
          { exerciseId: exerciseAId, orderIndex: 0, sets: [{ setNumber: 1, targetLoadKg: 60 }] },
        ])
        .expect(200);

      const today = await request(app.getHttpServer())
        .get('/api/v1/me/today')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      expect(today.body.workoutDayId).toBe(dayBId);
      dayBPrescribedExerciseId = today.body.exercises[0].prescribedExerciseId;
    });

    it('forbids a TRAINER from syncing', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/sessions/sync')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          items: [
            {
              type: 'START',
              payload: { clientUuid: randomUUID(), workoutDayId: dayBId, startedAt: new Date() },
            },
          ],
        })
        .expect(403);
    });

    it('replays a full offline batch (start, log_set, finish) resolving by clientUuid/prescribedExerciseId, and is idempotent on retry', async () => {
      const sessionClientUuid = randomUUID();
      const setClientUuid = randomUUID();
      const batch = {
        items: [
          {
            type: 'START',
            payload: { clientUuid: sessionClientUuid, workoutDayId: dayBId, startedAt: new Date() },
          },
          {
            type: 'LOG_SET',
            sessionClientUuid,
            prescribedExerciseId: dayBPrescribedExerciseId,
            payload: {
              clientUuid: setClientUuid,
              setNumber: 1,
              reps: 8,
              loadKg: 60,
              doneAt: new Date(),
            },
          },
          {
            type: 'FINISH',
            sessionClientUuid,
            payload: { finishedAt: new Date() },
          },
        ],
      };

      const first = await request(app.getHttpServer())
        .post('/api/v1/sessions/sync')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(batch)
        .expect(201);
      expect(first.body.results).toHaveLength(3);
      expect(first.body.results.every((r: { status: string }) => r.status === 'OK')).toBe(true);
      const syncedSessionId = first.body.results[0].sessionId;
      expect(syncedSessionId).toBeTruthy();

      // Replaying the exact same batch must not duplicate anything.
      const replay = await request(app.getHttpServer())
        .post('/api/v1/sessions/sync')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(batch)
        .expect(201);
      expect(replay.body.results.every((r: { status: string }) => r.status === 'OK')).toBe(true);

      const sessionCount = await prisma.workoutSession.count({
        where: { clientUuid: sessionClientUuid },
      });
      expect(sessionCount).toBe(1);
      const setCount = await prisma.setLog.count({ where: { clientUuid: setClientUuid } });
      expect(setCount).toBe(1);

      const session = await prisma.workoutSession.findUniqueOrThrow({
        where: { id: syncedSessionId },
      });
      expect(session.status).toBe('COMPLETED');
      expect(session.totalVolumeKg).toBeCloseTo(8 * 60, 5);
    });

    it('replaying a SUBSTITUTE item in the same batch does not corrupt substitutedFromExerciseId', async () => {
      const sessionClientUuid = randomUUID();
      const batch = {
        items: [
          {
            type: 'START',
            payload: { clientUuid: sessionClientUuid, workoutDayId: dayBId, startedAt: new Date() },
          },
          {
            type: 'SUBSTITUTE',
            sessionClientUuid,
            prescribedExerciseId: dayBPrescribedExerciseId,
            payload: { exerciseId: exerciseBId, reason: 'indisponível' },
          },
          {
            type: 'SUBSTITUTE',
            sessionClientUuid,
            prescribedExerciseId: dayBPrescribedExerciseId,
            payload: { exerciseId: exerciseBId, reason: 'indisponível' },
          },
        ],
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/sessions/sync')
        .set('Authorization', `Bearer ${studentToken}`)
        .send(batch)
        .expect(201);
      expect(res.body.results.every((r: { status: string }) => r.status === 'OK')).toBe(true);

      const sessionExercise = await prisma.sessionExercise.findFirstOrThrow({
        where: {
          session: { clientUuid: sessionClientUuid },
          prescribedExerciseId: dayBPrescribedExerciseId,
        },
      });
      expect(sessionExercise.exerciseId).toBe(exerciseBId);
      expect(sessionExercise.substitutedFromExerciseId).toBe(exerciseAId);
    });

    it('applies last-write-wins by finishedAt for a FINISH replayed against an already-completed session', async () => {
      const sessionClientUuid = randomUUID();
      const t1 = new Date();
      const t2 = new Date(t1.getTime() + 60_000);
      const t0 = new Date(t1.getTime() - 60_000);

      await request(app.getHttpServer())
        .post('/api/v1/sessions/sync')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          items: [
            {
              type: 'START',
              payload: { clientUuid: sessionClientUuid, workoutDayId: dayBId, startedAt: t1 },
            },
            { type: 'FINISH', sessionClientUuid, payload: { finishedAt: t1, perceivedEffort: 5 } },
          ],
        })
        .expect(201);

      // Older finishedAt than what's stored -> no-op.
      await request(app.getHttpServer())
        .post('/api/v1/sessions/sync')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          items: [
            { type: 'FINISH', sessionClientUuid, payload: { finishedAt: t0, perceivedEffort: 1 } },
          ],
        })
        .expect(201);
      let session = await prisma.workoutSession.findUniqueOrThrow({
        where: { clientUuid: sessionClientUuid },
      });
      expect(session.perceivedEffort).toBe(5);

      // Newer finishedAt -> overwrites.
      await request(app.getHttpServer())
        .post('/api/v1/sessions/sync')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          items: [
            { type: 'FINISH', sessionClientUuid, payload: { finishedAt: t2, perceivedEffort: 9 } },
          ],
        })
        .expect(201);
      session = await prisma.workoutSession.findUniqueOrThrow({
        where: { clientUuid: sessionClientUuid },
      });
      expect(session.perceivedEffort).toBe(9);
      expect(session.finishedAt?.getTime()).toBe(t2.getTime());
    });

    it('reports a per-item ERROR without failing the rest of the batch', async () => {
      const goodClientUuid = randomUUID();
      const res = await request(app.getHttpServer())
        .post('/api/v1/sessions/sync')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          items: [
            {
              type: 'START',
              payload: { clientUuid: goodClientUuid, workoutDayId: dayBId, startedAt: new Date() },
            },
            {
              type: 'LOG_SET',
              sessionClientUuid: randomUUID(), // never started -> unresolvable
              prescribedExerciseId: dayBPrescribedExerciseId,
              payload: { clientUuid: randomUUID(), setNumber: 1, doneAt: new Date() },
            },
          ],
        })
        .expect(201);
      expect(res.body.results[0].status).toBe('OK');
      expect(res.body.results[1].status).toBe('ERROR');
    });
  });
});
