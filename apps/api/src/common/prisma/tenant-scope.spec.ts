import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { scopeArgs, TENANT_SCOPED_MODELS } from './tenant-scope';
import { type Store } from '../tenant/tenant-context.service';

const TENANT: Store = { tenantId: 'tenant-1', userId: 'user-1' };
const UNSCOPED: Store = { unscoped: true };

/**
 * This is the acceptance-criteria test (spec §12): "Nenhuma query acessa tabela com
 * tenantId sem filtro — teste automatizado que varre o Prisma extension." It parses
 * `schema.prisma` itself, so a model that gains a mandatory `tenantId` column and is
 * NOT added to `TENANT_SCOPED_MODELS` fails CI instead of silently querying unfiltered.
 */
describe('TENANT_SCOPED_MODELS — swept against schema.prisma', () => {
  function modelsWithRequiredTenantId(): string[] {
    const schemaPath = join(__dirname, '../../../prisma/schema.prisma');
    const schema = readFileSync(schemaPath, 'utf8');
    const modelBlocks = schema.matchAll(/model (\w+) \{([\s\S]*?)\n\}/g);
    const required: string[] = [];
    for (const [, name, body] of modelBlocks) {
      const match = /^\s*tenantId\s+String(\??)/m.exec(body);
      if (match && match[1] !== '?') required.push(name);
    }
    return required;
  }

  it('covers every model with a mandatory tenantId column, and nothing else', () => {
    const actual = modelsWithRequiredTenantId();
    expect(actual.length).toBeGreaterThan(0); // guards against a broken schema path
    expect([...TENANT_SCOPED_MODELS].sort()).toEqual([...actual].sort());
  });

  it('excludes Exercise (nullable tenantId) and Tenant (no tenantId)', () => {
    expect(TENANT_SCOPED_MODELS.has('Exercise')).toBe(false);
    expect(TENANT_SCOPED_MODELS.has('Tenant')).toBe(false);
  });
});

describe('scopeArgs — non-scoped models', () => {
  it('passes Exercise queries through untouched, tenant context or not', () => {
    const args = { where: { slug: 'supino' } };
    expect(scopeArgs('Exercise', 'findMany', args, TENANT)).toBe(args);
    expect(scopeArgs('Exercise', 'findMany', args, undefined)).toBe(args);
  });

  it('passes Tenant queries through untouched', () => {
    const args = { where: { slug: 'demo' } };
    expect(scopeArgs('Tenant', 'findUnique', args, TENANT)).toBe(args);
  });
});

describe('scopeArgs — missing context', () => {
  it.each(['findMany', 'findUnique', 'create', 'update', 'delete', 'count'])(
    'throws for %s on a tenant-scoped model with no bound context',
    (operation) => {
      expect(() => scopeArgs('User', operation, {}, undefined)).toThrow(/Tenant context missing/);
    },
  );

  it('never runs the query in this state (throws before returning args)', () => {
    expect(() => scopeArgs('WorkoutSession', 'findMany', { where: {} }, undefined)).toThrow();
  });
});

describe('scopeArgs — unscoped escape hatch', () => {
  it('passes tenant-scoped queries through untouched when explicitly unscoped', () => {
    const args = { where: { token: 'abc' } };
    expect(scopeArgs('Invite', 'findFirst', args, UNSCOPED)).toBe(args);
  });
});

describe('scopeArgs — read operations', () => {
  it.each(['findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy'])(
    'injects tenantId into where for %s',
    (operation) => {
      const result = scopeArgs('User', operation, { where: { role: 'STUDENT' } }, TENANT) as {
        where: Record<string, unknown>;
      };
      expect(result.where).toEqual({ role: 'STUDENT', tenantId: 'tenant-1' });
    },
  );

  it('defaults where to {} before injecting when none was given', () => {
    const result = scopeArgs('User', 'findMany', {}, TENANT) as { where: Record<string, unknown> };
    expect(result.where).toEqual({ tenantId: 'tenant-1' });
  });

  it('overrides a caller-supplied tenantId rather than trusting it', () => {
    const result = scopeArgs(
      'User',
      'findMany',
      { where: { tenantId: 'attacker-tenant' } },
      TENANT,
    ) as { where: Record<string, unknown> };
    expect(result.where.tenantId).toBe('tenant-1');
  });

  it('injects tenantId for findUnique alongside the unique key', () => {
    const result = scopeArgs('User', 'findUnique', { where: { id: 'u1' } }, TENANT) as {
      where: Record<string, unknown>;
    };
    expect(result.where).toEqual({ id: 'u1', tenantId: 'tenant-1' });
  });
});

describe('scopeArgs — writes', () => {
  it('stamps tenantId onto create data', () => {
    const result = scopeArgs('User', 'create', { data: { name: 'Ana' } }, TENANT) as {
      data: Record<string, unknown>;
    };
    expect(result.data).toEqual({ name: 'Ana', tenantId: 'tenant-1' });
  });

  it('overrides a caller-supplied tenantId on create', () => {
    const result = scopeArgs(
      'User',
      'create',
      { data: { name: 'Ana', tenantId: 'attacker-tenant' } },
      TENANT,
    ) as { data: Record<string, unknown> };
    expect(result.data.tenantId).toBe('tenant-1');
  });

  it('stamps tenantId onto every row of a createMany array', () => {
    const result = scopeArgs(
      'Consent',
      'createMany',
      { data: [{ type: 'TERMS' }, { type: 'PRIVACY' }] },
      TENANT,
    ) as { data: Record<string, unknown>[] };
    expect(result.data).toEqual([
      { type: 'TERMS', tenantId: 'tenant-1' },
      { type: 'PRIVACY', tenantId: 'tenant-1' },
    ]);
  });

  it('injects tenantId into the where of updateMany/deleteMany', () => {
    const result = scopeArgs(
      'Notification',
      'updateMany',
      { where: { readAt: null }, data: { readAt: new Date() } },
      TENANT,
    ) as { where: Record<string, unknown> };
    expect(result.where.tenantId).toBe('tenant-1');
  });

  it('injects tenantId into where for update and strips it from data', () => {
    const result = scopeArgs(
      'User',
      'update',
      { where: { id: 'u1' }, data: { name: 'Novo nome', tenantId: 'attacker-tenant' } },
      TENANT,
    ) as { where: Record<string, unknown>; data: Record<string, unknown> };
    expect(result.where).toEqual({ id: 'u1', tenantId: 'tenant-1' });
    expect(result.data).toEqual({ name: 'Novo nome' });
  });

  it('injects tenantId into where for delete', () => {
    const result = scopeArgs('User', 'delete', { where: { id: 'u1' } }, TENANT) as {
      where: Record<string, unknown>;
    };
    expect(result.where).toEqual({ id: 'u1', tenantId: 'tenant-1' });
  });

  it('scopes upsert on where and create, and strips tenantId from update', () => {
    const result = scopeArgs(
      'CheckIn',
      'upsert',
      {
        where: { studentId_weekStart: { studentId: 's1', weekStart: new Date('2026-01-05') } },
        create: { studentId: 's1', weekStart: new Date('2026-01-05') },
        update: { energy: 4, tenantId: 'attacker-tenant' },
      },
      TENANT,
    ) as {
      where: Record<string, unknown>;
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    };
    expect(result.where.tenantId).toBe('tenant-1');
    expect(result.create.tenantId).toBe('tenant-1');
    expect(result.update).toEqual({ energy: 4 });
  });
});

describe('scopeArgs — unreviewed operations', () => {
  it('refuses an operation it has not been taught about, rather than letting it through', () => {
    expect(() => scopeArgs('User', 'someFutureOp', { where: {} }, TENANT)).toThrow(
      /not implemented/,
    );
  });
});
