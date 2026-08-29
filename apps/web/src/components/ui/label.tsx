import { type LabelHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/** `htmlFor` is supplied by the caller — always `<Field>`, which generates the id pair. */
export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  // eslint-disable-next-line jsx-a11y/label-has-associated-control
  return <label className={cn('text-sm font-medium text-text', className)} {...props} />;
}
