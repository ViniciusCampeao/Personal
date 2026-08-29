import type { PresignRequestInput, PresignResponseDto } from '@pt/shared';
import { apiFetch } from './api';

/**
 * Two steps by design (spec §5/§10): the API only ever hands out a short-lived presigned
 * URL, and the bytes go straight to object storage — they never pass through the API,
 * and no file is ever public.
 */
export async function uploadFile(file: File, kind: PresignRequestInput['kind']): Promise<string> {
  const { uploadUrl, key } = await apiFetch<PresignResponseDto>('/media/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, mime: file.type, sizeBytes: file.size }),
  });

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!response.ok) throw new Error('Falha ao enviar o arquivo. Tente novamente.');

  return key;
}
