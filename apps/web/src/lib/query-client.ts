import { MutationCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';
import { problemMessage } from './problem';

/**
 * Convention: mutations surface failures as a toast (wired here, so none can fail
 * silently), queries surface them inline in the screen that owns them. A mutation that
 * renders its own error — login, invite acceptance — opts out with
 * `meta: { silent: true }`.
 */
export function createQueryClient(notify: (message: string) => void): QueryClient {
  return new QueryClient({
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => {
        if (mutation.meta?.silent) return;
        notify(problemMessage(error));
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Offline-first behaviour is configured properly in the offline phase.
        networkMode: 'offlineFirst',
        // A 4xx is a verdict, not a hiccup — 401/403/404/422 never improve on retry.
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
          return failureCount < 2;
        },
      },
    },
  });
}
