import React, { useState, useRef, useEffect } from 'react';

interface LabelCreationProps {
  newLabel: { name: string; color: string; description?: string };
  onNewLabelChange: (updates: Partial<{ name: string; color: string; description: string }>) => void;
  onCreate: () => void;
  onCancel: () => void;
  canCreate: boolean;
  isLoading: boolean;
  error?: string | null;
  placeholder?: string;
  availableLabels?: Array<{ name: string }>;
  className?: string;
}

const PRESET_COLORS = [
  '#FF6A00', '#16a34a', '#2563eb', '#9333ea', 
  '#ef4444', '#0ea5e9', '#f59e0b', '#10b981'
];

export const LabelCreation: React.FC<LabelCreationProps> = ({
  newLabel,
  onNewLabelChange,
  onCreate,
  onCancel,
  canCreate,
  isLoading,
  error,
  placeholder = "Create new label…",
  availableLabels = [],
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-expand when input is focused or has content
  const shouldExpand = isFocused || isExpanded || newLabel.name.length > 0;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canCreate) {
      e.preventDefault();
      onCreate();
    } else if (e.key === 'Escape') {
      setIsFocused(false);
      setIsExpanded(false);
      inputRef.current?.blur();
    }
  };

  const handleClear = () => {
    onNewLabelChange({ name: '', color: '#FF6A00', description: '' });
    setIsFocused(false);
    setIsExpanded(false);
  };

  const handleCreate = () => {
    onCreate();
    setIsFocused(false);
    setIsExpanded(false);
  };

  // Check for duplicate names
  const isDuplicate = newLabel.name.trim() && availableLabels.some(label => 
    label.name.toLowerCase() === newLabel.name.trim().toLowerCase()
  );

  return (
    <div 
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => !isFocused && setIsExpanded(false)}
    >
      {/* Compact Default View */}
      <div className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg hover:border-slate-300 transition-colors">
        {/* Color Swatches - Horizontally Scrollable */}
        <div className="flex-shrink-0">
          <div 
            className="flex gap-1.5 overflow-x-auto scrollbar-hide"
            style={{ 
              scrollSnapType: 'x mandatory',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}
          >
            {PRESET_COLORS.map(color => (
              <button
                key={color}
                onClick={() => onNewLabelChange({ color })}
                className={`flex-shrink-0 w-6 h-6 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                  newLabel.color === color 
                    ? 'ring-2 ring-slate-400 scale-110' 
                    : 'hover:scale-105'
                }`}
                style={{ 
                  backgroundColor: color,
                  scrollSnapAlign: 'start'
                }}
                title={color}
                aria-label={`Select color ${color}`}
              />
            ))}
          </div>
        </div>

        {/* Label Name Input */}
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={newLabel.name}
          onChange={(e) => onNewLabelChange({ name: e.target.value.slice(0, 30) })}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          className="flex-1 min-w-0 text-sm bg-transparent placeholder:text-slate-400 focus:outline-none"
          maxLength={30}
          style={{
            textOverflow: 'ellipsis'
          }}
        />

        {/* Quick Create Button (always visible) */}
        {newLabel.name.trim() && !shouldExpand && (
          <button
            onClick={handleCreate}
            disabled={!canCreate || isLoading || isDuplicate}
            className="flex-shrink-0 px-2 py-1 text-xs bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? '...' : '+'}
          </button>
        )}
      </div>

      {/* Expanded Controls - Smooth Height Transition */}
      <div 
        className={`overflow-hidden transition-all duration-300 ease-out ${
          shouldExpand ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-3 bg-white border-x border-b border-slate-200 rounded-b-lg shadow-sm">
          {/* Error Message */}
          {error && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
              {error}
            </div>
          )}

          {/* Duplicate Warning */}
          {isDuplicate && (
            <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
              A label with this name already exists
            </div>
          )}

          {/* Secondary Controls Row */}
          <div className="flex items-center gap-2 mb-3">
            {/* Custom Hex Input */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-600">#</span>
              <input
                type="text"
                value={newLabel.color.replace('#', '')}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
                  onNewLabelChange({ color: `#${value}` });
                }}
                className="w-16 px-1 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
                placeholder="FF6A00"
                maxLength={6}
              />
            </div>

            {/* Color Preview */}
            <div 
              className="w-6 h-6 rounded border border-slate-300"
              style={{ backgroundColor: newLabel.color }}
            />

            {/* Character Count */}
            <div className="flex-1 text-right">
              <span className="text-xs text-slate-400">
                {newLabel.name.length}/30
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!canCreate || isLoading || isDuplicate}
              className="flex-1 h-8 px-3 text-sm bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {isLoading ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={handleClear}
              disabled={isLoading}
              className="px-3 h-8 text-sm border border-slate-300 text-slate-700 rounded hover:bg-slate-50 disabled:opacity-50 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Mobile-Specific Styles */}
      <style jsx>{`
        @media (max-width: 640px) {
          .scrollbar-hide {
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};

// Compact Label Creation for tight spaces
export const CompactLabelCreation: React.FC<LabelCreationProps> = (props) => {
  return (
    <div className="relative overflow-hidden">
      <LabelCreation 
        {...props}
        className="max-w-full"
      />
    </div>
  );
};

// Inline Label Creation for event cards
export const InlineLabelCreation: React.FC<LabelCreationProps> = (props) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1 rounded-full border border-orange-400 text-orange-600 text-xs md:text-sm font-medium px-3 py-1 hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
        </svg>
        <span className="hidden sm:inline">Add Label</span>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          <div className="absolute z-50 top-full left-0 mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-lg">
            <div className="p-3">
              <LabelCreation 
                {...props}
                onCreate={() => {
                  props.onCreate();
                  setIsOpen(false);
                }}
                onCancel={() => {
                  props.onCancel();
                  setIsOpen(false);
                }}
              />
            </div>
          </div>
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
        </>
      )}
    </div>
  );
};

// Filter Dropdown Label Creation
export const FilterLabelCreation: React.FC<LabelCreationProps> = (props) => {
  return (
    <div className="w-full max-w-sm mx-auto">
      <LabelCreation 
        {...props}
        className="w-full"
      />
    </div>
  );
};