import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { problemMessage } from '@/lib/problem';
import { uploadFile } from '@/lib/upload';
import { fetchTenant, updateTenant } from './tenant-api';

/**
 * Name + logo shown across the app shell (spec follow-up). Shared by the admin panel
 * and the trainer's own profile — both roles can save it, see `AdminController`.
 */
export function TenantBrandingCard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const tenant = useQuery({ queryKey: ['admin', 'tenant'], queryFn: fetchTenant });
  const [name, setName] = useState('');
  // `undefined` = logo untouched (keep whatever's saved); a string is a freshly
  // uploaded key to save; `null` is an explicit "remove the logo".
  const [logoKey, setLogoKey] = useState<string | null | undefined>(undefined);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (tenant.data) setName(tenant.data.name);
  }, [tenant.data]);

  const mutation = useMutation({
    mutationFn: () =>
      updateTenant({ name: name.trim(), ...(logoKey !== undefined && { logoKey }) }),
    onSuccess: async (saved) => {
      queryClient.setQueryData(['admin', 'tenant'], saved);
      await queryClient.invalidateQueries({ queryKey: ['tenant', 'branding'] });
      setLogoKey(undefined);
      setLogoPreview(null);
      toast('Marca atualizada.', 'success');
    },
  });

  async function handleLogo(file: File | undefined) {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      setLogoKey(await uploadFile(file, 'tenant-logo'));
      setLogoPreview(URL.createObjectURL(file));
    } catch (error) {
      setUploadError(problemMessage(error));
    } finally {
      setUploading(false);
    }
  }

  if (tenant.isPending) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-20" />
        </CardContent>
      </Card>
    );
  }

  const shownLogo = logoKey === null ? null : (logoPreview ?? tenant.data?.logoUrl ?? null);
  const dirty = name.trim() !== tenant.data?.name || logoKey !== undefined;

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div>
          <CardTitle>Marca</CardTitle>
          <CardDescription>
            Nome e logo exibidos para você e seus alunos em todo o app.
          </CardDescription>
        </div>

        <div className="flex items-center gap-4">
          {shownLogo ? (
            <img
              src={shownLogo}
              alt="Logo atual"
              className="size-20 shrink-0 rounded-2xl border border-border bg-surface-sunken object-contain p-2 shadow-sm"
            />
          ) : (
            <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-border text-text-subtle">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-7" fill="currentColor">
                <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Zm2 12 4-4.5 3 3L17 10l3 5V5H6v12Z" />
              </svg>
            </div>
          )}

          <div className="flex flex-col items-start gap-2">
            <label className="inline-flex min-h-touch cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface-raised px-4 text-sm font-medium text-text hover:border-border-strong">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="currentColor">
                <path d="M12 4a1 1 0 0 1 1 1v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5a1 1 0 0 1 1-1Z" />
              </svg>
              {shownLogo ? 'Trocar logo' : 'Adicionar logo'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml"
                onChange={(event) => void handleLogo(event.target.files?.[0])}
                className="sr-only"
              />
            </label>
            {shownLogo ? (
              <button
                type="button"
                onClick={() => {
                  setLogoKey(null);
                  setLogoPreview(null);
                }}
                className="text-sm text-text-subtle underline-offset-2 hover:text-danger hover:underline"
              >
                Remover logo
              </button>
            ) : (
              <span className="text-xs text-text-subtle">PNG, JPG, WEBP ou SVG · até 5 MB</span>
            )}
          </div>
        </div>

        <Field label="Nome">
          {(field) => (
            <Input {...field} value={name} onChange={(event) => setName(event.target.value)} />
          )}
        </Field>

        {uploadError ? <Alert variant="error">{uploadError}</Alert> : null}
        {mutation.isError ? <Alert variant="error">{problemMessage(mutation.error)}</Alert> : null}

        <Button
          size="sm"
          className="self-start"
          loading={mutation.isPending || uploading}
          disabled={!name.trim() || !dirty}
          onClick={() => mutation.mutate()}
        >
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}
