/**
 * pt-BR presentation helpers (convention §14: UTC in the database, `America/Sao_Paulo`
 * on screen; kg / cm / mm with no unit conversion).
 *
 * The time zone is always passed explicitly. A bare `toLocaleDateString()` uses the
 * device zone, so a Brazilian user at 21:00 would see tomorrow's date for a timestamp
 * the server stored in UTC.
 */
export const TIME_ZONE = 'America/Sao_Paulo';

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE });
const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TIME_ZONE,
  dateStyle: 'short',
  timeStyle: 'short',
});
const weekdayFormatter = new Intl.DateTimeFormat('pt-BR', { timeZone: TIME_ZONE, weekday: 'long' });
const isoDayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE });

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatDate(value: string | Date): string {
  return dateFormatter.format(toDate(value));
}

export function formatDateTime(value: string | Date): string {
  return dateTimeFormatter.format(toDate(value));
}

export function formatWeekday(value: string | Date): string {
  return weekdayFormatter.format(toDate(value));
}

/** `YYYY-MM-DD` for the São Paulo calendar day — what "treino de hoje" means to a user. */
export function isoDayInSaoPaulo(value: string | Date = new Date()): string {
  return isoDayFormatter.format(toDate(value));
}

export function todayInSaoPaulo(): string {
  return isoDayInSaoPaulo();
}

/** "hoje" | "ontem" | "há 3 dias" | a plain date once it stops being useful. */
export function formatRelativeDay(value: string | Date): string {
  const target = isoDayInSaoPaulo(value);
  const today = todayInSaoPaulo();
  if (target === today) return 'hoje';

  const diffDays = Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${target}T00:00:00Z`)) / 86_400_000,
  );
  if (diffDays === 1) return 'ontem';
  if (diffDays > 1 && diffDays < 7) return `há ${diffDays} dias`;
  if (diffDays === -1) return 'amanhã';
  return formatDate(value);
}

function decimal(value: number, maximumFractionDigits: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits }).format(value);
}

export function formatWeight(kg: number): string {
  return `${decimal(kg, 1)} kg`;
}

export function formatLength(cm: number): string {
  return `${decimal(cm, 1)} cm`;
}

export function formatSkinfold(mm: number): string {
  return `${decimal(mm, 1)} mm`;
}

export function formatPercent(value: number): string {
  return `${decimal(value, 1)}%`;
}

/** "48 min" for a session, "1:05:20" once it passes an hour; "1:30" for a rest timer. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

export function formatMinutes(totalSeconds: number): string {
  return `${Math.round(totalSeconds / 60)} min`;
}
