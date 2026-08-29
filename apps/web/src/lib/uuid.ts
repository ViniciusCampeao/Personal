/**
 * `clientUuid` is what makes an offline write idempotent — the API resolves sessions and
 * sets by it, so replaying the outbox can never duplicate a set (spec §12).
 */
export function newUuid(): string {
  return crypto.randomUUID();
}
