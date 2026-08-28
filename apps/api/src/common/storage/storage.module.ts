import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3_CLIENT, s3ClientFactory } from './s3-client.provider';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [
    {
      provide: S3_CLIENT,
      useFactory: s3ClientFactory,
      inject: [ConfigService],
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
