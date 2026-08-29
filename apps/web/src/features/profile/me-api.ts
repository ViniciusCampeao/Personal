import type {
  DataExportDto,
  DeleteMyAccountInput,
  LegalDocumentDto,
  MyProfileDto,
  UpdateMyProfileInput,
} from '@pt/shared';
import { apiFetch } from '@/lib/api';

export function fetchMyProfile(): Promise<MyProfileDto> {
  return apiFetch<MyProfileDto>('/me/profile');
}

export function updateMyProfile(input: UpdateMyProfileInput): Promise<MyProfileDto> {
  return apiFetch<MyProfileDto>('/me/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function exportMyData(): Promise<DataExportDto> {
  return apiFetch<DataExportDto>('/me/export');
}

export function deleteMyAccount(input: DeleteMyAccountInput): Promise<void> {
  return apiFetch<void>('/me', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function fetchLegalDocument(type: 'terms' | 'privacy'): Promise<LegalDocumentDto> {
  return apiFetch<LegalDocumentDto>(`/legal/${type}`, {}, { auth: 'none' });
}
