import { type FieldValues, type Path, type UseFormSetError } from 'react-hook-form';
import { ApiError, type ProblemDetails } from './api';

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** A single sentence to show the user, whatever went wrong. */
export function problemMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.problem.detail ?? error.problem.title;
  }
  // `fetch` rejects with a TypeError when the request never left the device.
  if (error instanceof TypeError) {
    return 'Sem conexão. Verifique sua internet.';
  }
  return 'Algo deu errado. Tente novamente.';
}

export interface ParsedFieldErrors {
  fields: Record<string, string>;
  formLevel: string[];
}

/**
 * Splits the API's `errors[]` into per-field and form-level messages.
 *
 * The server emits `` `${issue.path.join('.') || '(root)'}: ${issue.message}` ``
 * (see `zod-validation.pipe.ts`), so the path arrives already dot-joined — exactly the
 * shape react-hook-form's `setError` accepts. No path translation is needed, and nested
 * paths like `consents.terms` or `items.0.reps` work verbatim.
 */
export function fieldErrorsFrom(problem: ProblemDetails): ParsedFieldErrors {
  const fields: Record<string, string> = {};
  const formLevel: string[] = [];

  for (const entry of problem.errors ?? []) {
    const separator = entry.indexOf(': ');
    if (separator === -1) {
      formLevel.push(entry);
      continue;
    }

    const path = entry.slice(0, separator);
    const message = entry.slice(separator + 2);
    if (path === '(root)') formLevel.push(message);
    else fields[path] = message;
  }

  return { fields, formLevel };
}

/**
 * Routes a failed mutation into the form: field messages onto their fields, everything
 * else onto `root.serverError`, which screens render in a single `<Alert>`. Messages for
 * paths the form doesn't have would otherwise be stored and never displayed, so they
 * fall back to the form-level slot too — that is what makes a front/back schema drift
 * visible instead of silent.
 */
export function applyProblemToForm<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  knownFields?: readonly Path<T>[],
): void {
  if (!isApiError(error)) {
    setError('root.serverError', { type: 'server', message: problemMessage(error) });
    return;
  }

  const { fields, formLevel } = fieldErrorsFrom(error.problem);
  const unmapped: string[] = [];

  for (const [path, message] of Object.entries(fields)) {
    if (knownFields && !knownFields.includes(path as Path<T>)) {
      unmapped.push(message);
      continue;
    }
    setError(path as Path<T>, { type: 'server', message });
  }

  const rest = [...formLevel, ...unmapped];
  if (rest.length > 0 || Object.keys(fields).length === 0) {
    setError('root.serverError', {
      type: 'server',
      message: rest.length > 0 ? rest.join(' ') : problemMessage(error),
    });
  }
}
