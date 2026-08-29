/** Midnight UTC of the Monday of `date`'s week (spec §6: "semana começa na segunda"). */
export function startOfWeekUtc(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d;
}

export function mondayOfUtc(date: Date): string {
  return startOfWeekUtc(date).toISOString().slice(0, 10);
}

/** Midnight UTC of `date`'s calendar day — consistent with the rest of the app, which
 * doesn't do per-tenant timezones. */
export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
