import { type AuthenticatedUserDto, type LoginInput, type LoginResponseDto } from '@pt/shared';
import { apiFetch } from '@/lib/api';

export function login(input: LoginInput): Promise<LoginResponseDto> {
  return apiFetch<LoginResponseDto>(
    '/auth/login',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
    { auth: 'none' },
  );
}

export function logout(): Promise<void> {
  return apiFetch<void>('/auth/logout', { method: 'POST' }, { auth: 'none' });
}

export function me(): Promise<AuthenticatedUserDto> {
  return apiFetch<AuthenticatedUserDto>('/auth/me');
}
