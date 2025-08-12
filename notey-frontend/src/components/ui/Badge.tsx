import React from 'react';
import { cn } from '../../lib/utils.js';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md';
  children: React.ReactNode;
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', children, ...props }, ref) => {
    const baseClasses = 'inline-flex items-center rounded-full font-medium transition-colors';
    
    const variants = {
      default: 'bg-notey-orange/10 text-notey-orange border border-notey-orange/20',
      secondary: 'bg-slate-100 text-slate-700 border border-slate-200',
      success: 'bg-green-100 text-green-700 border border-green-200',
      warning: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
      error: 'bg-red-100 text-red-700 border border-red-200'
    };

    const sizes = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-1 text-sm'
    };

    return (
      <div
        ref={ref}
        className={cn(
          baseClasses,
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
