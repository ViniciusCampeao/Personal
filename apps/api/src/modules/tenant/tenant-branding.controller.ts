import { Controller, Get } from '@nestjs/common';
import { type TenantBrandingDto } from '@pt/shared';
import { TenantBrandingService } from './tenant-branding.service';

/**
 * No `@Roles` guard: unlike `/admin/tenant`, every authenticated role (trainer, student)
 * needs to read the brand shown in the app shell — only `/admin/tenant` can write it.
 */
@Controller('tenant')
export class TenantBrandingController {
  constructor(private readonly branding: TenantBrandingService) {}

  @Get('branding')
  getBranding(): Promise<TenantBrandingDto> {
    return this.branding.getBranding();
  }
}
