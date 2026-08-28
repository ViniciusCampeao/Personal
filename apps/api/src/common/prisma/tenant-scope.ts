import { type Prisma } from '@prisma/client';
import {
  isUnscoped,
  type Store,
  type TenantContextService,
} from '../tenant/tenant-context.service';

/**
 * Every model that carries a mandatory `tenantId` column (verified against
 * `schema.prisma`; see the generator script referenced in `tenant-scope.spec.ts`).
 * `Exercise` is deliberately excluded: its `tenantId` is nullable (null = global), so
 * "just inject the current tenant" is the wrong default for it — the exercises module
 * (M2) filters it by hand. `Tenant` has no `tenantId` at all.
 */
export const TENANT_SCOPED_MODELS = new Set<Prisma.ModelName>([
  'User',
  'StudentProfile',
  'Invite',
  'Consent',
  'Anamnesis',
  'MedicalClearance',
  'Program',
  'WorkoutSession',
  'PersonalRecord',
  'Assessment',
  'CheckIn',
  'SessionComment',
  'PushSubscription',
  'Notification',
  'MediaAsset',
  'AuditLog',
]);

const CREATE_OPS = new Set(['create']);
const CREATE_MANY_OPS = new Set(['createMany', 'createManyAndReturn']);
const UNIQUE_WHERE_OPS = new Set(['findUnique', 'findUniqueOrThrow', 'delete']);
const FILTER_WHERE_OPS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'updateMany',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
]);

type Args = Record<string, unknown>;

function withTenantWhere(args: Args, tenantId: string): Args {
  const where = (args.where as Args | undefined) ?? {};
  return { ...args, where: { ...where, tenantId } };
}

/**
 * Pure transform: given the operation Prisma is about to run and the current tenant
 * store, returns the args to run it with — or throws. Kept separate from the
 * `$extends` wiring in `tenant-extension.ts` so it can be unit tested without spinning
 * up a real PrismaClient.
 */
export function scopeArgs(
  model: string,
  operation: string,
  args: unknown,
  store: Store | undefined,
): unknown {
  if (!TENANT_SCOPED_MODELS.has(model as Prisma.ModelName)) {
    return args;
  }

  if (isUnscoped(store)) {
    return args;
  }

  if (!store) {
    throw new Error(
      `Tenant context missing for ${model}.${operation}. Every request must run inside ` +
        'TenantContextService.run(); use runUnscoped() only for a deliberate, audited exception.',
    );
  }

  const { tenantId } = store;
  const a = { ...(args as Args) };

  if (CREATE_OPS.has(operation)) {
    a.data = { ...(a.data as Args), tenantId };
    return a;
  }

  if (CREATE_MANY_OPS.has(operation)) {
    const data = a.data as Args | Args[];
    a.data = Array.isArray(data)
      ? data.map((row) => ({ ...row, tenantId }))
      : { ...data, tenantId };
    return a;
  }

  if (operation === 'upsert') {
    const create = { ...(a.create as Args), tenantId };
    const update = { ...(a.update as Args) };
    delete update.tenantId; // the tenant a row belongs to is immutable once created
    return { ...withTenantWhere(a, tenantId), create, update };
  }

  if (operation === 'update') {
    const update = withTenantWhere(a, tenantId);
    const data = { ...(update.data as Args) };
    delete data.tenantId;
    return { ...update, data };
  }

  if (UNIQUE_WHERE_OPS.has(operation) || FILTER_WHERE_OPS.has(operation)) {
    return withTenantWhere(a, tenantId);
  }

  // A future Prisma operation we haven't reviewed. Refuse rather than silently let an
  // unfiltered query through — extend the sets above once it's been thought through.
  throw new Error(`Tenant scoping not implemented for ${model}.${operation}.`);
}

interface AllOperationsParams {
  model?: string;
  operation: string;
  args: unknown;
  query: (args: unknown) => Promise<unknown>;
}

/** The `$extends` argument itself — thin glue around `scopeArgs`. */
export function tenantExtension(tenantContext: TenantContextService) {
  return {
    name: 'tenant-scope',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }: AllOperationsParams) {
          return query(scopeArgs(model ?? '', operation, args, tenantContext.getStore()));
        },
      },
    },
  };
}
