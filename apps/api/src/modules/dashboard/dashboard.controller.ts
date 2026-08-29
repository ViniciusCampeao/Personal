import { Controller, Get } from '@nestjs/common';
import { Role } from '@prisma/client';
import { type DashboardResponseDto } from '@pt/shared';
import { Roles } from '../../common/auth/roles.decorator';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { type RequestUser } from '../../common/auth/types';
import { DashboardService } from './dashboard.service';

@Controller()
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Roles(Role.TRAINER)
  @Get('dashboard')
  getDashboard(@CurrentUser() user: RequestUser): Promise<DashboardResponseDto> {
    return this.dashboard.getDashboard(user.id);
  }
}
