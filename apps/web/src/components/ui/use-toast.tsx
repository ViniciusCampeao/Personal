import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';

export type ToastVariant = 'info' | 'success' | 'error';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (message: string, variant?: ToastVariant) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

type Action = { type: 'add'; toast: Toast } | { type: 'dismiss'; id: string };

function reducer(state: Toast[], action: Action): Toast[] {
  switch (action.type) {
    case 'add':
      return [...state, action.toast];
    case 'dismiss':
      return state.filter((t) => t.id !== action.id);
  }
}

const AUTO_DISMISS_MS = 6_000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, dispatch] = useReducer(reducer, []);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => dispatch({ type: 'dismiss', id }), []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      counter.current += 1;
      const id = `toast-${counter.current}`;
      dispatch({ type: 'add', toast: { id, message, variant } });
      setTimeout(() => dispatch({ type: 'dismiss', id }), AUTO_DISMISS_MS);
    },
    [dispatch],
  );

  const value = useMemo(() => ({ toasts, toast, dismiss }), [toasts, toast, dismiss]);
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast precisa estar dentro de <ToastProvider>.');
  return ctx;
}
