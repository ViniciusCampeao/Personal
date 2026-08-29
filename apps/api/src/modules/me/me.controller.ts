import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Patch, Req } from '@nestjs/common';
import { type Request } from 'express';
import {
  deleteMyAccountSchema,
  updateMyProfileSchema,
  type DataExportDto,
  type DeleteMyAccountInput,
  type MyProfileDto,
  type UpdateMyProfileInput,
} from '@pt/shared';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { type RequestUser } from '../../common/auth/types';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { MeService } from './me.service';

/**
 * Everything the signed-in user can do about *themselves*, including the two LGPD
 * rights the spec requires to be self-service: export (§10.4) and erasure (§10.5).
 */
@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get('profile')
  profile(@CurrentUser() user: RequestUser): Promise<MyProfileDto> {
    return this.me.profile(user.id);
  }

  @Patch('profile')
  update(
    @Body(new ZodValidationPipe(updateMyProfileSchema)) body: UpdateMyProfileInput,
    @CurrentUser() user: RequestUser,
  ): Promise<MyProfileDto> {
    return this.me.updateProfile(user.id, body);
  }

  @Get('export')
  exportData(@CurrentUser() user: RequestUser): Promise<DataExportDto> {
    return this.me.exportData(user.id);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Body(new ZodValidationPipe(deleteMyAccountSchema)) body: DeleteMyAccountInput,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
  ): Promise<void> {
    return this.me.deleteAccount(user.id, user.role, body.password, req.ip);
  }
}
