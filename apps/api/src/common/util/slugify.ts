const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');

/** ASCII, lowercase, hyphen-separated — good enough for a URL-safe, human-readable slug. */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(COMBINING_MARKS, '') // strip combining accents left behind by NFD
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
