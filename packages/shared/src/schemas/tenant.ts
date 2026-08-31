/**
 * Read-only branding for the current tenant — name + logo shown across the app shell
 * (sidebar, student portal). Unlike `/admin/tenant` (ADMIN-only, full read/write), this
 * is available to every authenticated role: a student needs to see their trainer's
 * brand just as much as the trainer does.
 */
export interface TenantBrandingDto {
  name: string;
  logoUrl: string | null;
}
