import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { type Request, type Response } from 'express';
import { loginSchema, type LoginResponseDto } from '@pt/shared';
import { Public } from '../../common/auth/public.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import {
  clearRefreshCookie,
  REFRESH_COOKIE_NAME,
  setRefreshCookie,
} from '../../common/auth/cookies';
import { readEnv, type Env } from '../../config/env';
import { type RequestUser } from '../../common/auth/types';
import { AuthService, type IssuedSession } from './auth.service';

// Effectively disabled under test — e2e specs legitimately log in dozens of times.
const LOGIN_THROTTLE_LIMIT = process.env.NODE_ENV === 'test' ? 100_000 : 5;

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private respondWithSession(res: Response, session: IssuedSession): LoginResponseDto {
    setRefreshCookie(res, readEnv(this.config), session.refreshToken, session.refreshMaxAgeMs);
    return { accessToken: session.accessToken, user: session.user };
  }

  @Public()
  @Throttle({ default: { limit: LOGIN_THROTTLE_LIMIT, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: { email: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const session = await this.auth.login(body.email, body.password);
    return this.respondWithSession(res, session);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponseDto> {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    if (!token) {
      clearRefreshCookie(res, readEnv(this.config));
      throw new UnauthorizedException('Sessão inválida.');
    }
    const session = await this.auth.refresh(token);
    return this.respondWithSession(res, session);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const token = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
    await this.auth.logout(token);
    clearRefreshCookie(res, readEnv(this.config));
  }

  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return this.auth.me(user.id);
  }
}
