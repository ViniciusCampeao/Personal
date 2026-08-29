import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { type Request } from 'express';
import {
  createAnamnesisSchema,
  createMedicalClearanceSchema,
  type AnamnesisDto,
  type AnamnesisListResponseDto,
  type CreateAnamnesisInput,
  type CreateMedicalClearanceInput,
} from '@pt/shared';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { type RequestUser } from '../../common/auth/types';
import { AnamnesisService } from './anamnesis.service';

@Controller('students/:id')
export class AnamnesisController {
  constructor(private readonly anamnesis: AnamnesisService) {}

  @Get('anamnesis')
  list(
    @Param('id') studentId: string,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
  ): Promise<AnamnesisListResponseDto> {
    return this.anamnesis.list(studentId, user.id, user.role, req.ip);
  }

  @Post('anamnesis')
  create(
    @Param('id') studentId: string,
    @Body(new ZodValidationPipe(createAnamnesisSchema)) body: CreateAnamnesisInput,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
  ): Promise<AnamnesisDto> {
    return this.anamnesis.create(studentId, user.id, user.role, body, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('medical-clearance')
  createMedicalClearance(
    @Param('id') studentId: string,
    @Body(new ZodValidationPipe(createMedicalClearanceSchema)) body: CreateMedicalClearanceInput,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.anamnesis.createMedicalClearance(studentId, user.id, user.role, body);
  }
}
