import React, { useState, useEffect } from 'react';
import { Label, LabelCreateRequest, LabelUpdateRequest } from '../types/labels';
import { labelsApi } from '../lib/labelsApi';
import { LabelChip } from './LabelChip';
import { ColorPicker } from './ColorPicker';
import { IconSelector } from './IconSelector';

interface EventLabelAssignerProps {
  session?: any;
  eventId: string;
  currentLabels: Label[];
  onLabelsChange: (labels: Label[]) => void;
  onLabelsListChange?: () => void;
  className?: string;
}

export const EventLabelAssigner: React.FC<EventLabelAssignerProps> = ({
  session,
  eventId,
  currentLabels,
  onLabelsChange,
  onLabelsListChange,
  className = '',
}) => {
  const [availableLabels, setAvailableLabels] = useState<Label[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAssigning, setIsAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLabelSelector, setShowLabelSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingLabel, setEditingLabel] = useState<Label | null>(null);
  const [showManageMode, setShowManageMode] = useState(false);
  const [newLabel, setNewLabel] = useState<LabelCreateRequest>({
    name: '',
    color: '#8E8E93',
    icon: 'tag',
  });
  const [editForm, setEditForm] = useState<LabelUpdateRequest>({
    name: '',
    color: '#8E8E93',
    icon: 'tag',
  });

  useEffect(() => {
    if (session) {
      loadAvailableLabels();
    }
  }, [session]);

  const loadAvailableLabels = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const labels = await labelsApi.getLabels(session);
      setAvailableLabels(labels);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load labels');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignLabel = async (labelId: string) => {
    try {
      setIsAssigning(true);
      setError(null);
      
      await labelsApi.attachLabel(labelId, 'event', eventId, session);
      
      // Find the label details
      const label = availableLabels.find(l => l.id === labelId);
      if (label) {
        const newLabels = [...currentLabels, label];
        onLabelsChange(newLabels);
      }
      
      setShowLabelSelector(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign label');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemoveLabel = async (labelId: string) => {
    try {
      setIsAssigning(true);
      setError(null);
      
      await labelsApi.detachLabel(labelId, 'event', eventId, session);
      
      const newLabels = currentLabels.filter(l => l.id !== labelId);
      onLabelsChange(newLabels);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove label');
    } finally {
      setIsAssigning(false);
    }
  };

  const getUnassignedLabels = () => {
    const assignedLabelIds = currentLabels.map(l => l.id);
    const unassigned = availableLabels.filter(label => !assignedLabelIds.includes(label.id));
    
    // Filter by search query if provided
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return unassigned.filter(label => label.name.toLowerCase().includes(query));
    }
    
    return unassigned;
  };

  const handleCreateAndAssignLabel = async () => {
    if (!newLabel.name.trim()) return;

    try {
      setIsAssigning(true);
      setError(null);
      
      // Create the new label
      const createdLabel = await labelsApi.createLabel(newLabel, session);
      
      // Add to available labels
      setAvailableLabels([...availableLabels, createdLabel]);
      
      // Assign it to the event
      await labelsApi.attachLabel(createdLabel.id, 'event', eventId, session);
      
      // Update current labels
      const updatedLabels = [...currentLabels, createdLabel];
      onLabelsChange(updatedLabels);
      onLabelsListChange?.();
      
      // Reset form and close
      setNewLabel({ name: '', color: '#8E8E93', icon: 'tag' });
      setShowCreateForm(false);
      setSearchQuery('');
      setShowLabelSelector(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create and assign label');
    } finally {
      setIsAssigning(false);
    }
  };

  const shouldShowCreateOption = () => {
    if (!searchQuery.trim()) return false;
    
    const query = searchQuery.toLowerCase();
    const existsInAvailable = availableLabels.some(label => 
      label.name.toLowerCase() === query
    );
    const existsInCurrent = currentLabels.some(label => 
      label.name.toLowerCase() === query
    );
    
    return !existsInAvailable && !existsInCurrent;
  };

  const handleEditLabel = async () => {
    if (!editingLabel || !editForm.name?.trim()) return;

    try {
      setIsAssigning(true);
      setError(null);
      
      const updatedLabel = await labelsApi.updateLabel(editingLabel.id, editForm, session);
      
      // Update available labels
      setAvailableLabels(labels => labels.map(l => l.id === editingLabel.id ? updatedLabel : l));
      
      // Update current labels if this label is assigned to the event
      const updatedCurrentLabels = currentLabels.map(l => l.id === editingLabel.id ? updatedLabel : l);
      onLabelsChange(updatedCurrentLabels);
      onLabelsListChange?.();
      
      // Reset edit form
      setEditingLabel(null);
      setEditForm({ name: '', color: '#8E8E93', icon: 'tag' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update label');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleDeleteLabel = async (labelId: string) => {
    if (!confirm('Are you sure you want to delete this label? This will remove it from all events.')) {
      return;
    }

    try {
      setIsAssigning(true);
      setError(null);
      
      await labelsApi.deleteLabel(labelId, session);
      
      // Remove from available labels
      setAvailableLabels(labels => labels.filter(l => l.id !== labelId));
      
      // Remove from current labels if assigned
      const updatedCurrentLabels = currentLabels.filter(l => l.id !== labelId);
      onLabelsChange(updatedCurrentLabels);
      onLabelsListChange?.();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete label');
    } finally {
      setIsAssigning(false);
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

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Current Labels Display */}
      <div>
        {currentLabels.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No labels assigned</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {currentLabels.map((label) => (
              <div key={label.id} className="relative group">
                <LabelChip
                  label={label}
                  onRemove={() => handleRemoveLabel(label.id)}
                  size="small"
                  variant="default"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Assign New Label Button - Small Plus */}
      <div>
        <button
          onClick={() => setShowLabelSelector(!showLabelSelector)}
          disabled={isLoading || isAssigning}
          className="inline-flex items-center justify-center w-7 h-7 text-notey-orange bg-notey-orange/10 border border-notey-orange/20 rounded-full hover:bg-notey-orange/20 hover:border-notey-orange/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Add label"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Label Selector Dropdown */}
      {showLabelSelector && (
        <div className="relative">
          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
            <div className="p-3 border-b border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <h5 className="text-sm font-medium text-slate-900">Label Management</h5>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowManageMode(!showManageMode);
                      setShowCreateForm(false);
                      setEditingLabel(null);
                    }}
                    className="text-xs text-slate-600 hover:text-slate-800 font-medium"
                  >
                    {showManageMode ? 'Assign' : 'Manage'}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateForm(!showCreateForm);
                      setSearchQuery('');
                    }}
                    className="text-xs text-notey-orange hover:text-notey-orange/80 font-medium"
                  >
                    {showCreateForm ? 'Cancel' : '+ New'}
                  </button>
                </div>
              </div>

              {/* Search Input */}
              {!showManageMode && (
                <input
                  type="text"
                  placeholder="Search labels or type new label name..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setNewLabel({ ...newLabel, name: e.target.value });
                  }}
                  className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-notey-orange focus:border-notey-orange"
                />
              )}
            </div>
            
            {/* Create New Label Form */}
            {showCreateForm && (
              <div className="p-3 border-b border-slate-200 bg-slate-50">
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <ColorPicker
                      selectedColor={newLabel.color}
                      onColorChange={(color) => setNewLabel({ ...newLabel, color })}
                    />
                    <IconSelector
                      selectedIcon={newLabel.icon}
                      onIconChange={(icon) => setNewLabel({ ...newLabel, icon })}
                    />
                  </div>
                  <button
                    onClick={handleCreateAndAssignLabel}
                    disabled={!newLabel.name.trim() || isAssigning}
                    className="w-full px-3 py-1.5 text-xs bg-notey-orange text-white rounded hover:bg-notey-orange/80 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAssigning ? 'Creating...' : `Create & Assign "${newLabel.name}"`}
                  </button>
                </div>
              </div>
            )}
            
            <div className="p-2">
              {isLoading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-notey-orange mx-auto"></div>
                  <p className="text-xs text-slate-500 mt-2">Loading labels...</p>
                </div>
              ) : showManageMode ? (
                /* Manage Mode - Edit/Delete Labels */
                <div className="space-y-2">
                  {availableLabels.length === 0 ? (
                    <div className="text-center py-4 text-slate-500">
                      <p className="text-xs">No labels created yet</p>
                    </div>
                  ) : (
                    availableLabels.map((label) => (
                      <div key={label.id} className="border border-slate-200 rounded p-2">
                        {editingLabel?.id === label.id ? (
                          /* Edit Form */
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-notey-orange"
                            />
                            <div className="grid grid-cols-2 gap-1">
                              <ColorPicker
                                selectedColor={editForm.color || '#8E8E93'}
                                onColorChange={(color) => setEditForm({ ...editForm, color })}
                              />
                              <IconSelector
                                selectedIcon={editForm.icon || 'tag'}
                                onIconChange={(icon) => setEditForm({ ...editForm, icon })}
                              />
                            </div>
                            <div className="flex gap-1">
                              <button
                                onClick={handleEditLabel}
                                disabled={!editForm.name?.trim() || isAssigning}
                                className="flex-1 px-2 py-1 text-xs bg-notey-orange text-white rounded hover:bg-notey-orange/80 disabled:opacity-50"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEditing}
                                className="flex-1 px-2 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Display Mode */
                          <div className="flex items-center justify-between">
                            <span
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                              style={{ backgroundColor: `${label.color}20`, color: label.color }}
                            >
                              <span className="mr-1">{label.icon}</span>
                              {label.name}
                            </span>
                            <div className="flex gap-1">
                              <button
                                onClick={() => startEditing(label)}
                                className="p-1 text-slate-400 hover:text-slate-600 rounded"
                                title="Edit label"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteLabel(label.id)}
                                className="p-1 text-red-400 hover:text-red-600 rounded"
                                title="Delete label"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              ) : (
                /* Assign Mode - Select/Create Labels */
                <>
                  {/* Show create option if search doesn't match existing labels */}
                  {shouldShowCreateOption() && !showCreateForm && (
                    <button
                      onClick={() => {
                        setShowCreateForm(true);
                        setNewLabel({ ...newLabel, name: searchQuery.trim() });
                      }}
                      className="w-full flex items-center px-2 py-2 rounded hover:bg-notey-orange/10 text-notey-orange border border-notey-orange/20 mb-2"
                    >
                      <span className="mr-2">+</span>
                      Create "{searchQuery.trim()}"
                    </button>
                  )}

                  {getUnassignedLabels().length === 0 && !shouldShowCreateOption() ? (
                    <div className="text-center py-4 text-slate-500">
                      <p className="text-xs">
                        {searchQuery ? 'No matching labels found' : 'All available labels are already assigned'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {getUnassignedLabels().map((label) => (
                        <button
                          key={label.id}
                          onClick={() => handleAssignLabel(label.id)}
                          disabled={isAssigning}
                          className="w-full flex items-center px-2 py-2 rounded hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mr-2"
                            style={{ backgroundColor: `${label.color}20`, color: label.color }}
                          >
                            <span className="mr-1">{label.icon}</span>
                            {label.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          
          {/* Click outside to close */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => {
              setShowLabelSelector(false);
              setShowCreateForm(false);
              setShowManageMode(false);
              setEditingLabel(null);
              setSearchQuery('');
            }}
          />
        </div>
      )}

      {/* Error Display */}
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      {/* Loading State */}
      {isAssigning && (
        <div className="flex items-center text-xs text-slate-500">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-notey-orange mr-2"></div>
          Updating labels...
        </div>
      )}
    </div>
  );
};
