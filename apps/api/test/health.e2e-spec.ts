import { Test } from '@nestjs/testing';
import { type NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { testEnv } from './test-env';

/**
 * Needs Postgres and Redis reachable via DATABASE_URL / REDIS_URL.
 * Locally: `pnpm docker:up`. In CI: service containers.
 */
describe('Health (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app, testEnv());
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /health reports liveness without touching dependencies', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);
    expect(response.body.status).toBe('ok');
    expect(typeof response.body.uptimeSeconds).toBe('number');
  });

  it('GET /health/ready reports database and redis', async () => {
    const response = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.info).toHaveProperty('database');
    expect(response.body.info).toHaveProperty('redis');
  });

  it('serves unknown routes as RFC 7807 problem+json', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/nope').expect(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.body.status).toBe(404);
    expect(response.body.title).toBeDefined();
  });
});
