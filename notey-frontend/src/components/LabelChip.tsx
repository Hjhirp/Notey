import React from 'react';
import { Label } from '../types/labels';

interface LabelChipProps {
  label: Label;
  onRemove?: () => void;
  onClick?: () => void;
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'outlined' | 'filled';
  className?: string;
}

export const LabelChip: React.FC<LabelChipProps> = ({
  label,
  onRemove,
  onClick,
  size = 'medium',
  variant = 'default',
  className = '',
}) => {
  const sizeClasses = {
    small: 'px-2 py-1 text-xs',
    medium: 'px-3 py-1.5 text-sm',
    large: 'px-4 py-2 text-base',
  };

  const variantClasses = {
    default: 'bg-gray-100 text-gray-800 border border-gray-200',
    outlined: 'bg-transparent text-gray-700 border border-gray-300',
    filled: `bg-[${label.color}] text-white border border-[${label.color}]`,
  };

  const baseClasses = 'inline-flex items-center gap-2 rounded-full font-medium transition-colors duration-200';
  const sizeClass = sizeClasses[size];
  const variantClass = variantClasses[variant];

  return (
    <span
      className={`${baseClasses} ${sizeClass} ${variantClass} ${className}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <span className="flex items-center gap-1">
        <i className={`fas fa-${label.icon}`} style={{ color: variant === 'filled' ? 'white' : label.color }} />
        <span>{label.name}</span>
      </span>
      
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-1 rounded-full p-0.5 hover:bg-black/10 transition-colors duration-200"
          aria-label={`Remove ${label.name} label`}
        >
          <i className="fas fa-times text-xs" />
        </button>
      )}
    </span>
  );
};
