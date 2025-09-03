import * as React from 'react';
import Link, { type LinkProps } from 'next/link';
import type { VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

interface LinkButtonProps
  extends LinkProps,
    VariantProps<typeof buttonVariants>,
    Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> {
  disabled?: boolean;
}

function LinkButton({
  className,
  variant,
  size,
  href,
  disabled,
  children,
  ...props
}: LinkButtonProps) {
  return (
    <Link
      href={!disabled ? href : ''}
      className={cn(
        buttonVariants({ variant, size, className }),
        disabled && 'pointer-events-none opacity-50',
      )}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : undefined}
      {...props}
    >
      {children}
    </Link>
  );
}

export { LinkButton, type LinkButtonProps };
