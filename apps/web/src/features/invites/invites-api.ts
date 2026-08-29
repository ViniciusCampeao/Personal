import { type AcceptInviteInput, type InvitePreviewDto, type LoginResponseDto } from '@pt/shared';
import { apiFetch } from '@/lib/api';

export function fetchInvitePreview(token: string): Promise<InvitePreviewDto> {
  return apiFetch<InvitePreviewDto>(`/invites/${token}`, {}, { auth: 'none' });
}

export function acceptInvite(token: string, input: AcceptInviteInput): Promise<LoginResponseDto> {
  return apiFetch<LoginResponseDto>(
    `/invites/${token}/accept`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    { auth: 'none' },
  );
}
