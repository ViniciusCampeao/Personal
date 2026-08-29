import { randomUUID } from 'node:crypto';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { type PresignRequestInput, type PresignResponseDto } from '@pt/shared';
import { StorageService } from '../../common/storage/storage.service';

const EXTENSION_BY_MIME: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

const PRESIGN_EXPIRY_SECONDS = 300;

/** Key prefix + who may request this kind of upload, keyed by `presignKinds` (spec §5). */
const KIND_RULES: Record<
  PresignRequestInput['kind'],
  { prefix: string; allowedRoles: readonly Role[] }
> = {
  'exercise-video': { prefix: 'exercise-videos', allowedRoles: [Role.TRAINER] },
  // Assessments are trainer-authored (spec §8) — only a trainer uploads their photos.
  'assessment-photo': { prefix: 'assessment-photos', allowedRoles: [Role.TRAINER] },
  // A student can upload their own atestado, or a trainer can register it for them.
  'medical-clearance': {
    prefix: 'medical-clearances',
    allowedRoles: [Role.TRAINER, Role.STUDENT],
  },
};

@Injectable()
export class MediaService {
  constructor(private readonly storage: StorageService) {}

  async presign(
    tenantId: string,
    role: Role,
    input: PresignRequestInput,
  ): Promise<PresignResponseDto> {
    const rule = KIND_RULES[input.kind];
    if (!rule.allowedRoles.includes(role)) {
      throw new ForbiddenException('Seu papel não pode enviar esse tipo de arquivo.');
    }

    const extension = EXTENSION_BY_MIME[input.mime];
    const key = `${rule.prefix}/${tenantId}/${randomUUID()}.${extension}`;
    const uploadUrl = await this.storage.presignPut(key, input.mime, PRESIGN_EXPIRY_SECONDS);
    return { uploadUrl, key };
  }
}
