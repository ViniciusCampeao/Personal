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
 * Exercises the M2 exercise-library CRUD/search/substitutes flow end to end. Fixtures
 * use a random prefix per run so assertions stay exact even though the shared dev
 * database may already hold the ~870-row Free Exercise DB import (see `pnpm db:seed`).
 */
describe('Exercises (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  const prefix = `e2e-ex-${randomUUID().slice(0, 8)}`;
  const password = 'senha-forte-123';

  let tenantId: string;
  let trainerToken: string;
  let studentToken: string;

  let otherTenantId: string;
  let otherTrainerToken: string;

  let globalExerciseId: string;
  let otherTenantCustomExerciseId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app, testEnv());
    await app.init();

    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(password);

    const tenant = await prisma.tenant.create({
      data: { name: 'E2E Tenant', slug: `${prefix}-a` },
    });
    tenantId = tenant.id;
    const trainerEmail = `${prefix}-trainer-a@e2e.local`;
    const trainer = await prisma.user.create({
      data: {
        tenantId,
        email: trainerEmail,
        name: 'Treinador A',
        role: 'TRAINER',
        status: 'ACTIVE',
        passwordHash,
      },
    });
    const studentEmail = `${prefix}-student-a@e2e.local`;
    await prisma.user.create({
      data: {
        tenantId,
        email: studentEmail,
        name: 'Aluno A',
        role: 'STUDENT',
        status: 'ACTIVE',
        passwordHash,
        studentProfile: { create: { tenantId, trainerId: trainer.id } },
      },
    });

    const otherTenant = await prisma.tenant.create({
      data: { name: 'E2E Tenant B', slug: `${prefix}-b` },
    });
    otherTenantId = otherTenant.id;
    const otherTrainerEmail = `${prefix}-trainer-b@e2e.local`;
    await prisma.user.create({
      data: {
        tenantId: otherTenantId,
        email: otherTrainerEmail,
        name: 'Treinador B',
        role: 'TRAINER',
        status: 'ACTIVE',
        passwordHash,
      },
    });

    const trainerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: trainerEmail, password })
      .expect(200);
    trainerToken = trainerLogin.body.accessToken;

    const studentLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: studentEmail, password })
      .expect(200);
    studentToken = studentLogin.body.accessToken;

    const otherTrainerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: otherTrainerEmail, password })
      .expect(200);
    otherTrainerToken = otherTrainerLogin.body.accessToken;

    // `movementPattern: CARRY` deliberately — the seeded Free Exercise DB catalog
    // (~870 rows, see `pnpm db:seed`) has only a handful of CARRY exercises, unlike
    // HORIZONTAL_PUSH/CHEST which has hundreds. That keeps the `/substitutes` assertion
    // below deterministic instead of depending on where an unordered query happens to
    // truncate at `take: 20` against real seeded data.
    const globalExercise = await prisma.exercise.create({
      data: {
        tenantId: null,
        name: `${prefix} Supino Reto Barra`,
        slug: `${prefix}-supino-reto`,
        movementPattern: 'CARRY',
        equipment: 'BARBELL',
        muscles: {
          createMany: {
            data: [
              { muscle: 'CHEST', role: 'PRIMARY' },
              { muscle: 'TRICEPS', role: 'SECONDARY' },
            ],
          },
        },
      },
    });
    globalExerciseId = globalExercise.id;

    await prisma.exercise.create({
      data: {
        tenantId: null,
        name: `${prefix} Supino Inclinado Halteres`,
        slug: `${prefix}-supino-inclinado`,
        movementPattern: 'CARRY',
        equipment: 'DUMBBELL',
        muscles: { createMany: { data: [{ muscle: 'CHEST', role: 'PRIMARY' }] } },
      },
    });

    await prisma.exercise.create({
      data: {
        tenantId: null,
        name: `${prefix} Remada Curvada`,
        slug: `${prefix}-remada-curvada`,
        movementPattern: 'HORIZONTAL_PULL',
        equipment: 'BARBELL',
        muscles: { createMany: { data: [{ muscle: 'BACK', role: 'PRIMARY' }] } },
      },
    });

    // Chest only as a SECONDARY muscle — the case that used to leak into the "Peito" filter.
    await prisma.exercise.create({
      data: {
        tenantId: null,
        name: `${prefix} Desenvolvimento Barra`,
        slug: `${prefix}-desenvolvimento-barra`,
        movementPattern: 'VERTICAL_PUSH',
        equipment: 'BARBELL',
        muscles: {
          createMany: {
            data: [
              { muscle: 'SHOULDERS', role: 'PRIMARY' },
              { muscle: 'CHEST', role: 'SECONDARY' },
            ],
          },
        },
      },
    });

    const otherCustom = await prisma.exercise.create({
      data: {
        tenantId: otherTenantId,
        name: `${prefix} Exercício Só do Tenant B`,
        slug: `${prefix}-so-tenant-b`,
        movementPattern: 'ISOLATION',
        equipment: 'MACHINE',
        muscles: { createMany: { data: [{ muscle: 'BICEPS', role: 'PRIMARY' }] } },
      },
    });
    otherTenantCustomExerciseId = otherCustom.id;
  });

  afterAll(async () => {
    await prisma.exercise.deleteMany({ where: { name: { startsWith: prefix } } });
    await prisma.studentProfile.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } });
    await app?.close();
  });

  describe('GET /api/v1/exercises', () => {
    it('lists global exercises visible to any authenticated tenant member', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/exercises?q=${encodeURIComponent(prefix)}&scope=global&limit=50`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      const names = res.body.items.map((e: { name: string }) => e.name);
      expect(names).toEqual(
        expect.arrayContaining([
          `${prefix} Supino Reto Barra`,
          `${prefix} Supino Inclinado Halteres`,
          `${prefix} Remada Curvada`,
        ]),
      );
    });

    it('filters by equipment and muscle', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/api/v1/exercises?q=${encodeURIComponent(prefix)}&equipment=DUMBBELL&muscle=CHEST&scope=global`,
        )
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].name).toBe(`${prefix} Supino Inclinado Halteres`);
    });

    it('filters by the muscle an exercise targets, not the ones it merely assists', async () => {
      // The barbell shoulder press lists the chest as a synergist; a trainer filtering by
      // "Peito" is not asking for it.
      const res = await request(app.getHttpServer())
        .get(`/api/v1/exercises?q=${encodeURIComponent(prefix)}&muscle=CHEST&scope=global&limit=50`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      const names = res.body.items.map((e: { name: string }) => e.name);
      expect(names).toEqual(
        expect.arrayContaining([
          `${prefix} Supino Reto Barra`,
          `${prefix} Supino Inclinado Halteres`,
        ]),
      );
      expect(names).not.toContain(`${prefix} Desenvolvimento Barra`);
    });

    it('paginates with a cursor', async () => {
      const first = await request(app.getHttpServer())
        .get(`/api/v1/exercises?q=${encodeURIComponent(prefix)}&scope=global&limit=2`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      expect(first.body.items).toHaveLength(2);
      expect(first.body.nextCursor).toEqual(expect.any(String));

      const second = await request(app.getHttpServer())
        .get(
          `/api/v1/exercises?q=${encodeURIComponent(prefix)}&scope=global&limit=2&cursor=${first.body.nextCursor}`,
        )
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      // Four global fixtures carry this prefix, so the second page is the last one.
      expect(second.body.items).toHaveLength(2);
      expect(second.body.nextCursor).toBeNull();

      const allNames = [...first.body.items, ...second.body.items].map(
        (e: { name: string }) => e.name,
      );
      expect(new Set(allNames).size).toBe(4);
    });

    it("does not leak another tenant's custom exercises under scope=all", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/exercises?q=${encodeURIComponent(prefix)}&limit=50`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);

      const names = res.body.items.map((e: { name: string }) => e.name);
      expect(names).not.toContain(`${prefix} Exercício Só do Tenant B`);
    });

    it("tenant B sees the same globals but not tenant A's customs", async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/exercises?q=${encodeURIComponent(prefix)}&limit=50`)
        .set('Authorization', `Bearer ${otherTrainerToken}`)
        .expect(200);

      const names = res.body.items.map((e: { name: string }) => e.name);
      expect(names).toContain(`${prefix} Supino Reto Barra`);
      expect(names).toContain(`${prefix} Exercício Só do Tenant B`);
    });
  });

  describe('GET /api/v1/exercises/:id', () => {
    it('returns a global exercise to any tenant', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/exercises/${globalExerciseId}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);
      expect(res.body.muscles).toEqual(
        expect.arrayContaining([{ muscle: 'CHEST', role: 'PRIMARY' }]),
      );
    });

    it("404s on another tenant's custom exercise", async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/exercises/${otherTenantCustomExerciseId}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(404);
    });
  });

  describe('POST /api/v1/exercises', () => {
    it('lets a TRAINER create a custom exercise', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/exercises')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          name: `${prefix} Exercício Custom`,
          movementPattern: 'ISOLATION',
          equipment: 'CABLE',
          muscles: [{ muscle: 'TRICEPS', role: 'PRIMARY' }],
        })
        .expect(201);
      expect(res.body.tenantId).toBe(tenantId);
    });

    it('forbids a STUDENT from creating an exercise', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/exercises')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          name: `${prefix} Não Deveria Existir`,
          movementPattern: 'ISOLATION',
          equipment: 'CABLE',
          muscles: [{ muscle: 'TRICEPS', role: 'PRIMARY' }],
        })
        .expect(403);
    });

    it('rejects a body that fails the shared Zod schema (no muscles)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/exercises')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          name: `${prefix} Sem Musculo`,
          movementPattern: 'ISOLATION',
          equipment: 'CABLE',
          muscles: [],
        })
        .expect(400);
      expect(Array.isArray(res.body.errors)).toBe(true);
    });
  });

  describe('PATCH /api/v1/exercises/:id', () => {
    it('lets the owning TRAINER update their own custom exercise', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/exercises')
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          name: `${prefix} Editável`,
          movementPattern: 'ISOLATION',
          equipment: 'CABLE',
          muscles: [{ muscle: 'BICEPS', role: 'PRIMARY' }],
        })
        .expect(201);

      const updated = await request(app.getHttpServer())
        .patch(`/api/v1/exercises/${created.body.id}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ unilateral: true })
        .expect(200);
      expect(updated.body.unilateral).toBe(true);
    });

    it('404s trying to patch a global exercise', async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/exercises/${globalExerciseId}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ unilateral: true })
        .expect(404);
    });

    it("404s trying to patch another tenant's custom exercise", async () => {
      await request(app.getHttpServer())
        .patch(`/api/v1/exercises/${otherTenantCustomExerciseId}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ unilateral: true })
        .expect(404);
    });
  });

  describe('GET /api/v1/exercises/:id/substitutes', () => {
    it('returns exercises with the same movement pattern and primary muscle, excluding itself', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/exercises/${globalExerciseId}/substitutes`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);

      const names = res.body.map((e: { id: string; name: string }) => e.name);
      expect(names).toContain(`${prefix} Supino Inclinado Halteres`);
      expect(names).not.toContain(`${prefix} Supino Reto Barra`);
      expect(names).not.toContain(`${prefix} Remada Curvada`);
    });
  });
});
