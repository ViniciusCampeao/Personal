import { type ReactNode } from 'react';

/**
 * One page-title treatment for every screen. Screens were each rolling their own `h1`,
 * which is why headings drifted in size and none of them carried context — the title now
 * always has room for a line saying what the page is for, and for its actions.
 *
 * `leading` is for the screens that are *about* someone (the student sheet): an avatar
 * there tells you whose page this is before you have read the name.
 */
export function PageHeader({
  title,
  description,
  actions,
  leading,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  leading?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        {leading}
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="text-sm text-text-muted">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
