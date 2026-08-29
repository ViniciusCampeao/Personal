import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { type NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { hashPassword } from '../src/common/auth/password';
import { startOfWeekUtc } from '../src/common/util/week';
import { testEnv } from './test-env';

const DAY = 86_400_000;

/**
 * Exercises the M8 trainer dashboard: each of the four "aluno em risco" criteria from
 * spec §6 in isolation, plus the three other widgets.
 */
describe('Dashboard (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  const prefix = `e2e-db-${randomUUID().slice(0, 8)}`;
  const password = 'senha-forte-123';

  let tenantId: string;
  let trainerId: string;
  let trainerToken: string;
  let studentToken: string;

  let exerciseId: string;
  // One student per criterion, so each assertion isolates a single rule.
  let staleId: string; // no session for 12 days
  let stagnantId: string; // e1RM flat/declining
  let sorenessId: string; // soreness >= 4 two consecutive weeks
  let healthyId: string; // trained today, check-in submitted, PR this week

  async function createStudent(handle: string): Promise<string> {
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        tenantId,
        email: `${prefix}-${handle}@e2e.local`,
        name: `Aluno ${handle}`,
        role: 'STUDENT',
        status: 'ACTIVE',
        passwordHash,
        studentProfile: { create: { tenantId, trainerId } },
      },
    });
    return user.id;
  }

  /** A completed session with one set, used to drive both adherence and e1RM history. */
  async function completedSession(
    studentId: string,
    at: Date,
    estimated1rm: number | null,
  ): Promise<string> {
    const session = await prisma.workoutSession.create({
      data: {
        tenantId,
        studentId,
        clientUuid: randomUUID(),
        status: 'COMPLETED',
        startedAt: at,
        finishedAt: at,
      },
    });
    const sessionExercise = await prisma.sessionExercise.create({
      data: { sessionId: session.id, exerciseId, orderIndex: 0 },
    });
    await prisma.setLog.create({
      data: {
        sessionExerciseId: sessionExercise.id,
        clientUuid: randomUUID(),
        setNumber: 1,
        setType: 'WORK',
        reps: 8,
        loadKg: 60,
        estimated1rm,
        doneAt: at,
      },
    });
    return session.id;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app, testEnv());
    await app.init();

    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(password);

    const tenant = await prisma.tenant.create({ data: { name: 'E2E Dashboard', slug: prefix } });
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
    trainerId = trainer.id;

    const exercise = await prisma.exercise.create({
      data: {
        tenantId: null,
        name: `${prefix} Agachamento`,
        slug: `${prefix}-agachamento`,
        movementPattern: 'SQUAT',
        equipment: 'BARBELL',
      },
    });
    exerciseId = exercise.id;

    staleId = await createStudent('stale');
    stagnantId = await createStudent('stagnant');
    sorenessId = await createStudent('soreness');
    healthyId = await createStudent('healthy');

    studentToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: `${prefix}-healthy@e2e.local`, password })
        .expect(200)
    ).body.accessToken;
    trainerToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: `${prefix}-trainer@e2e.local`, password })
        .expect(200)
    ).body.accessToken;

    // --- stale: last completed session 12 days ago (>= 10 → NO_SESSION_10_DAYS).
    await completedSession(staleId, new Date(Date.now() - 12 * DAY), 100);

    // --- stagnant: an ACTIVE program with one prescribed exercise, and an e1RM series
    // whose most recent value is below the oldest one inside the 6-week window.
    const stagnantProgram = await prisma.program.create({
      data: {
        tenantId,
        trainerId,
        studentId: stagnantId,
        name: `${prefix} Prog`,
        status: 'ACTIVE',
      },
    });
    const day = await prisma.workoutDay.create({
      data: { programId: stagnantProgram.id, label: 'A', orderIndex: 0 },
    });
    await prisma.prescribedExercise.create({
      data: { workoutDayId: day.id, exerciseId, orderIndex: 0 },
    });
    await completedSession(stagnantId, new Date(Date.now() - 20 * DAY), 120);
    await completedSession(stagnantId, new Date(Date.now() - 2 * DAY), 110);

    // --- soreness: two consecutive weeks with soreness >= 4.
    const thisMonday = startOfWeekUtc(new Date());
    const lastMonday = new Date(thisMonday.getTime() - 7 * DAY);
    await prisma.checkIn.createMany({
      data: [
        { tenantId, studentId: sorenessId, weekStart: thisMonday, soreness: 5, stress: 2 },
        { tenantId, studentId: sorenessId, weekStart: lastMonday, soreness: 4, stress: 1 },
      ],
    });
    await completedSession(sorenessId, new Date(Date.now() - 1 * DAY), 100);

    // --- healthy: trained today, check-in submitted this week, PR earned yesterday.
    await completedSession(healthyId, new Date(), 100);
    await prisma.checkIn.create({
      data: { tenantId, studentId: healthyId, weekStart: thisMonday, soreness: 1, stress: 1 },
    });
    await prisma.personalRecord.create({
      data: {
        tenantId,
        studentId: healthyId,
        exerciseId,
        type: 'MAX_LOAD',
        value: 100,
        achievedAt: new Date(Date.now() - 1 * DAY),
      },
    });
  });

  afterAll(async () => {
    await prisma.personalRecord.deleteMany({ where: { tenantId } });
    await prisma.checkIn.deleteMany({ where: { tenantId } });
    await prisma.notification.deleteMany({ where: { tenantId } });
    await prisma.setLog.deleteMany({ where: { sessionExercise: { session: { tenantId } } } });
    await prisma.sessionExercise.deleteMany({ where: { session: { tenantId } } });
    await prisma.workoutSession.deleteMany({ where: { tenantId } });
    await prisma.prescribedExercise.deleteMany({
      where: { workoutDay: { program: { tenantId } } },
    });
    await prisma.workoutDay.deleteMany({ where: { program: { tenantId } } });
    await prisma.program.deleteMany({ where: { tenantId } });
    await prisma.exercise.deleteMany({ where: { name: { startsWith: prefix } } });
    await prisma.studentProfile.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await app?.close();
  });

  describe('GET /api/v1/dashboard', () => {
    it('forbids a STUDENT', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
    });

    it('flags a student with no session in the last 10 days', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);

      const stale = res.body.atRiskStudents.find(
        (s: { studentId: string }) => s.studentId === staleId,
      );
      expect(stale.reasons).toContain('NO_SESSION_10_DAYS');
    });

    it('flags a student whose e1RM is flat or declining', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);

      const stagnant = res.body.atRiskStudents.find(
        (s: { studentId: string }) => s.studentId === stagnantId,
      );
      expect(stagnant.reasons).toContain('E1RM_STAGNATION');
    });

    it('flags a student with soreness >= 4 two weeks running', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);

      const sore = res.body.atRiskStudents.find(
        (s: { studentId: string }) => s.studentId === sorenessId,
      );
      expect(sore.reasons).toContain('HIGH_SORENESS_OR_STRESS');
    });

    it('does not flag the healthy student for soreness or staleness', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);

      const healthy = res.body.atRiskStudents.find(
        (s: { studentId: string }) => s.studentId === healthyId,
      );
      // LOW_ADHERENCE still fires (no active program → 0 expected sessions), but the
      // criteria this student is meant to clear must not.
      expect(healthy?.reasons ?? []).not.toContain('HIGH_SORENESS_OR_STRESS');
      expect(healthy?.reasons ?? []).not.toContain('NO_SESSION_10_DAYS');
    });

    it('reports who trained today', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);

      expect(res.body.workoutsToday).toHaveLength(4);
      const healthy = res.body.workoutsToday.find(
        (w: { studentId: string }) => w.studentId === healthyId,
      );
      expect(healthy.status).toBe('COMPLETED');
      const stale = res.body.workoutsToday.find(
        (w: { studentId: string }) => w.studentId === staleId,
      );
      expect(stale.status).toBe('NOT_STARTED');
    });

    it('reports PRs from the last 7 days', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);

      expect(res.body.recentPRs).toHaveLength(1);
      expect(res.body.recentPRs[0].studentId).toBe(healthyId);
      expect(res.body.recentPRs[0].exerciseName).toBe(`${prefix} Agachamento`);
    });

    it('reports who still owes a check-in this week', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);

      const pendingIds = res.body.pendingCheckIns.map((p: { studentId: string }) => p.studentId);
      expect(pendingIds).toContain(staleId);
      expect(pendingIds).toContain(stagnantId);
      expect(pendingIds).not.toContain(healthyId);
      expect(pendingIds).not.toContain(sorenessId);
    });
  });
});
