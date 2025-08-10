import React, { useState, useEffect } from 'react';
import { Label, LabelCreateRequest } from '../types/labels';
import { labelsApi } from '../lib/labelsApi';

interface AddLabelProps {
  // Mode determines the UI context
  mode: 'event' | 'filter';
  
  // Common props
  session?: any;
  availableLabels: Label[];
  
  // Event mode props
  eventId?: string;
  assignedLabels?: Label[];
  
  // Filter mode props
  selectedLabels?: string[];
  
  // Event handlers
  onCreateLabel: (name: string, color: string, description?: string) => Promise<Label>;
  onAssignLabel: (labelId: string) => void;
  onRemoveLabel: (labelId: string) => void;
  onLabelsChange?: (labelIds: string[]) => void; // For filter mode
  
  // UI props
  className?: string;
  placeholder?: string;
}

const PRESET_COLORS = [
  '#FF6A00', '#16a34a', '#2563eb', '#9333ea', 
  '#ef4444', '#0ea5e9', '#f59e0b', '#10b981'
];

export const AddLabel: React.FC<AddLabelProps> = ({
  mode,
  session,
  availableLabels,
  eventId,
  assignedLabels = [],
  selectedLabels = [],
  onCreateLabel,
  onAssignLabel,
  onRemoveLabel,
  onLabelsChange,
  className = '',
  placeholder = 'Create new label...'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const [newLabel, setNewLabel] = useState({
    name: '',
    color: '#FF6A00',
    description: '',
  });

  // Get unassigned labels for event mode
  const getUnassignedLabels = () => {
    if (mode === 'filter') return availableLabels;
    
    const assignedIds = assignedLabels.map(l => l.id);
    return availableLabels.filter(label => !assignedIds.includes(label.id));
  };

  // Get display text for the trigger button
  const getDisplayText = () => {
    if (mode === 'event') return 'Add Label';
    
    if (selectedLabels.length === 0) return 'Filter by labels';
    if (selectedLabels.length === 1) {
      const label = availableLabels.find(l => l.id === selectedLabels[0]);
      return label ? label.name : '1 label selected';
    }
    return `${selectedLabels.length} labels selected`;
  };

  // Handle label creation
  const handleCreateLabel = async () => {
    if (!newLabel.name.trim()) return;

    // Check for duplicates
    const nameExists = availableLabels.some(label => 
      label.name.toLowerCase() === newLabel.name.trim().toLowerCase()
    );
    
    if (nameExists) {
      setError("A label with this name already exists.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const createdLabel = await onCreateLabel(
        newLabel.name.trim(),
        newLabel.color,
        newLabel.description.trim() || undefined
      );

      // Reset form
      setNewLabel({ name: '', color: '#FF6A00', description: '' });
      setIsCreating(false);
      
      // Auto-assign the created label
      if (mode === 'event') {
        onAssignLabel(createdLabel.id);
        setIsOpen(false);
      } else if (mode === 'filter' && onLabelsChange) {
        onLabelsChange([...selectedLabels, createdLabel.id]);
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create label');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle label selection/assignment
  const handleLabelSelect = (labelId: string) => {
    if (mode === 'event') {
      onAssignLabel(labelId);
      setIsOpen(false);
    } else if (mode === 'filter' && onLabelsChange) {
      const newSelection = selectedLabels.includes(labelId)
        ? selectedLabels.filter(id => id !== labelId)
        : [...selectedLabels, labelId];
      onLabelsChange(newSelection);
    }
  };

  // Keyboard handling
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setIsCreating(false);
    }
  };

  const handleCreateKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canCreate) {
      e.preventDefault();
      handleCreateLabel();
    }
  };

  const canCreate = newLabel.name.trim() && !availableLabels.some(label => 
    label.name.toLowerCase() === newLabel.name.trim().toLowerCase()
  );

  // Clear all selections (filter mode)
  const clearAllSelections = () => {
    if (onLabelsChange) {
      onLabelsChange([]);
    }
  };

  // Event mode: Inline display with chips + Add button
  if (mode === 'event') {
    return (
      <div className={className}>
        <h4 className="text-sm font-medium text-slate-700 mb-2">Event Labels</h4>
        
        {/* Inline chips + Add button */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {assignedLabels.length > 0 ? (
            assignedLabels.map(label => (
              <span
                key={label.id}
                className="group relative inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border"
                style={{ 
                  backgroundColor: `${label.color}15`, 
                  color: label.color,
                  borderColor: `${label.color}30`
                }}
              >
                <span>{label.icon}</span>
                {label.name}
                <button
                  aria-label={`Remove label ${label.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveLabel(label.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 inline-flex items-center justify-center h-4 w-4 rounded-full hover:bg-slate-100 focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  title="Remove"
                >
                  ×
                </button>
              </span>
            ))
          ) : (
            <span className="text-sm text-slate-500">No labels assigned</span>
          )}

          {/* Add Label Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center gap-1 rounded-full border border-orange-400 text-orange-600 text-xs md:text-sm font-medium px-3 py-1 hover:bg-orange-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
            aria-label="Add label"
            title="Add label"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            <span className="hidden sm:inline">Add Label</span>
          </button>
        </div>

        {/* Dropdown for event mode */}
        {isOpen && (
          <div className="mt-2 p-3 rounded-lg border border-slate-200 bg-slate-50" onKeyDown={handleKeyDown}>
            <EventLabelPicker
              availableLabels={getUnassignedLabels()}
              onSelect={handleLabelSelect}
              onCreateNew={() => setIsCreating(true)}
              isCreating={isCreating}
              newLabel={newLabel}
              onNewLabelChange={setNewLabel}
              onCreate={handleCreateLabel}
              onCancelCreate={() => {
                setIsCreating(false);
                setNewLabel({ name: '', color: '#FF6A00', description: '' });
                setError(null);
              }}
              canCreate={canCreate}
              isLoading={isLoading}
              error={error}
              onClose={() => setIsOpen(false)}
            />
          </div>
        )}
      </div>
    );
  }

  // Filter mode: Dropdown interface
  return (
    <div className={`relative ${className}`}>
      {/* Filter Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full h-10 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
        aria-label="Filter by labels"
      >
        <div className="flex items-center flex-wrap min-h-[20px]">
          {selectedLabels.length > 0 ? (
            selectedLabels.map(labelId => {
              const label = availableLabels.find(l => l.id === labelId);
              if (!label) return null;
              
              return (
                <span
                  key={labelId}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mr-1 mb-1"
                  style={{ backgroundColor: `${label.color}20`, color: label.color }}
                >
                  <span className="mr-1">{label.icon}</span>
                  {label.name}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLabelSelect(labelId);
                    }}
                    className="ml-1 hover:bg-black/10 rounded-full p-0.5"
                  >
                    ×
                  </button>
                </span>
              );
            }).filter(Boolean)
          ) : (
            <span className="text-slate-500">{getDisplayText()}</span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Filter Dropdown */}
      {isOpen && (
        <div 
          className="absolute z-50 left-0 w-[320px] mt-1 rounded-2xl border border-slate-200 bg-white shadow-xl p-3"
          onKeyDown={handleKeyDown}
        >
          <div className="rounded-xl bg-slate-50 p-3">
            <FilterLabelPicker
              availableLabels={availableLabels}
              selectedLabels={selectedLabels}
              onSelect={handleLabelSelect}
              onClearAll={clearAllSelections}
              onClose={() => setIsOpen(false)}
              isCreating={isCreating}
              newLabel={newLabel}
              onNewLabelChange={setNewLabel}
              onCreate={handleCreateLabel}
              canCreate={canCreate}
              isLoading={isLoading}
              error={error}
              placeholder={placeholder}
            />
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

// Event mode label picker component
interface EventLabelPickerProps {
  availableLabels: Label[];
  onSelect: (labelId: string) => void;
  onCreateNew: () => void;
  isCreating: boolean;
  newLabel: { name: string; color: string; description: string };
  onNewLabelChange: (label: { name: string; color: string; description: string }) => void;
  onCreate: () => void;
  onCancelCreate: () => void;
  canCreate: boolean;
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}

const EventLabelPicker: React.FC<EventLabelPickerProps> = ({
  availableLabels,
  onSelect,
  onCreateNew,
  isCreating,
  newLabel,
  onNewLabelChange,
  onCreate,
  onCancelCreate,
  canCreate,
  isLoading,
  error,
  onClose
}) => {
  return (
    <>
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h5 className="text-sm font-medium">Add Labels</h5>
        <div className="flex items-center gap-2">
          {!isCreating && (
            <button
              onClick={onCreateNew}
              className="text-xs text-orange-600 hover:text-orange-700 font-medium focus:outline-none focus:ring-1 focus:ring-orange-500 rounded px-1"
            >
              + Create Label
            </button>
          )}
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
            aria-label="Close label picker"
          >
            ×
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Create Label Form */}
      {isCreating && (
        <CreateLabelForm
          newLabel={newLabel}
          onNewLabelChange={onNewLabelChange}
          onCreate={onCreate}
          onCancel={onCancelCreate}
          canCreate={canCreate}
          isLoading={isLoading}
        />
      )}

      {/* Available Labels */}
      {!isCreating && (
        <div className="space-y-2">
          {availableLabels.length === 0 ? (
            <p className="text-sm text-slate-500 py-2">All available labels are already assigned</p>
          ) : (
            availableLabels.map((label) => (
              <button
                key={label.id}
                onClick={() => onSelect(label.id)}
                className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-slate-50 cursor-pointer"
              >
                <span
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                  style={{ backgroundColor: `${label.color}20`, color: label.color }}
                >
                  <span className="mr-1">{label.icon}</span>
                  {label.name}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </>
  );
};

// Filter mode label picker component
interface FilterLabelPickerProps {
  availableLabels: Label[];
  selectedLabels: string[];
  onSelect: (labelId: string) => void;
  onClearAll: () => void;
  onClose: () => void;
  isCreating: boolean;
  newLabel: { name: string; color: string; description: string };
  onNewLabelChange: (label: { name: string; color: string; description: string }) => void;
  onCreate: () => void;
  canCreate: boolean;
  isLoading: boolean;
  error: string | null;
  placeholder: string;
}

const FilterLabelPicker: React.FC<FilterLabelPickerProps> = ({
  availableLabels,
  selectedLabels,
  onSelect,
  onClearAll,
  onClose,
  isCreating,
  newLabel,
  onNewLabelChange,
  onCreate,
  canCreate,
  isLoading,
  error,
  placeholder
}) => {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-800">Labels</h3>
        <button
          onClick={onClose}
          className="text-sm text-orange-600 hover:text-orange-700 font-medium"
        >
          Cancel
        </button>
      </div>

      {/* Create Form */}
      <CreateLabelForm
        newLabel={newLabel}
        onNewLabelChange={onNewLabelChange}
        onCreate={onCreate}
        onCancel={() => {
          onNewLabelChange({ name: '', color: '#FF6A00', description: '' });
        }}
        canCreate={canCreate}
        isLoading={isLoading}
        placeholder={placeholder}
        showDescription={false}
      />

      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Separator */}
      <div className="border-t border-slate-200 my-2 -mx-3"></div>

      {/* Label List */}
      <div className="max-h-56 overflow-y-auto pr-1">
        {availableLabels.length === 0 ? (
          <div className="text-center py-4 text-slate-500">
            <p className="text-sm">No labels yet</p>
            <p className="text-xs mt-1">Create your first label above</p>
          </div>
        ) : (
          <div className="space-y-1">
            {availableLabels.map((label) => (
              <label
                key={label.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedLabels.includes(label.id)}
                  onChange={() => onSelect(label.id)}
                  className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                />
                <span
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium flex-1"
                  style={{ 
                    backgroundColor: `${label.color}15`, 
                    color: label.color,
                    borderColor: `${label.color}30`
                  }}
                >
                  {label.icon && <span className="mr-1">{label.icon}</span>}
                  {label.name}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          onClick={onClearAll}
          disabled={selectedLabels.length === 0}
          className="text-slate-600 hover:text-slate-800 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Clear
        </button>
        <button
          onClick={onClose}
          disabled={selectedLabels.length === 0}
          className="h-9 px-3 rounded-lg bg-orange-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          Apply ({selectedLabels.length})
        </button>
      </div>
    </>
  );
};

// Shared create label form component
interface CreateLabelFormProps {
  newLabel: { name: string; color: string; description: string };
  onNewLabelChange: (label: { name: string; color: string; description: string }) => void;
  onCreate: () => void;
  onCancel: () => void;
  canCreate: boolean;
  isLoading: boolean;
  placeholder?: string;
  showDescription?: boolean;
}

const CreateLabelForm: React.FC<CreateLabelFormProps> = ({
  newLabel,
  onNewLabelChange,
  onCreate,
  onCancel,
  canCreate,
  isLoading,
  placeholder = "Create new label...",
  showDescription = false
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canCreate) {
      e.preventDefault();
      onCreate();
    }
  };

  return (
    <div className="space-y-3 mb-3">
      {/* Name Input */}
      <input
        type="text"
        placeholder={placeholder}
        value={newLabel.name}
        onChange={(e) => onNewLabelChange({ ...newLabel, name: e.target.value.slice(0, 30) })}
        onKeyDown={handleKeyDown}
        className="w-full text-sm h-9 px-3 rounded-lg border border-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
        maxLength={30}
        autoFocus
      />

      {/* Description Input (optional) */}
      {showDescription && (
        <textarea
          placeholder="Description (optional)"
          value={newLabel.description}
          onChange={(e) => onNewLabelChange({ ...newLabel, description: e.target.value.slice(0, 100) })}
          className="w-full text-sm px-3 py-2 rounded-lg border border-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
          rows={2}
          maxLength={100}
        />
      )}

      {/* Color Selection */}
      <div className="flex items-center gap-2">
        {/* Color Swatches */}
        {PRESET_COLORS.map(color => (
          <button
            key={color}
            onClick={() => onNewLabelChange({ ...newLabel, color })}
            className={`w-7 h-7 rounded-full focus:outline-none focus:ring-2 focus:ring-orange-500 ${
              newLabel.color === color ? 'ring-2 ring-slate-300' : ''
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
        {/* Hex Input */}
        <input
          type="text"
          value={newLabel.color}
          onChange={(e) => onNewLabelChange({ ...newLabel, color: e.target.value })}
          placeholder="#FF6A00"
          className="w-[110px] h-9 px-3 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
          maxLength={7}
        />
      </div>

      {/* Create/Cancel Buttons */}
      <div className="flex gap-2">
        <button
          onClick={onCreate}
          disabled={!canCreate || isLoading}
          className="h-9 px-3 rounded-lg bg-orange-500 text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-orange-500"
        >
          {isLoading ? 'Creating...' : 'Create'}
        </button>
        <button
          onClick={onCancel}
          disabled={isLoading}
          className="h-9 px-3 rounded-lg border border-slate-300 text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-slate-500"
        >
          Clear
        </button>
      </div>
    </div>
  );
};