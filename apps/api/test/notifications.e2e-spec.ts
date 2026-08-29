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
 * Exercises the M8 notification surface: push subscription lifecycle, the notification
 * feed (cursor pagination + `unreadOnly`), marking read, and tenant isolation.
 */
describe('Notifications (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  const prefix = `e2e-nt-${randomUUID().slice(0, 8)}`;
  const password = 'senha-forte-123';

  let tenantId: string;
  let otherTenantId: string;
  let studentToken: string;
  let studentId: string;
  let otherTenantStudentId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app, testEnv());
    await app.init();

    prisma = app.get(PrismaService);
    const passwordHash = await hashPassword(password);

    const tenant = await prisma.tenant.create({
      data: { name: 'E2E Notifications', slug: prefix },
    });
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
      data: { name: 'E2E Notifications B', slug: `${prefix}-other` },
    });
    otherTenantId = otherTenant.id;
    const otherStudent = await prisma.user.create({
      data: {
        tenantId: otherTenantId,
        email: `${prefix}-other-student@e2e.local`,
        name: 'Aluno Outro Tenant',
        role: 'STUDENT',
        status: 'ACTIVE',
        passwordHash,
      },
    });
    otherTenantStudentId = otherStudent.id;

    studentToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: `${prefix}-student@e2e.local`, password })
        .expect(200)
    ).body.accessToken;
  });

  afterAll(async () => {
    await prisma.notification.deleteMany({ where: { tenantId } });
    await prisma.notification.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.pushSubscription.deleteMany({ where: { tenantId } });
    await prisma.studentProfile.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId: otherTenantId } });
    await prisma.tenant.delete({ where: { id: otherTenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await app?.close();
  });

  describe('GET /api/v1/push/vapid-public-key', () => {
    it('exposes the public key the browser needs to subscribe', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/push/vapid-public-key')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      expect(res.body.publicKey).toBe(testEnv().VAPID_PUBLIC_KEY);
    });
  });

  describe('push subscription lifecycle', () => {
    const endpoint = 'https://push.example.com/e2e-subscription';

    it('registers a subscription', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/push/subscribe')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ endpoint, keys: { p256dh: 'p256dh-value', auth: 'auth-value' } })
        .expect(201);

      const rows = await prisma.pushSubscription.findMany({ where: { userId: studentId } });
      expect(rows).toHaveLength(1);
      expect(rows[0].endpoint).toBe(endpoint);
    });

    it('is idempotent — re-subscribing the same endpoint updates instead of duplicating', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/push/subscribe')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ endpoint, keys: { p256dh: 'p256dh-rotated', auth: 'auth-rotated' } })
        .expect(201);

      const rows = await prisma.pushSubscription.findMany({ where: { userId: studentId } });
      expect(rows).toHaveLength(1);
      expect(rows[0].p256dh).toBe('p256dh-rotated');
    });

    it('rejects a malformed endpoint', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/push/subscribe')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ endpoint: 'not-a-url', keys: { p256dh: 'a', auth: 'b' } })
        .expect(400);
    });

    it('unsubscribes by endpoint', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/push/subscribe')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ endpoint })
        .expect(200);

      const rows = await prisma.pushSubscription.findMany({ where: { userId: studentId } });
      expect(rows).toHaveLength(0);
    });
  });

  describe('notification feed', () => {
    let firstNotificationId: string;

    beforeAll(async () => {
      const created = await prisma.notification.createManyAndReturn({
        data: [
          {
            tenantId,
            userId: studentId,
            type: 'PR_ACHIEVED',
            title: 'Novo recorde!',
            body: 'Supino',
            createdAt: new Date('2026-08-01T10:00:00Z'),
          },
          {
            tenantId,
            userId: studentId,
            type: 'CHECKIN_REMINDER',
            title: 'Check-in semanal',
            body: 'Preencha seu check-in',
            createdAt: new Date('2026-08-02T10:00:00Z'),
          },
          {
            tenantId,
            userId: studentId,
            type: 'WORKOUT_TODAY',
            title: 'Treino de hoje',
            body: 'Treino A',
            createdAt: new Date('2026-08-03T10:00:00Z'),
          },
        ],
      });
      firstNotificationId = created[0].id;

      // Another tenant's notification for the same-name student — must never leak.
      await prisma.notification.create({
        data: {
          tenantId: otherTenantId,
          userId: otherTenantStudentId,
          type: 'PR_ACHIEVED',
          title: 'Recorde de outro tenant',
          body: 'Não deve aparecer',
        },
      });
    });

    it('lists the caller notifications newest first', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(res.body.items).toHaveLength(3);
      expect(res.body.items[0].type).toBe('WORKOUT_TODAY');
      expect(res.body.items[2].type).toBe('PR_ACHIEVED');
      expect(res.body.nextCursor).toBeNull();
    });

    it('never leaks another tenant notifications', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(
        res.body.items.some((n: { title: string }) => n.title === 'Recorde de outro tenant'),
      ).toBe(false);
    });

    it('paginates by cursor', async () => {
      const page1 = await request(app.getHttpServer())
        .get('/api/v1/notifications?limit=2')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      expect(page1.body.items).toHaveLength(2);
      expect(page1.body.nextCursor).not.toBeNull();

      const page2 = await request(app.getHttpServer())
        .get(`/api/v1/notifications?limit=2&cursor=${page1.body.nextCursor}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);
      expect(page2.body.items).toHaveLength(1);
      expect(page2.body.items[0].type).toBe('PR_ACHIEVED');
    });

    it('marks a notification read, idempotently', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/notifications/${firstNotificationId}/read`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(201);

      const row = await prisma.notification.findUnique({ where: { id: firstNotificationId } });
      const firstReadAt = row?.readAt;
      expect(firstReadAt).not.toBeNull();

      await request(app.getHttpServer())
        .post(`/api/v1/notifications/${firstNotificationId}/read`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(201);

      const again = await prisma.notification.findUnique({ where: { id: firstNotificationId } });
      expect(again?.readAt).toEqual(firstReadAt);
    });

    it('filters to unread only', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications?unreadOnly=true')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(res.body.items).toHaveLength(2);
      expect(res.body.items.some((n: { id: string }) => n.id === firstNotificationId)).toBe(false);
    });
  });
});
