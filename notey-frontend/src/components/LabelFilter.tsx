import React, { useState, useEffect } from 'react';
import { Label, LabelCreateRequest } from '../types/labels';
import { labelsApi } from '../lib/labelsApi';
import { ColorPicker } from './ColorPicker';
import { IconSelector } from './IconSelector';

interface LabelFilterProps {
  session?: any;
  selectedLabels: string[];
  onLabelsChange: (labelIds: string[]) => void;
  className?: string;
  onManageLabels?: () => void;
}

export const LabelFilter: React.FC<LabelFilterProps> = ({
  session,
  selectedLabels,
  onLabelsChange,
  className = '',
  onManageLabels,
}) => {
  const [labels, setLabels] = useState<Label[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newLabel, setNewLabel] = useState({
    name: '',
    color: '#8E8E93',
    icon: 'tag',
  } as LabelCreateRequest);

  useEffect(() => {
    if (session) {
      loadLabels();
    }
  }, [session]);

  const loadLabels = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const fetchedLabels = await labelsApi.getLabels(session);
      setLabels(fetchedLabels);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load labels');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateLabel = async () => {
    if (!newLabel.name.trim()) return;

    try {
      setError(null);
      const createdLabel = await labelsApi.createLabel(newLabel, session);
      setLabels([...labels, createdLabel]);
      setNewLabel({ name: '', color: '#8E8E93', icon: 'tag' });
      setIsCreating(false);
      // Auto-select the newly created label
      onLabelsChange([...selectedLabels, createdLabel.id]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create label');
    }
  };

  const toggleLabel = (labelId: string) => {
    if (selectedLabels.includes(labelId)) {
      onLabelsChange(selectedLabels.filter(id => id !== labelId));
    } else {
      onLabelsChange([...selectedLabels, labelId]);
    }
  };

  const getSelectedLabelsText = () => {
    if (selectedLabels.length === 0) return 'Filter by labels';
    if (selectedLabels.length === 1) {
      const label = labels.find(l => l.id === selectedLabels[0]);
      return label ? label.name : '1 label selected';
    }
    return `${selectedLabels.length} labels selected`;
  };

  const getSelectedLabelsDisplay = () => {
    return selectedLabels.map(labelId => {
      const label = labels.find(l => l.id === labelId);
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
              toggleLabel(labelId);
            }}
            className="ml-1 hover:bg-black/10 rounded-full p-0.5"
          >
            ×
          </button>
        </span>
      );
    }).filter(Boolean);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Filter Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-notey-orange focus:border-transparent"
      >
        <div className="flex items-center flex-wrap min-h-[20px]">
          {selectedLabels.length > 0 ? (
            getSelectedLabelsDisplay()
          ) : (
            <span className="text-slate-500">{getSelectedLabelsText()}</span>
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

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
          <div className="p-3 border-b border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-900">Labels</h3>
              <button
                onClick={() => setIsCreating(!isCreating)}
                className="text-xs text-notey-orange hover:text-notey-orange/80 font-medium"
              >
                {isCreating ? 'Cancel' : '+ New Label'}
              </button>
            </div>

            {/* Create New Label Form */}
            {isCreating && (
              <div className="space-y-3 p-3 bg-slate-50 rounded-lg">
                <input
                  type="text"
                  placeholder="Label name"
                  value={newLabel.name}
                  onChange={(e) => setNewLabel({ ...newLabel, name: e.target.value })}
                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-notey-orange"
                  onKeyPress={(e) => e.key === 'Enter' && handleCreateLabel()}
                />
                <div className="flex items-center space-x-2">
                  <ColorPicker
                    selectedColor={newLabel.color}
                    onColorChange={(color) => setNewLabel({ ...newLabel, color })}
                    className="flex-1"
                  />
                  <IconSelector
                    selectedIcon={newLabel.icon}
                    onIconChange={(icon) => setNewLabel({ ...newLabel, icon })}
                    className="flex-1"
                  />
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={handleCreateLabel}
                    disabled={!newLabel.name.trim()}
                    className="flex-1 px-3 py-1 text-xs bg-notey-orange text-white rounded hover:bg-notey-orange/80 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setIsCreating(false)}
                    className="flex-1 px-3 py-1 text-xs border border-slate-300 text-slate-700 rounded hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
                {error && (
                  <p className="text-xs text-red-600">{error}</p>
                )}
              </div>
            )}
          </div>

          {/* Labels List */}
          <div className="p-2">
            {isLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-notey-orange mx-auto"></div>
                <p className="text-xs text-slate-500 mt-2">Loading labels...</p>
              </div>
            ) : labels.length === 0 ? (
              <div className="text-center py-4 text-slate-500">
                <p className="text-xs">No labels yet</p>
                <p className="text-xs mt-1">Create your first label above</p>
              </div>
            ) : (
              <div className="space-y-1">
                {labels.map((label) => (
                  <label
                    key={label.id}
                    className="flex items-center px-2 py-2 rounded hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedLabels.includes(label.id)}
                      onChange={() => toggleLabel(label.id)}
                      className="mr-3 rounded border-slate-300 text-notey-orange focus:ring-notey-orange"
                    />
                    <span
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mr-2"
                      style={{ backgroundColor: `${label.color}20`, color: label.color }}
                    >
                      <span className="mr-1">{label.icon}</span>
                      {label.name}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Manage Labels Section */}
          {onManageLabels && (
            <div className="border-t border-slate-200 p-3">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onManageLabels();
                }}
                className="w-full flex items-center justify-center px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors border border-slate-200"
              >
                <span className="mr-2">⚙️</span>
                Manage Labels
              </button>
            </div>
          )}
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
