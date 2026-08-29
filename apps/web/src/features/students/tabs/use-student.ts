import { useOutletContext } from 'react-router-dom';
import type { StudentDetailDto } from '@pt/shared';

/** The sheet already loaded the student; tabs read it instead of refetching. */
export function useStudent(): StudentDetailDto {
  return useOutletContext<StudentDetailDto>();
}
