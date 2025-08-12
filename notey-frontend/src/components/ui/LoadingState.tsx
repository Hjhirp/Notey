import React from 'react';
import { cn } from '../../lib/utils.js';
import { LoadingSpinner } from './LoadingSpinner';

interface LoadingStateProps {
  isLoading: boolean;
  children: React.ReactNode;
  loadingText?: string;
  className?: string;
  spinnerSize?: 'sm' | 'md' | 'lg';
  overlay?: boolean;
}

const LoadingState: React.FC<LoadingStateProps> = ({
  isLoading,
  children,
  loadingText = 'Loading...',
  className,
  spinnerSize = 'md',
  overlay = false
}) => {
  if (!isLoading) {
    return <>{children}</>;
  }

  if (overlay) {
    return (
      <div className={cn('relative', className)}>
        {children}
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="flex flex-col items-center space-y-3">
            <LoadingSpinner size={spinnerSize} />
            <p className="text-sm text-slate-600 font-medium">{loadingText}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col items-center justify-center py-12', className)}>
      <LoadingSpinner size={spinnerSize} />
      <p className="mt-3 text-sm text-slate-600 font-medium">{loadingText}</p>
    </div>
  );
};

interface SkeletonProps {
  className?: string;
  lines?: number;
}

const Skeleton: React.FC<SkeletonProps> = ({ className, lines = 1 }) => {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-slate-200 rounded animate-pulse"
          style={{
            width: i === lines - 1 ? '75%' : '100%'
          }}
        />
      ))}
    </div>
  );
};

const CardSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn('p-6 border border-slate-200 rounded-xl', className)}>
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-10 h-10 bg-slate-200 rounded-full animate-pulse" />
        <div className="flex-1">
          <div className="h-4 bg-slate-200 rounded animate-pulse mb-2" />
          <div className="h-3 bg-slate-200 rounded animate-pulse w-2/3" />
        </div>
      </div>
      <Skeleton lines={3} />
    </div>
  );
};

export { LoadingState, Skeleton, CardSkeleton };
