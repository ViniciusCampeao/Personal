import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Request, type Response } from 'express';
import { Role } from '@prisma/client';
import {
  acceptInviteSchema,
  createInviteSchema,
  type AcceptInviteInput,
  type CreateInviteInput,
  type CreateInviteResponseDto,
  type InvitePreviewDto,
  type LoginResponseDto,
} from '@pt/shared';
import { Public } from '../../common/auth/public.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { setRefreshCookie } from '../../common/auth/cookies';
import { readEnv, type Env } from '../../config/env';
import { type RequestUser } from '../../common/auth/types';
import { InvitesService } from './invites.service';

@Controller()
export class InvitesController {
  constructor(
    private readonly invites: InvitesService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Roles(Role.TRAINER)
  @Post('invites')
  async create(
    @Body(new ZodValidationPipe(createInviteSchema)) body: CreateInviteInput,
    @CurrentUser() user: RequestUser,
  ): Promise<CreateInviteResponseDto> {
    const invite = await this.invites.create(user.id, body);
    return {
      id: invite.id,
      token: invite.token,
      url: invite.url,
      qrCodeDataUrl: invite.qrCodeDataUrl,
      expiresAt: invite.expiresAt.toISOString(),
    };
  }

  @Public()
  @Get('invites/:token')
  preview(@Param('token') token: string): Promise<InvitePreviewDto> {
    return this.invites.preview(token);
  }

  @Public()
  @Post('invites/:token/accept')
  @HttpCode(HttpStatus.OK)
  async accept(
    @Param('token') token: string,
    @Body(new ZodValidationPipe(acceptInviteSchema)) body: AcceptInviteInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const session = await this.invites.accept(token, body, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    setRefreshCookie(res, readEnv(this.config), session.refreshToken, session.refreshMaxAgeMs);
    return { accessToken: session.accessToken, user: session.user };
  }
}
