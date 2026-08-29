import type { FieldValues, Resolver } from 'react-hook-form';

/**
 * Wraps a resolver so untouched optional inputs are read as "not informed".
 *
 * An empty text input arrives as `''`, and the shared schemas mark those fields
 * `.optional()` — which accepts `undefined`, not `''`. Without this, leaving the
 * optional phone blank fails validation with "Telefone inválido.".
 */
export function withBlankAsUndefined<TFieldValues extends FieldValues, TContext = unknown>(
  resolver: Resolver<TFieldValues, TContext>,
  keys: readonly (keyof TFieldValues)[],
): Resolver<TFieldValues, TContext> {
  return (values, context, options) => {
    const normalized = { ...values };
    for (const key of keys) {
      if (normalized[key] === '') delete normalized[key];
    }
    return resolver(normalized, context, options);
  };
}
