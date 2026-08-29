import { cn } from '@/lib/cn';
import { useToast, type ToastVariant } from './use-toast';

const variantClasses: Record<ToastVariant, string> = {
  info: 'border-border-strong bg-surface-raised text-text',
  success: 'border-success/40 bg-success/10 text-success',
  error: 'border-danger/40 bg-danger/10 text-danger',
};

/** Single live region for the whole app; mounted once next to the router. */
export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg',
            variantClasses[toast.variant],
          )}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => dismiss(toast.id)}
            className="shrink-0 text-current opacity-70 hover:opacity-100"
          >
            Fechar
          </button>
        </div>
      ))}
    </div>
  );
}
