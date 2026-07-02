import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type DialogProps = HTMLAttributes<HTMLDivElement> & {
  open: boolean;
  children: ReactNode;
};

export function Dialog({ open, children, className, ...props }: DialogProps) {
  if (!open) return null;

  return (
    <div className={cn('ui-dialog-backdrop', className)} {...props}>
      {children}
    </div>
  );
}

export function DialogContent({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn('ui-dialog-content', className)} role="dialog" aria-modal="true" {...props} />;
}

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('ui-dialog-header', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('ui-dialog-title', className)} {...props} />;
}

export function DialogDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('ui-dialog-description', className)} {...props} />;
}
