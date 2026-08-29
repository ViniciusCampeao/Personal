import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../../config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

/**
 * Encryption at rest for `Anamnesis`'s clinical free-text/JSON fields (spec §10.3).
 * AES-256-GCM with a random IV per call; stored as `iv.authTag.ciphertext`
 * (base64url-encoded, dot-separated) so it round-trips through a plain `String` column.
 */
@Injectable()
export class FieldEncryptionService {
  private readonly key: Buffer;

  constructor(config: ConfigService<Env, true>) {
    const encoded: string = config.get('HEALTH_DATA_ENCRYPTION_KEY', { infer: true });
    this.key = Buffer.from(encoded, 'base64');
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv, authTag, ciphertext].map((buf) => buf.toString('base64url')).join('.');
  }

  decrypt(stored: string): string {
    const [ivB64, authTagB64, ciphertextB64] = stored.split('.');
    const iv = Buffer.from(ivB64, 'base64url');
    const authTag = Buffer.from(authTagB64, 'base64url');
    const ciphertext = Buffer.from(ciphertextB64, 'base64url');

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }

  encryptJson(value: unknown): string {
    return this.encrypt(JSON.stringify(value));
  }

  decryptJson<T>(stored: string): T {
    return JSON.parse(this.decrypt(stored)) as T;
  }
}
