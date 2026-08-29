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
 * Exercises the M6 assessment flow: server-side %BF/BMI calculation (GUEDES, spec §7),
 * validation errors (missing age/sex/skinfolds), photo upload consent gating,
 * comparison diff, and PDF export.
 */
describe('Assessments (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  const prefix = `e2e-as-${randomUUID().slice(0, 8)}`;
  const password = 'senha-forte-123';

  let tenantId: string;
  let trainerToken: string;
  let studentToken: string;
  let studentId: string; // sex=MALE, birthDate set
  let studentNoAgeId: string; // sex=MALE, birthDate null
  let studentNoSexId: string; // sex null

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app, testEnv());
    await app.init();

    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(password);

    const tenant = await prisma.tenant.create({ data: { name: 'E2E Assessments', slug: prefix } });
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
        studentProfile: {
          create: {
            tenantId,
            trainerId: trainer.id,
            sex: 'MALE',
            birthDate: new Date('1995-01-01'),
          },
        },
      },
    });
    studentId = student.id;

    const studentNoAge = await prisma.user.create({
      data: {
        tenantId,
        email: `${prefix}-student-noage@e2e.local`,
        name: 'Aluno Sem Idade',
        role: 'STUDENT',
        status: 'ACTIVE',
        passwordHash,
        studentProfile: { create: { tenantId, trainerId: trainer.id, sex: 'MALE' } },
      },
    });
    studentNoAgeId = studentNoAge.id;

    const studentNoSex = await prisma.user.create({
      data: {
        tenantId,
        email: `${prefix}-student-nosex@e2e.local`,
        name: 'Aluno Sem Sexo',
        role: 'STUDENT',
        status: 'ACTIVE',
        passwordHash,
        studentProfile: { create: { tenantId, trainerId: trainer.id } },
      },
    });
    studentNoSexId = studentNoSex.id;

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
  });

  afterAll(async () => {
    await prisma.consent.deleteMany({ where: { tenantId } });
    await prisma.auditLog.deleteMany({ where: { tenantId } });
    await prisma.assessmentPhoto.deleteMany({
      where: { assessment: { tenantId } },
    });
    await prisma.assessmentSkinfold.deleteMany({ where: { assessment: { tenantId } } });
    await prisma.assessmentMeasurement.deleteMany({ where: { assessment: { tenantId } } });
    await prisma.assessment.deleteMany({ where: { tenantId } });
    await prisma.studentProfile.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await app?.close();
  });

  describe('POST /api/v1/students/:id/assessments', () => {
    it('computes body fat via the GUEDES protocol server-side', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/students/${studentId}/assessments`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          assessedAt: new Date(),
          protocol: 'GUEDES',
          weightKg: 80,
          heightCm: 178,
          skinfoldsMm: { TRICEPS: 15, SUPRAILIAC: 15, ABDOMINAL: 20 },
          measurementsCm: { WAIST: 85 },
        })
        .expect(201);

      // Reference values match packages/shared/calc/body-composition.spec.ts.
      expect(res.body.bodyFatPct).toBeCloseTo(18.1174, 3);
      expect(res.body.leanMassKg).toBeCloseTo(80 - (80 * 18.1174) / 100, 3);
      expect(res.body.bmi).toBeCloseTo(80 / 1.78 ** 2, 3);
      expect(res.body.measurements).toEqual([{ site: 'WAIST', valueCm: 85 }]);
    });

    it('forbids a STUDENT from creating an assessment', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/students/${studentId}/assessments`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ assessedAt: new Date(), protocol: 'NONE' })
        .expect(403);
    });

    it('422s when a Pollock protocol is requested without the student having an age', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/students/${studentNoAgeId}/assessments`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          assessedAt: new Date(),
          protocol: 'POLLOCK_3',
          skinfoldsMm: { CHEST: 10, ABDOMINAL: 15, THIGH: 12 },
        })
        .expect(422);
    });

    it('422s when a protocol is requested without the student having a sex', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/students/${studentNoSexId}/assessments`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ assessedAt: new Date(), protocol: 'FAULKNER' })
        .expect(422);
    });

    it('422s when required skinfold sites are missing', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/students/${studentId}/assessments`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({ assessedAt: new Date(), protocol: 'GUEDES', skinfoldsMm: { TRICEPS: 15 } })
        .expect(422);
    });
  });

  describe('assessment lifecycle', () => {
    let assessmentAId: string;
    let assessmentBId: string;

    it('creates a second assessment for the comparison', async () => {
      const first = await request(app.getHttpServer())
        .get(`/api/v1/students/${studentId}/assessments`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);
      assessmentAId = first.body.items[0].id;

      const second = await request(app.getHttpServer())
        .post(`/api/v1/students/${studentId}/assessments`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          assessedAt: new Date(Date.now() + 1000),
          protocol: 'NONE',
          weightKg: 78,
          measurementsCm: { WAIST: 82 },
        })
        .expect(201);
      assessmentBId = second.body.id;
    });

    it('refuses to add a photo without accepting the photo consent', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/assessments/${assessmentAId}/photos`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          pose: 'FRONT',
          fileKey: 'assessment-photos/x.jpg',
          photoConsent: { accepted: false },
        })
        .expect(422);
    });

    it('adds a photo once consent is accepted', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/assessments/${assessmentAId}/photos`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .send({
          pose: 'FRONT',
          fileKey: 'assessment-photos/x.jpg',
          photoConsent: { accepted: true },
        })
        .expect(201);
      expect(res.body.pose).toBe('FRONT');
      expect(res.body.url).toContain('http');
    });

    it('lists both assessments for the student', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/students/${studentId}/assessments`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      expect(res.body.items.map((i: { id: string }) => i.id).sort()).toEqual(
        [assessmentAId, assessmentBId].sort(),
      );
    });

    it('reads a single assessment with its photo', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/assessments/${assessmentAId}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      expect(res.body.photos).toHaveLength(1);
    });

    it('computes the diff between two assessments', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/assessments/compare?a=${assessmentAId}&b=${assessmentBId}`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);
      expect(res.body.diff.weightKg).toBeCloseTo(78 - 80, 5);
      expect(res.body.diff.measurements).toEqual([{ site: 'WAIST', deltaCm: 82 - 85 }]);
    });

    it('generates a PDF', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/assessments/${assessmentAId}/pdf`)
        .set('Authorization', `Bearer ${trainerToken}`)
        .expect(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(Buffer.isBuffer(res.body) ? res.body.length : res.text.length).toBeGreaterThan(0);
    });
  });
});
