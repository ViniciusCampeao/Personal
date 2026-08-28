import { S3Client } from '@aws-sdk/client-s3';
import { type ConfigService } from '@nestjs/config';
import { type Env } from '../../config/env';

export const S3_CLIENT = Symbol('S3_CLIENT');

export function s3ClientFactory(config: ConfigService<Env, true>): S3Client {
  return new S3Client({
    region: config.get('S3_REGION', { infer: true }),
    endpoint: config.get('S3_ENDPOINT', { infer: true }),
    forcePathStyle: config.get('S3_FORCE_PATH_STYLE', { infer: true }),
    credentials: {
      accessKeyId: config.get('S3_ACCESS_KEY', { infer: true }),
      secretAccessKey: config.get('S3_SECRET_KEY', { infer: true }),
    },
  });
}
