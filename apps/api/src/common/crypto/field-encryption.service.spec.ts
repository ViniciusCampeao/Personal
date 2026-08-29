import { ConfigService } from '@nestjs/config';
import { type Env } from '../../config/env';
import { FieldEncryptionService } from './field-encryption.service';

function serviceWithKey(key: Buffer): FieldEncryptionService {
  const config = { get: () => key.toString('base64') } as unknown as ConfigService<Env, true>;
  return new FieldEncryptionService(config);
}

describe('FieldEncryptionService', () => {
  const key = Buffer.alloc(32, 42);
  const service = serviceWithKey(key);

  it('round-trips a plaintext string', () => {
    const stored = service.encrypt('paciente com lesão no ombro direito');
    expect(stored).not.toContain('ombro');
    expect(service.decrypt(stored)).toBe('paciente com lesão no ombro direito');
  });

  it('round-trips a JSON payload', () => {
    const payload = { q1: true, q2: false };
    const stored = service.encryptJson(payload);
    expect(service.decryptJson(stored)).toEqual(payload);
  });

  it('produces different ciphertext for the same plaintext (random IV)', () => {
    const a = service.encrypt('mesmo texto');
    const b = service.encrypt('mesmo texto');
    expect(a).not.toBe(b);
  });

  it('fails to decrypt with the wrong key', () => {
    const stored = service.encrypt('dado sensível');
    const otherService = serviceWithKey(Buffer.alloc(32, 7));
    expect(() => otherService.decrypt(stored)).toThrow();
  });
});
