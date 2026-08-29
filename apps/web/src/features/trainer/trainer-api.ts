import { type DashboardResponseDto } from '@pt/shared';
import { apiFetch } from '@/lib/api';

export function fetchDashboard(): Promise<DashboardResponseDto> {
  return apiFetch<DashboardResponseDto>('/dashboard');
}
