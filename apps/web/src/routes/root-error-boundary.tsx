import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';
import { Alert } from '@/components/ui/alert';
import { PATHS } from './paths';

/** Last resort for a render/route error — keeps a crash from becoming a blank page. */
export function RootErrorBoundary() {
  const error = useRouteError();
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Erro desconhecido.';

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Algo deu errado</h1>
      <Alert variant="error" className="max-w-md">
        {detail}
      </Alert>
      <Link to={PATHS.root} className="text-sm text-accent underline">
        Voltar ao início
      </Link>
    </div>
  );
}
