import { HTMLAttributes, LabelHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Field({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('ui-field', className)} {...props} />;
}

export function FieldLabel({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('ui-field-label', className)} {...props} />;
}
