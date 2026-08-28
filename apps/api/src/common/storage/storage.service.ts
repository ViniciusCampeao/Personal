import { GetObjectCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../../config/env';
import { S3_CLIENT } from './s3-client.provider';

/**
 * Thin wrapper around the S3-compatible client. The bucket is locked down to
 * `anonymous set none` (docker-compose.yml `minio-init`) — every object, uploaded or
 * read, goes through a short-lived presigned URL (spec §10, LGPD).
 */
@Injectable()
export class StorageService {
  private readonly bucket: string;

  constructor(
    @Inject(S3_CLIENT) private readonly s3: S3Client,
    config: ConfigService<Env, true>,
  ) {
    this.bucket = config.get('S3_BUCKET', { infer: true });
  }

  presignPut(key: string, contentType: string, expirySeconds = 300): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.s3, command, { expiresIn: expirySeconds });
  }

  presignGet(key: string, expirySeconds = 300): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.s3, command, { expiresIn: expirySeconds });
  }
}
