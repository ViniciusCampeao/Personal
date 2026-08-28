import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from './lib/api';

/**
 * M0 shell. It exists to prove the whole stack is wired end to end
 * (browser -> nginx/vite proxy -> API -> Postgres/Redis). Real screens start in M1.
 */
export default function App() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    retry: false,
    refetchInterval: 30_000,
  });

  const label = health.isPending
    ? 'verificando…'
    : health.isError
      ? 'sem conexão com a API'
      : `online há ${health.data.uptimeSeconds}s`;

  const dotClass = health.isPending
    ? 'bg-amber-400'
    : health.isError
      ? 'bg-rose-500'
      : 'bg-emerald-400';

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-8 px-6 py-12">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-widest text-slate-400">Fundação</p>
        <h1 className="text-3xl font-semibold text-slate-50">Plataforma de Personal Trainer</h1>
        <p className="text-slate-400">
          Marco M0 no ar: monorepo, banco, cache, storage e PWA instalável.
        </p>
      </header>

      <section
        className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"
        aria-live="polite"
      >
        <h2 className="text-sm font-medium text-slate-300">API</h2>
        <p className="mt-2 flex items-center gap-2 text-lg text-slate-100">
          <span className={`inline-block size-2.5 rounded-full ${dotClass}`} aria-hidden="true" />
          {label}
        </p>
      </section>

      <ol className="space-y-1 text-sm text-slate-400">
        <li>Próximo: M1 — autenticação, tenant context e convite de aluno.</li>
      </ol>
    </main>
  );
}
