import { Body, Controller, Post } from '@nestjs/common';
import {
  presignRequestSchema,
  type PresignRequestInput,
  type PresignResponseDto,
} from '@pt/shared';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { type RequestUser } from '../../common/auth/types';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('presign')
  presign(
    @Body(new ZodValidationPipe(presignRequestSchema)) body: PresignRequestInput,
    @CurrentUser() user: RequestUser,
  ): Promise<PresignResponseDto> {
    return this.media.presign(user.tenantId, user.role, body);
  }
}
