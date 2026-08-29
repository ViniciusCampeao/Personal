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
 * Exercises the M6 anamnesis flow: consent gating, versioning (never overwrites),
 * field encryption at rest (spec §10.3), and audit logging of non-titular reads
 * (spec §10.6).
 */
describe('Anamnesis (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  const prefix = `e2e-an-${randomUUID().slice(0, 8)}`;
  const password = 'senha-forte-123';

  let tenantId: string;
  let trainerId: string;
  let trainerToken: string;
  let studentToken: string;
  let studentId: string;
  let otherTenantTrainerToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app, testEnv());
    await app.init();

    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(password);

    const tenant = await prisma.tenant.create({ data: { name: 'E2E Anamnesis', slug: prefix } });
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
      data: { name: 'E2E Anamnesis B', slug: `${prefix}-other` },
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
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { tenantId } });
    await prisma.consent.deleteMany({ where: { tenantId } });
    await prisma.medicalClearance.deleteMany({ where: { tenantId } });
    await prisma.anamnesis.deleteMany({ where: { tenantId } });
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

  describe('POST /api/v1/students/:id/anamnesis', () => {
    it('refuses to create without accepting the health data consent', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/students/${studentId}/anamnesis`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ parq: { q1: true }, healthDataConsent: { accepted: false } })
        .expect(422);
    });

    it('creates version 1, records the consent, and encrypts sensitive fields at rest', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/students/${studentId}/anamnesis`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          parq: { q1: true, q2: false },
          injuries: [{ description: 'lesão no ombro direito' }],
          conditions: 'hipertensão controlada',
          healthDataConsent: { accepted: true },
        })
        .expect(201);
      expect(res.body.version).toBe(1);
      expect(res.body.parq).toEqual({ q1: true, q2: false });
      expect(res.body.conditions).toBe('hipertensão controlada');

      const row = await prisma.anamnesis.findUniqueOrThrow({
        where: { studentId_version: { studentId, version: 1 } },
      });
      // Ciphertext at rest — the plaintext must not appear in the stored column.
      expect(row.conditions).not.toContain('hipertensão');
      expect(row.parq).not.toContain('q1');

      const consents = await prisma.consent.findMany({
        where: { userId: studentId, type: 'HEALTH_DATA' },
      });
      expect(consents).toHaveLength(1);
    });

    it('creates a new version without overwriting the previous one, and reuses the existing consent', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/students/${studentId}/anamnesis`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ parq: { q1: false }, healthDataConsent: { accepted: false } })
        .expect(201); // consent already granted by the student — trainer doesn't need to re-accept
      // note: accepted:false above still succeeds because a prior consent already exists.

      const versions = await prisma.anamnesis.findMany({ where: { studentId } });
      expect(versions.map((v) => v.version).sort()).toEqual([1, 2]);

      const consents = await prisma.consent.findMany({
        where: { userId: studentId, type: 'HEALTH_DATA' },
      });
      expect(consents).toHaveLength(1);
    });
  });

  describe('GET /api/v1/students/:id/anamnesis', () => {
    it('returns the full version history, most recent first, and no audit log for the own student', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/students/${studentId}/anamnesis`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      expect(res.body.versions.map((v: { version: number }) => v.version)).toEqual([2, 1]);

      const logs = await prisma.auditLog.findMany({ where: { tenantId, actorId: studentId } });
      expect(logs).toHaveLength(0);
    });

    it('logs an AuditLog entry when a trainer (non-titular) reads it', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/students/${studentId}/anamnesis`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);

      const logs = await prisma.auditLog.findMany({
        where: { tenantId, actorId: trainerId, entity: 'Anamnesis' },
      });
      expect(logs.length).toBeGreaterThan(0);
    });

    it("404s another tenant's trainer", async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/students/${studentId}/anamnesis`)
        .set('Authorization', `Bearer ${otherTenantTrainerToken}`)
        .expect(404);
    });
  });

  describe('POST /api/v1/students/:id/medical-clearance', () => {
    it('registers a clearance and surfaces it in the anamnesis GET', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/students/${studentId}/medical-clearance`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ fileKey: `medical-clearances/${tenantId}/atestado.pdf` })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/students/${studentId}/anamnesis`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      expect(res.body.medicalClearance).not.toBeNull();
      expect(res.body.medicalClearance.fileUrl).toContain('http');
    });
  });
});
