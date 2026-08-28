import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { type Role } from '@prisma/client';

export interface TenantStore {
  tenantId: string;
  userId?: string;
  role?: Role;
}

/**
 * Marks a deliberate, narrow exception to tenant scoping — see `runUnscoped`.
 * A distinct shape (rather than `tenantId: null`) so nothing can reach it by accident.
 */
export interface UnscopedStore {
  unscoped: true;
}

export type Store = TenantStore | UnscopedStore;

export function isUnscoped(store: Store | undefined): store is UnscopedStore {
  return store != null && 'unscoped' in store;
}

/**
 * The single source of truth for "which tenant is this request for", read by the Prisma
 * extension in `common/prisma/tenant-scope.ts` on every query. Populated once per
 * request by `TenantMiddleware`; nothing else should call `run`/`runUnscoped` outside of
 * that middleware and the couple of auth flows that are inherently cross-tenant.
 */
@Injectable()
export class TenantContextService {
  private readonly als = new AsyncLocalStorage<Store>();

  run<T>(store: TenantStore, fn: () => T): T {
    return this.als.run(store, fn);
  }

  /**
   * Escape hatch for the handful of operations that must run before we know which
   * tenant we're in — e.g. looking up an Invite by its token. Every query issued inside
   * `fn` skips the automatic `tenantId` filter; the caller is responsible for filtering
   * by hand (and should keep that block as small as possible).
   */
  runUnscoped<T>(fn: () => T): T {
    return this.als.run({ unscoped: true }, fn);
  }

  getStore(): Store | undefined {
    return this.als.getStore();
  }

  getTenantId(): string {
    const store = this.als.getStore();
    if (!store || isUnscoped(store)) {
      throw new Error(
        'No tenant bound to the current async context. Wrap this call in ' +
          'TenantContextService.run(), or runUnscoped() if this is deliberately cross-tenant.',
      );
    }
    return store.tenantId;
  }

  getUserId(): string | undefined {
    const store = this.als.getStore();
    return store && !isUnscoped(store) ? store.userId : undefined;
  }

  getRole(): Role | undefined {
    const store = this.als.getStore();
    return store && !isUnscoped(store) ? store.role : undefined;
  }
}
