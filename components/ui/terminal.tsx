import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type TerminalProps = HTMLAttributes<HTMLPreElement> & {
  title?: string;
  value: string;
};

export function Terminal({ title = 'terminal', value, className, ...props }: TerminalProps) {
  return (
    <div className="terminal-frame">
      <div className="terminal-chrome">
        <span />
        <span />
        <span />
        <strong>{title}</strong>
      </div>
      <pre className={cn('terminal-screen', className)} {...props}>
        {value}
      </pre>
    </div>
  );
}
