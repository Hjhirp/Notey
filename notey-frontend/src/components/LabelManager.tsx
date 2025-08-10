import React, { useState, useEffect } from 'react';
import { Label, LabelCreateRequest, LabelUpdateRequest } from '../types/labels';
import { labelsApi } from '../lib/labelsApi';
import { ColorPicker } from './ColorPicker';
import { IconSelector } from './IconSelector';
import { LabelChip } from './LabelChip';

interface LabelManagerProps {
  session?: any;
  onLabelsChange?: () => void;
  className?: string;
}

export const LabelManager: React.FC<LabelManagerProps> = ({
  session,
  onLabelsChange,
  className = '',
}) => {
  const [labels, setLabels] = useState<Label[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingLabel, setEditingLabel] = useState<Label | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    loadLabels();
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
      onLabelsChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create label');
    }
  };

  const handleUpdateLabel = async () => {
    if (!editingLabel || !editForm.name?.trim()) return;

    try {
      setError(null);
      const updatedLabel = await labelsApi.updateLabel(editingLabel.id, editForm, session);
      setLabels(labels.map(label => label.id === editingLabel.id ? updatedLabel : label));
      setEditingLabel(null);
      setEditForm({ name: '', color: '#8E8E93', icon: 'tag' });
      onLabelsChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update label');
    }
  };

  const handleDeleteLabel = async (labelId: string) => {
    if (!confirm('Are you sure you want to delete this label? This action cannot be undone.')) {
      return;
    }

    try {
      setError(null);
      await labelsApi.deleteLabel(labelId, session);
      setLabels(labels.filter(label => label.id !== labelId));
      onLabelsChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete label');
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

  if (isLoading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-8 bg-gray-200 rounded mb-4"></div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-6 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Labels</h3>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {isCreating ? 'Cancel' : 'Add Label'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Create Label Form */}
      {isCreating && (
        <div className="p-4 border border-gray-200 rounded-md bg-gray-50">
          <h4 className="text-md font-medium text-gray-900 mb-3">Create New Label</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Label Name
              </label>
              <input
                type="text"
                value={newLabel.name}
                onChange={(e) => setNewLabel({ ...newLabel, name: e.target.value })}
                placeholder="Enter label name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Color
                </label>
                <ColorPicker
                  selectedColor={newLabel.color || '#8E8E93'}
                  onColorChange={(color) => setNewLabel({ ...newLabel, color })}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Icon
                </label>
                <IconSelector
                  selectedIcon={newLabel.icon || 'tag'}
                  onIconChange={(icon) => setNewLabel({ ...newLabel, icon })}
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleCreateLabel}
                disabled={!newLabel.name.trim()}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                Create Label
              </button>
              <button
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Labels List */}
      <div className="space-y-2">
        {labels.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No labels created yet. Create your first label to get started.</p>
        ) : (
          labels.map((label) => (
            <div key={label.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-md hover:bg-gray-50">
              {editingLabel?.id === label.id ? (
                <div className="flex-1 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Label Name
                    </label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Color
                      </label>
                      <ColorPicker
                        selectedColor={editForm.color || '#8E8E93'}
                        onColorChange={(color) => setEditForm({ ...editForm, color })}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Icon
                      </label>
                      <IconSelector
                        selectedIcon={editForm.icon || 'tag'}
                        onIconChange={(icon) => setEditForm({ ...editForm, icon })}
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                                         <button
                       onClick={handleUpdateLabel}
                       disabled={!editForm.name?.trim()}
                       className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                     >
                      Save
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="px-3 py-1 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <LabelChip label={label} size="medium" />
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEditing(label)}
                      className="px-3 py-1 text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded"
                    >
                      <i className="fas fa-edit" />
                    </button>
                    <button
                      onClick={() => handleDeleteLabel(label.id)}
                      className="px-3 py-1 text-red-600 hover:text-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded"
                    >
                      <i className="fas fa-trash" />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
