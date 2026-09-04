import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { LegalDocumentDto } from '@pt/shared';
import { Alert } from '@/components/ui/alert';
import { Markdown } from '@/components/ui/markdown';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/format';
import { problemMessage } from '@/lib/problem';
import { PATHS } from '@/routes/paths';
import { fetchLegalDocument } from '@/features/profile/me-api';
import { PageHeader } from '@/components/app/page-header';

/**
 * The text comes from the API (spec §10.8) so the version shown here is provably the
 * one a `Consent` row points at. It is a public endpoint: the invite screen links here
 * before the visitor has an account.
 */
function LegalPage({ type }: { type: LegalDocumentDto['type'] }) {
  const query = useQuery({
    queryKey: ['legal', type],
    queryFn: () => fetchLegalDocument(type),
    staleTime: 60 * 60_000,
  });

  if (query.isPending) return <Skeleton className="h-96" />;
  if (query.isError) return <Alert variant="error">{problemMessage(query.error)}</Alert>;

  return (
    <article className="flex flex-col gap-5">
      <PageHeader
        title={query.data.title}
        description={`Versão ${query.data.version} · atualizado em ${formatDate(query.data.updatedAt)}`}
      />

      <Markdown source={query.data.body} />

      <Link to={PATHS.login} className="text-sm text-accent underline">
        Voltar
      </Link>
    </article>
  );
}

export function TermsPage() {
  return <LegalPage type="terms" />;
}

export function PrivacyPage() {
  return <LegalPage type="privacy" />;
}
