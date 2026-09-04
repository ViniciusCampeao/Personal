import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { PATHS } from '@/routes/paths';

/**
 * Execution is deliberately absent: it is a stacked, full-screen route, not a tab.
 * Check-in, assessments and notifications are reached from the screens that mention
 * them — five tabs is already the ceiling for a thumb.
 */
const ITEMS = [
  { to: PATHS.studentHome, label: 'Início', end: true },
  { to: PATHS.studentHistory, label: 'Histórico', end: false },
  { to: PATHS.studentProgress, label: 'Progresso', end: false },
  { to: PATHS.studentAssessments, label: 'Avaliações', end: false },
  { to: PATHS.studentProfile, label: 'Perfil', end: false },
] as const;

export function BottomNav() {
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="flex">
        {ITEMS.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  // The 2px rule sits on the tab's top edge, flush with the nav border,
                  // so the current tab is readable without relying on colour alone.
                  'flex min-h-touch flex-col items-center justify-center gap-0.5 border-t-2 px-2 py-2 text-xs transition-colors',
                  isActive
                    ? 'border-accent font-medium text-accent'
                    : 'border-transparent text-text-subtle hover:text-text-muted',
                )
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
