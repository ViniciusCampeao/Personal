import type {
  AdherenceWeekDto,
  ExerciseProgressPointDto,
  PersonalRecordDto,
  VolumeByMuscleDto,
} from '@pt/shared';
import { apiFetch } from '@/lib/api';

export function fetchAdherence(studentId: string, weeks = 12): Promise<AdherenceWeekDto[]> {
  return apiFetch<AdherenceWeekDto[]>(`/students/${studentId}/progress/adherence?weeks=${weeks}`);
}

export function fetchVolume(studentId: string, weeks = 12): Promise<VolumeByMuscleDto[]> {
  return apiFetch<VolumeByMuscleDto[]>(`/students/${studentId}/progress/volume?weeks=${weeks}`);
}

export function fetchExerciseSeries(
  studentId: string,
  exerciseId: string,
): Promise<ExerciseProgressPointDto[]> {
  return apiFetch<ExerciseProgressPointDto[]>(
    `/students/${studentId}/progress/exercises/${exerciseId}`,
  );
}

export function fetchRecords(studentId: string): Promise<PersonalRecordDto[]> {
  return apiFetch<PersonalRecordDto[]>(`/students/${studentId}/records`);
}
