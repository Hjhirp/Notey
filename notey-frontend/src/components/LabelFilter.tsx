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
  const [editingLabel, setEditingLabel] = useState<Label | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const [newLabel, setNewLabel] = useState({
    name: '',
    color: '#8E8E93',
    icon: 'tag',
  } as LabelCreateRequest);

  const [editForm, setEditForm] = useState({
    name: '',
    color: '#8E8E93',
    icon: 'tag',
  });

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

  const handleEditLabel = async () => {
    if (!editingLabel || !editForm.name.trim()) return;

    try {
      setError(null);
      const updatedLabel = await labelsApi.updateLabel(editingLabel.id, editForm, session);
      setLabels(labels.map(label => label.id === editingLabel.id ? updatedLabel : label));
      setEditingLabel(null);
      setEditForm({ name: '', color: '#8E8E93', icon: 'tag' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update label');
    }
  };

  const handleDeleteLabel = async (labelId: string) => {
    const labelToDelete = labels.find(l => l.id === labelId);
    const labelName = labelToDelete?.name || 'this label';
    
    if (!confirm(`Are you sure you want to delete "${labelName}"? This will remove the label from all events but keep the events themselves. This action cannot be undone.`)) {
      return;
    }

    setIsDeleting(labelId);
    try {
      setError(null);
      // Delete from backend (this handles cascading deletion from Supabase)
      await labelsApi.deleteLabel(labelId, session);
      
      // Update local state
      setLabels(labels.filter(label => label.id !== labelId));
      
      // Remove from selected labels if it was selected
      if (selectedLabels.includes(labelId)) {
        onLabelsChange(selectedLabels.filter(id => id !== labelId));
      }
      
      // Trigger a refresh of events to reflect the label removal
      // This ensures that events no longer show the deleted label
      if (window.location.pathname.includes('events')) {
        window.dispatchEvent(new CustomEvent('labelDeleted', { detail: { labelId } }));
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete label');
      console.error('Failed to delete label:', err);
    } finally {
      setIsDeleting(null);
    }
  };

  const startEditing = (label: Label) => {
    setEditingLabel(label);
    setEditForm({
      name: label.name,
      color: label.color,
      icon: label.icon,
    });
  };

  const cancelEditing = () => {
    setEditingLabel(null);
    setEditForm({ name: '', color: '#8E8E93', icon: 'tag' });
  };

  const resetAllFilters = () => {
    onLabelsChange([]);
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
          <span className="mr-1">{label.icon === 'tag' ? '🏷️' : label.icon}</span>
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
        <div className="absolute z-50 w-full min-w-64 max-w-80 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
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
                  <div key={label.id} className="group">
                    {editingLabel?.id === label.id ? (
                      // Edit mode
                      <div className="p-2 bg-slate-50 rounded-lg space-y-2">
                        <input
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-notey-orange"
                          placeholder="Label name"
                        />
                        <div className="flex items-center space-x-2">
                          <ColorPicker
                            selectedColor={editForm.color}
                            onColorChange={(color) => setEditForm({ ...editForm, color })}
                            className="flex-1"
                          />
                          <IconSelector
                            selectedIcon={editForm.icon}
                            onIconChange={(icon) => setEditForm({ ...editForm, icon })}
                            className="flex-1"
                          />
                        </div>
                        <div className="flex space-x-1">
                          <button
                            onClick={handleEditLabel}
                            disabled={!editForm.name.trim()}
                            className="flex-1 px-2 py-1 text-xs bg-notey-orange text-white rounded hover:bg-notey-orange/80 disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="flex-1 px-2 py-1 text-xs border border-slate-300 text-slate-700 rounded hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Normal mode
                      <div className="flex items-center px-2 py-2 rounded hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={selectedLabels.includes(label.id)}
                          onChange={() => toggleLabel(label.id)}
                          className="mr-3 rounded border-slate-300 text-notey-orange focus:ring-notey-orange"
                        />
                        <span
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium flex-1 mr-2"
                          style={{ backgroundColor: `${label.color}20`, color: label.color }}
                        >
                          <span className="mr-1">{label.icon === 'tag' ? '🏷️' : label.icon}</span>
                          {label.name}
                        </span>
                        <div className="opacity-0 group-hover:opacity-100 flex space-x-1">
                          <button
                            onClick={() => startEditing(label)}
                            className="p-1 text-slate-400 hover:text-slate-600 rounded"
                            title="Edit label"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteLabel(label.id)}
                            disabled={isDeleting === label.id}
                            className="p-1 text-slate-400 hover:text-red-600 rounded disabled:opacity-50"
                            title="Delete label"
                          >
                            {isDeleting === label.id ? (
                              <div className="animate-spin w-3 h-3 border border-slate-400 border-t-transparent rounded-full"></div>
                            ) : (
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons Section */}
          <div className="border-t border-slate-200 p-3 space-y-2">
            {/* Reset All Filters */}
            {selectedLabels.length > 0 && (
              <button
                onClick={resetAllFilters}
                className="w-full flex items-center justify-center px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors border border-slate-200"
              >
                <span className="mr-2">🔄</span>
                Reset All Filters
              </button>
            )}
            
            {/* Manage Labels (if provided) */}
            {onManageLabels && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onManageLabels();
                }}
                className="w-full flex items-center justify-center px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors border border-slate-200"
              >
                <span className="mr-2">⚙️</span>
                Advanced Label Manager
              </button>
            )}
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
