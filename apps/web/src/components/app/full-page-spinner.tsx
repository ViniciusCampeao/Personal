import { Spinner } from '@/components/ui/spinner';

/**
 * The one "nothing to show yet" screen: the boot refresh deciding whether there is a
 * session, and the router resolving a lazily loaded persona subtree. Both are blank
 * frames the user would otherwise stare at.
 */
export function FullPageSpinner({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center" aria-busy="true">
      <Spinner className="size-6 text-text-muted" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
