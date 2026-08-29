import { Body, Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import { type Response, type Request } from 'express';
import { Role } from '@prisma/client';
import {
  addAssessmentPhotoSchema,
  compareAssessmentsQuerySchema,
  createAssessmentSchema,
  listAssessmentsQuerySchema,
  type AddAssessmentPhotoInput,
  type AssessmentCompareDto,
  type AssessmentDetailDto,
  type AssessmentPhotoDto,
  type CompareAssessmentsQuery,
  type CreateAssessmentInput,
  type ListAssessmentsQuery,
  type ListAssessmentsResponseDto,
} from '@pt/shared';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { ZodValidationPipe } from '../../common/validation/zod-validation.pipe';
import { type RequestUser } from '../../common/auth/types';
import { AssessmentsService } from './assessments.service';

@Controller()
export class AssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}

  @Roles(Role.TRAINER)
  @Post('students/:id/assessments')
  create(
    @Param('id') studentId: string,
    @Body(new ZodValidationPipe(createAssessmentSchema)) body: CreateAssessmentInput,
    @CurrentUser() user: RequestUser,
  ): Promise<AssessmentDetailDto> {
    return this.assessments.create(studentId, user.id, body);
  }

  @Get('students/:id/assessments')
  list(
    @Param('id') studentId: string,
    @Query(new ZodValidationPipe(listAssessmentsQuerySchema)) query: ListAssessmentsQuery,
    @CurrentUser() user: RequestUser,
  ): Promise<ListAssessmentsResponseDto> {
    return this.assessments.list(studentId, user.id, user.role, query);
  }

  // Declared before `assessments/:id` so `compare` isn't captured as an `:id`.
  @Get('assessments/compare')
  compare(
    @Query(new ZodValidationPipe(compareAssessmentsQuerySchema)) query: CompareAssessmentsQuery,
    @CurrentUser() user: RequestUser,
  ): Promise<AssessmentCompareDto> {
    return this.assessments.compare(user.id, user.role, query);
  }

  @Get('assessments/:id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
  ): Promise<AssessmentDetailDto> {
    return this.assessments.findOne(id, user.id, user.role, req.ip);
  }

  @Roles(Role.TRAINER)
  @Post('assessments/:id/photos')
  addPhoto(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(addAssessmentPhotoSchema)) body: AddAssessmentPhotoInput,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
  ): Promise<AssessmentPhotoDto> {
    return this.assessments.addPhoto(id, user.id, body, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Get('assessments/:id/pdf')
  async pdf(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ): Promise<void> {
    const { buffer, filename } = await this.assessments.pdf(id, user.id, user.role);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(buffer);
  }
}
