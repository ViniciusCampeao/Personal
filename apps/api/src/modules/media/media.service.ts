import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { type PresignRequestInput, type PresignResponseDto } from '@pt/shared';
import { StorageService } from '../../common/storage/storage.service';

const EXTENSION_BY_MIME: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

const PRESIGN_EXPIRY_SECONDS = 300;

@Injectable()
export class MediaService {
  constructor(private readonly storage: StorageService) {}

  async presign(tenantId: string, input: PresignRequestInput): Promise<PresignResponseDto> {
    const extension = EXTENSION_BY_MIME[input.mime];
    const key = `exercise-videos/${tenantId}/${randomUUID()}.${extension}`;
    const uploadUrl = await this.storage.presignPut(key, input.mime, PRESIGN_EXPIRY_SECONDS);
    return { uploadUrl, key };
  }
}
