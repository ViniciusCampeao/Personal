import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import App from './App';

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  );
}

describe('App', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the shell heading', () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok', uptimeSeconds: 12 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    renderApp();
    expect(screen.getByRole('heading', { name: /plataforma de personal trainer/i })).toBeVisible();
  });

  it('shows the API uptime once the health check answers', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok', uptimeSeconds: 42 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    renderApp();
    expect(await screen.findByText(/online há 42s/i)).toBeVisible();
  });

  it('reports a broken API instead of crashing', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response('{}', { status: 503, headers: { 'content-type': 'application/json' } }),
      );
    renderApp();
    expect(await screen.findByText(/sem conexão com a api/i)).toBeVisible();
  });
});
