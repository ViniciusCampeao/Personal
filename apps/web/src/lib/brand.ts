import logo from '@/assets/logo.png';
import logoMark from '@/assets/logo-mark.png';

/**
 * The product's own identity, used wherever there is no tenant to speak for itself: the
 * sign-in screen, the invite screen, the browser tab, and as the fallback in
 * `<TenantBrand>` while the tenant's branding is still loading.
 *
 * A tenant that uploads its own name and logo (Perfil → Marca) overrides this everywhere
 * inside the app — the multi-tenant path is intact. This is simply who the app is when
 * nobody has overridden it.
 *
 * `logo` is the full badge; `logoMark` is the head cropped to a disc, for anywhere the
 * ring lettering would be too small to read (roughly under 64px). Both are also the
 * source the PWA icons are generated from — see scripts/generate-icons.mjs.
 */
export const BRAND = {
  name: 'João Rodrigues',
  legalName: 'João Rodrigues — Personal Trainer e Consultoria Esportiva',
  tagline: 'Personal Trainer e Consultoria Esportiva',
  logo,
  logoMark,
} as const;
