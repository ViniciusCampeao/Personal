import { acceptInviteSchema, createInviteSchema } from './invites';

describe('createInviteSchema', () => {
  it('accepts an e-mail-only invite and defaults expiresInDays', () => {
    const result = createInviteSchema.parse({ email: 'aluno@example.com' });
    expect(result.expiresInDays).toBe(7);
  });

  it('accepts a phone-only invite', () => {
    expect(createInviteSchema.safeParse({ phone: '41999998888' }).success).toBe(true);
  });

  it('rejects an invite with neither contact channel', () => {
    const result = createInviteSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects more than 30 days of validity', () => {
    expect(createInviteSchema.safeParse({ email: 'a@b.com', expiresInDays: 31 }).success).toBe(
      false,
    );
  });
});

describe('acceptInviteSchema', () => {
  const base = {
    name: 'Ana Souza',
    password: 'senha-forte-123',
    consents: { terms: true as const, privacy: true as const },
  };

  it('accepts a well-formed onboarding submission', () => {
    expect(acceptInviteSchema.safeParse(base).success).toBe(true);
  });

  it('requires both consents to be explicitly true', () => {
    expect(
      acceptInviteSchema.safeParse({ ...base, consents: { terms: true, privacy: false } }).success,
    ).toBe(false);
    expect(
      acceptInviteSchema.safeParse({ ...base, consents: { terms: false, privacy: true } }).success,
    ).toBe(false);
  });

  it('rejects a short password', () => {
    expect(acceptInviteSchema.safeParse({ ...base, password: '1234567' }).success).toBe(false);
  });
});
