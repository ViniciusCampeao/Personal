import { type ReactNode } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ToastProvider } from '@/components/ui/use-toast';
import { AuthProvider } from '@/features/auth/auth-context';
import { routes } from '@/routes/router';

function testQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function Providers({ queryClient, children }: { queryClient: QueryClient; children: ReactNode }) {
  return (
    <ToastProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </ToastProvider>
  );
}

type Rendered<T> = T & {
  user: ReturnType<typeof userEvent.setup>;
  /** Exposed so tests can seed or inspect the cache (logout has to clear it). */
  queryClient: QueryClient;
};

/** Renders one screen inside a memory router, without the app's whole route tree. */
export function renderScreen(
  ui: ReactNode,
  { route = '/' }: { route?: string } = {},
): Rendered<RenderResult> {
  const user = userEvent.setup();
  const queryClient = testQueryClient();
  const router = createMemoryRouter([{ path: '*', element: ui }], { initialEntries: [route] });
  const result = render(
    <Providers queryClient={queryClient}>
      <RouterProvider router={router} />
    </Providers>,
  );
  return { ...result, user, queryClient };
}

/** Renders the real route tree at `route` — used to exercise guards and redirects. */
export function renderApp({ route = '/' }: { route?: string } = {}): Rendered<
  RenderResult & { router: ReturnType<typeof createMemoryRouter> }
> {
  const user = userEvent.setup();
  const queryClient = testQueryClient();
  const router = createMemoryRouter(routes, { initialEntries: [route] });
  const result = render(
    <Providers queryClient={queryClient}>
      <RouterProvider router={router} />
    </Providers>,
  );
  return { ...result, user, router, queryClient };
}
