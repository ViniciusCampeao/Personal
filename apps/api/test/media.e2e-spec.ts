import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import { type NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { StorageService } from '../src/common/storage/storage.service';
import { hashPassword } from '../src/common/auth/password';
import { testEnv } from './test-env';

/**
 * Exercises `POST /media/presign` end to end against the real MinIO container
 * (`pnpm docker:up`) — including an actual PUT+GET round trip, since this is brand-new
 * infra with nothing else covering it.
 */
describe('Media presign (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  const prefix = `e2e-media-${randomUUID().slice(0, 8)}`;
  const password = 'senha-forte-123';
  let tenantId: string;
  let trainerToken: string;
  let studentToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app, testEnv());
    await app.init();

    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(password);
    const tenant = await prisma.tenant.create({ data: { name: 'E2E Media', slug: prefix } });
    tenantId = tenant.id;

    const trainerEmail = `${prefix}-trainer@e2e.local`;
    await prisma.user.create({
      data: {
        tenantId,
        email: trainerEmail,
        name: 'Treinador',
        role: 'TRAINER',
        status: 'ACTIVE',
        passwordHash,
      },
    });
    const studentEmail = `${prefix}-student@e2e.local`;
    const trainer = await prisma.user.findFirstOrThrow({ where: { tenantId, role: 'TRAINER' } });
    await prisma.user.create({
      data: {
        tenantId,
        email: studentEmail,
        name: 'Aluno',
        role: 'STUDENT',
        status: 'ACTIVE',
        passwordHash,
        studentProfile: { create: { tenantId, trainerId: trainer.id } },
      },
    });

    trainerToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: trainerEmail, password })
        .expect(200)
    ).body.accessToken;
    studentToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: studentEmail, password })
        .expect(200)
    ).body.accessToken;
  });

  afterAll(async () => {
    await prisma.studentProfile.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await app?.close();
  });

  it('forbids a STUDENT from requesting a presigned upload URL', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/media/presign')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ kind: 'exercise-video', mime: 'video/mp4', sizeBytes: 1024 })
      .expect(403);
  });

  it('rejects an unsupported mime type', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/media/presign')
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ kind: 'exercise-video', mime: 'application/pdf', sizeBytes: 1024 })
      .expect(400);
  });

  it('rejects a file over the size limit', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/media/presign')
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ kind: 'exercise-video', mime: 'video/mp4', sizeBytes: 300 * 1024 * 1024 })
      .expect(400);
  });

  it('issues a presigned PUT that actually uploads to the private bucket, then reads it back', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/media/presign')
      .set('Authorization', `Bearer ${trainerToken}`)
      .send({ kind: 'exercise-video', mime: 'video/mp4', sizeBytes: 1024 })
      .expect(201);

    expect(res.body.key).toContain(tenantId);

    const body = Buffer.from('fake video bytes');
    const putRes = await fetch(res.body.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'video/mp4' },
      body,
    });
    expect(putRes.ok).toBe(true);

    // The bucket is locked to `anonymous set none` — an unsigned GET must fail.
    const publicUrl = res.body.uploadUrl.split('?')[0];
    const unsignedRes = await fetch(publicUrl);
    expect(unsignedRes.ok).toBe(false);

    const storage = app.get(StorageService);
    const getUrl = await storage.presignGet(res.body.key);
    const signedRes = await fetch(getUrl);
    expect(signedRes.ok).toBe(true);
    expect(Buffer.from(await signedRes.arrayBuffer())).toEqual(body);
  });
});
