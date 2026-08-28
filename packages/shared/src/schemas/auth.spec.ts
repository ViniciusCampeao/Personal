import { loginSchema } from './auth';

describe('loginSchema', () => {
  it('normalises the e-mail', () => {
    const result = loginSchema.parse({ email: '  User@Example.com ', password: 'x' });
    expect(result.email).toBe('user@example.com');
  });

  it('rejects a malformed e-mail', () => {
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(false);
  });

  it('rejects an empty password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});
