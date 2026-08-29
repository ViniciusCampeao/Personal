import {
  listNotificationsQuerySchema,
  pushSubscribeSchema,
  pushUnsubscribeSchema,
} from './notifications';

describe('listNotificationsQuerySchema', () => {
  it('applies defaults', () => {
    const result = listNotificationsQuerySchema.parse({});
    expect(result.limit).toBe(20);
    expect(result.unreadOnly).toBe(false);
  });

  it('coerces unreadOnly from a query string', () => {
    expect(listNotificationsQuerySchema.parse({ unreadOnly: 'true' }).unreadOnly).toBe(true);
  });

  it('rejects a limit above 100', () => {
    expect(listNotificationsQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});

describe('pushSubscribeSchema', () => {
  const base = {
    endpoint: 'https://push.example.com/abc',
    keys: { p256dh: 'p256dh-value', auth: 'auth-value' },
  };

  it('accepts a well-formed subscription', () => {
    expect(pushSubscribeSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a non-url endpoint', () => {
    expect(pushSubscribeSchema.safeParse({ ...base, endpoint: 'not-a-url' }).success).toBe(false);
  });

  it('rejects missing keys', () => {
    expect(pushSubscribeSchema.safeParse({ endpoint: base.endpoint }).success).toBe(false);
  });
});

describe('pushUnsubscribeSchema', () => {
  it('accepts a well-formed endpoint', () => {
    expect(
      pushUnsubscribeSchema.safeParse({ endpoint: 'https://push.example.com/abc' }).success,
    ).toBe(true);
  });

  it('rejects a non-url endpoint', () => {
    expect(pushUnsubscribeSchema.safeParse({ endpoint: 'nope' }).success).toBe(false);
  });
});
