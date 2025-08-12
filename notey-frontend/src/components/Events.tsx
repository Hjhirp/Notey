import React, { useEffect, useState, useMemo } from "react";
import type { Session } from "@supabase/supabase-js";
import config from "../config";
import { LabelFilter } from "./LabelFilter";
import { Label } from "../types/labels";
import { labelsApi } from "../lib/labelsApi";
import { EventExporter } from "../utils/eventExporter";

const BACKEND_URL = config.BACKEND_URL;

// Inline Label Picker Component
interface LabelPickerProps {
  eventId: string;
  availableLabels: Label[];
  currentLabels: Label[];
  onApply: (labelIds: string[]) => void;
  onClose: () => void;
  isLoading: boolean;
  error: string | null;
  creatingLabelFor: string | null;
  newLabel: { name: string; color: string; icon: string };
  onStartCreate: (eventId: string) => void;
  onCancelCreate: () => void;
  onSubmitCreate: (eventId: string) => void;
  onNewLabelChange: (updates: Partial<{ name: string; color: string; icon: string }>) => void;
  isCreatingLabel: boolean;
}

const PRESET_COLORS = ['#FF6A00', '#16a34a', '#2563eb', '#9333ea', '#ef4444', '#0ea5e9', '#f59e0b', '#10b981'];

const LabelPicker: React.FC<LabelPickerProps> = ({
  eventId,
  availableLabels,
  currentLabels,
  onApply,
  onClose,
  isLoading,
  error,
  creatingLabelFor,
  newLabel,
  onStartCreate,
  onCancelCreate,
  onSubmitCreate,
  onNewLabelChange,
  isCreatingLabel
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const currentLabelIds = currentLabels.map(l => l.id);
  
  // Filter out labels that are already assigned
  const unassignedLabels = availableLabels.filter(label => !currentLabelIds.includes(label.id));
  
  const handleToggle = (labelId: string) => {
    setSelectedIds(prev => 
      prev.includes(labelId) 
        ? prev.filter(id => id !== labelId)
        : [...prev, labelId]
    );
  };
  
  const handleApply = () => {
    onApply(selectedIds);
    setSelectedIds([]);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (creatingLabelFor === eventId) {
        onCancelCreate();
      } else {
        onClose();
      }
    }
  };

  const handleCreateKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newLabel.name.trim()) {
      e.preventDefault();
      onSubmitCreate(eventId);
    }
  };
  
  return (
    <div onKeyDown={handleKeyDown}>
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h5 className="text-sm font-medium">Add Labels</h5>
        <div className="flex items-center gap-2">
          {creatingLabelFor !== eventId && (
            <button
              onClick={() => onStartCreate(eventId)}
              className="text-xs text-orange-600 hover:text-orange-700 font-medium focus:outline-none focus:ring-1 focus:ring-orange-500 rounded px-1"
            >
              + Create Label
            </button>
          )}
          <button
            onClick={creatingLabelFor === eventId ? onCancelCreate : onClose}
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
      {creatingLabelFor === eventId && (
        <div className="mb-4 p-3 border border-slate-200 rounded-lg bg-white">
          <div className="space-y-3">
            {/* Name Input */}
            <div>
              <input
                type="text"
                value={newLabel.name}
                onChange={(e) => onNewLabelChange({ name: e.target.value.slice(0, 30) })}
                onKeyDown={handleCreateKeyDown}
                placeholder="Label name"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
                aria-label="Label name"
                maxLength={30}
                autoFocus
              />
              <div className="text-xs text-slate-500 mt-1">
                {newLabel.name.length}/30 characters
              </div>
            </div>

            {/* Color Swatches */}
            <div>
              <div className="text-xs text-slate-700 mb-2">Color</div>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => onNewLabelChange({ color })}
                    className={`w-6 h-6 rounded-full border-2 focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                      newLabel.color === color ? 'border-slate-400' : 'border-slate-200'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
                <input
                  type="text"
                  value={newLabel.color}
                  onChange={(e) => onNewLabelChange({ color: e.target.value })}
                  placeholder="#FF6A00"
                  className="w-20 px-2 py-1 text-xs border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
                  maxLength={7}
                />
              </div>
            </div>

            {/* Icon Input */}
            <div>
              <input
                type="text"
                value={newLabel.icon}
                onChange={(e) => onNewLabelChange({ icon: e.target.value.slice(0, 2) })}
                placeholder="🏷️ (optional)"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
                aria-label="Icon (optional emoji)"
                maxLength={2}
              />
            </div>

            {/* Create Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => onSubmitCreate(eventId)}
                disabled={!newLabel.name.trim() || isCreatingLabel}
                className="bg-orange-500 text-white px-3 py-1.5 rounded disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {isCreatingLabel ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={onCancelCreate}
                disabled={isCreatingLabel}
                className="border px-3 py-1.5 rounded text-slate-700 hover:bg-slate-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Label Selection (only show when not creating) */}
      {creatingLabelFor !== eventId && (
        <>
          {unassignedLabels.length === 0 ? (
            <p className="text-sm text-slate-500 mb-3">All available labels are already assigned</p>
          ) : (
            <div className="space-y-2 mb-3">
              {unassignedLabels.map((label) => (
                <label
                  key={label.id}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(label.id)}
                    onChange={() => handleToggle(label.id)}
                    className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                    style={{ backgroundColor: `${label.color}20`, color: label.color }}
                  >
                    <span className="mr-1">{label.icon}</span>
                    {label.name}
                  </span>
                </label>
              ))}
            </div>
          )}
          
          {/* Apply/Cancel Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleApply}
              disabled={selectedIds.length === 0 || isLoading}
              className="bg-orange-500 text-white px-3 py-1 rounded disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {isLoading ? 'Applying...' : `Apply (${selectedIds.length})`}
            </button>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="border px-3 py-1 rounded text-slate-700 hover:bg-slate-50 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
};

interface Event {
  id: string;
  title?: string;
  started_at: string;
  labels?: Label[];
}

interface EventsPageProps {
  session: Session | null;
  onSelectEvent: (id: string) => void;
  selectedEventId?: string | null;
  onEventDeleted?: (id: string) => void;
}

type SortOption = 'date-desc' | 'date-asc' | 'title-asc' | 'title-desc';

export default function Events({
  session,
  onSelectEvent,
  selectedEventId,
  onEventDeleted,
}: EventsPageProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<SortOption>('date-desc');
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [showBulkLabelAssigner, setShowBulkLabelAssigner] = useState(false);
  const [availableLabels, setAvailableLabels] = useState<Label[]>([]);
  const [openLabelFor, setOpenLabelFor] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [exportType, setExportType] = useState<'pdf' | 'google-docs' | null>(null);
  const [showExportPopup, setShowExportPopup] = useState<string | null>(null);
  const [creatingLabelFor, setCreatingLabelFor] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState({ name: "", color: "#FF6A00", icon: "" });
  const [pickerSelection, setPickerSelection] = useState<Record<string, Set<string>>>({});
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [isAttaching, setIsAttaching] = useState(false);
  const [isCreatingLabel, setIsCreatingLabel] = useState(false);

  // Filter and sort events based on selected labels, search query, and sort option
  const filteredAndSortedEvents = useMemo(() => {
    let filtered = events;
    
    // Filter by labels
    if (selectedLabels.length > 0) {
      filtered = filtered.filter(event => {
        if (!event.labels || event.labels.length === 0) {
          return false;
        }
        return event.labels.some(label => selectedLabels.includes(label.id));
      });
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(event => 
        (event.title || '').toLowerCase().includes(query)
      );
    }
    
    // Sort events
    filtered.sort((a, b) => {
      switch (sortOption) {
        case 'date-desc':
          return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
        case 'date-asc':
          return new Date(a.started_at).getTime() - new Date(b.started_at).getTime();
        case 'title-asc':
          return (a.title || '').localeCompare(b.title || '');
        case 'title-desc':
          return (b.title || '').localeCompare(a.title || '');
        default:
          return 0;
      }
    });
    
    return filtered;
  }, [events, selectedLabels, searchQuery, sortOption]);

  const toggleEventSelection = (eventId: string) => {
    setSelectedEventIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  const selectAllEvents = () => {
    const allEventIds = new Set(filteredAndSortedEvents.map(e => e.id));
    setSelectedEventIds(allEventIds);
  };

  const deselectAllEvents = () => {
    setSelectedEventIds(new Set());
  };

  const handleBulkLabelAssignment = async (labelIds: string[]) => {
    if (!session || selectedEventIds.size === 0 || labelIds.length === 0) return;
    
    try {
      await labelsApi.bulkAttachLabels({
        label_ids: labelIds,
        entity_type: 'event',
        entity_ids: Array.from(selectedEventIds)
      }, session);
      
      // Update events with new labels instead of reloading
      await refetchEvents();
      setSelectedEventIds(new Set());
      setShowBulkLabelAssigner(false);
    } catch (err) {
      console.error('Failed to assign labels to events:', err);
    }
  };

  const handleBulkDelete = async () => {
    if (!session || selectedEventIds.size === 0) return;
    
    if (!confirm(`Delete ${selectedEventIds.size} selected events? This cannot be undone.`)) return;
    
    try {
      for (const eventId of selectedEventIds) {
        await fetch(`${BACKEND_URL}/events/${eventId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      }
      
      setEvents(prev => prev.filter(event => !selectedEventIds.has(event.id)));
      
      // Clear selectedEventId if it was one of the deleted events
      if (selectedEventId && selectedEventIds.has(selectedEventId) && onEventDeleted) {
        onEventDeleted(selectedEventId);
      }
      
      setSelectedEventIds(new Set());
    } catch (err) {
      console.error('Failed to delete events:', err);
    }
  };

  const refetchEvents = async () => {
    if (!session) return;
    
    try {
      const token = session?.access_token;
      const res = await fetch(`${BACKEND_URL}/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch events');
      }
      
      const eventsData = await res.json();
      
      // Fetch labels for each event
      const eventsWithLabels = await Promise.all(
        eventsData.map(async (event: Event) => {
          try {
            const labelsRes = await fetch(`${BACKEND_URL}/events/${event.id}/labels`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            
            if (labelsRes.ok) {
              const labels = await labelsRes.json();
              // Remove duplicates based on label ID
              const uniqueLabels = labels.filter((label: any, index: number, array: any[]) => 
                array.findIndex((l: any) => l.id === label.id) === index
              );
              return { ...event, labels: uniqueLabels };
            }
          } catch (err) {
            console.warn(`Failed to fetch labels for event ${event.id}:`, err);
          }
          return { ...event, labels: [] };
        })
      );
      
      setEvents(eventsWithLabels);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events');
    }
  };

  // Load available labels
  useEffect(() => {
    const loadLabels = async () => {
      if (!session) return;
      try {
        const labels = await labelsApi.getLabels(session);
        setAvailableLabels(labels);
      } catch (err) {
        console.error('Failed to load labels:', err);
      }
    };
    loadLabels();
  }, [session]);

  useEffect(() => {
    const fetchEvents = async () => {
      if (!session) return;
      
      setIsLoading(true);
      setError(null);
      await refetchEvents();
      setIsLoading(false);
    };

    fetchEvents();
  }, [session]);

  // Listen for label deletion events to refresh events
  useEffect(() => {
    const handleLabelDeleted = (event: CustomEvent) => {
      const { labelId } = event.detail;
      
      // Remove the deleted label from all events in state
      setEvents(prevEvents => 
        prevEvents.map(event => ({
          ...event,
          labels: event.labels?.filter(label => label.id !== labelId) || []
        }))
      );
      
      // Also remove from available labels
      setAvailableLabels(prev => prev.filter(label => label.id !== labelId));
    };

    window.addEventListener('labelDeleted', handleLabelDeleted as EventListener);
    
    return () => {
      window.removeEventListener('labelDeleted', handleLabelDeleted as EventListener);
    };
  }, []);

  // Close export popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showExportPopup && !(event.target as Element).closest('.export-popup-container')) {
        setShowExportPopup(null);
      }
    };

    if (showExportPopup) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showExportPopup]);

  const deleteEvent = async (eventId: string) => {
    if (!session?.access_token) return;
    
    setDeletingId(eventId);
    try {
      const res = await fetch(`${BACKEND_URL}/events/${eventId}`, {
        method: 'DELETE',
        headers: { 
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Failed to delete event');
      }

      // Remove from local state
      setEvents(prev => prev.filter(event => event.id !== eventId));
      
      // Clear selection if this event was selected
      if (selectedEventId === eventId && onEventDeleted) {
        onEventDeleted(eventId);
      }
      
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete event');
      setError(err instanceof Error ? err.message : 'Failed to delete event');
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportToPDF = async (e: React.MouseEvent, eventId: string) => {
    e.stopPropagation();
    if (!session?.access_token) return;
    
    setExportingId(eventId);
    setExportType('pdf');
    
    try {
      // Fetch event details for export
      const eventData = await EventExporter.fetchEventDetails(eventId, session.access_token);
      
      // Export to PDF using existing report generator
      await EventExporter.exportEventToPDF(eventData);
      
    } catch (err) {
      console.error('Failed to export event to PDF:', err);
      setError(err instanceof Error ? err.message : 'Failed to export event to PDF');
    } finally {
      setExportingId(null);
      setExportType(null);
    }
  };

  const handleExportToGoogleDocs = async (e: React.MouseEvent, eventId: string) => {
    e.stopPropagation();
    if (!session?.access_token) return;
    
    setExportingId(eventId);
    setExportType('google-docs');
    
    try {
      const documentUrl = await EventExporter.exportEventToGoogleDocs(eventId, session.access_token);
      
      // Open the Google Doc in a new tab
      window.open(documentUrl, '_blank');
      
    } catch (err) {
      console.error('Failed to export event to Google Docs:', err);
      setError(err instanceof Error ? err.message : 'Failed to export event to Google Docs');
    } finally {
      setExportingId(null);
      setExportType(null);
    }
  };

  const handleExportClick = (e: React.MouseEvent, eventId: string) => {
    e.stopPropagation();
    setShowExportPopup(eventId);
  };

  const closeExportPopup = () => {
    setShowExportPopup(null);
  };

  const handleExportOption = async (eventId: string, exportType: 'pdf' | 'google-docs') => {
    setShowExportPopup(null);
    
    if (exportType === 'pdf') {
      await handleExportToPDF({ stopPropagation: () => {} } as React.MouseEvent, eventId);
    } else {
      await handleExportToGoogleDocs({ stopPropagation: () => {} } as React.MouseEvent, eventId);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, eventId: string) => {
    e.stopPropagation();
    setShowDeleteConfirm(eventId);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(null);
  };

  const updateEventLabels = (eventId: string, newLabels: Label[]) => {
    setEvents(prev => prev.map(e => 
      e.id === eventId ? { ...e, labels: newLabels } : e
    ));
  };

  const toggleLabelPicker = (eventId: string) => {
    setOpenLabelFor(current => {
      const newValue = current === eventId ? null : eventId;
      // Initialize picker selection for this event
      if (newValue === eventId) {
        setPickerSelection(prev => ({ ...prev, [eventId]: new Set() }));
      }
      return newValue;
    });
    setCreatingLabelFor(null);
    setInlineError(null);
  };

  const updateEventLabelsInState = (eventId: string, nextLabels: Label[]) => {
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, labels: nextLabels } : e));
  };

  const startCreate = (eventId: string) => {
    setCreatingLabelFor(eventId);
    setNewLabel({ name: "", color: "#FF6A00", icon: "" });
    setInlineError(null);
  };

  const cancelCreate = () => {
    setCreatingLabelFor(null);
    setNewLabel({ name: "", color: "#FF6A00", icon: "" });
    setInlineError(null);
  };

  const submitCreate = async (eventId: string) => {
    if (!newLabel.name.trim()) return;
    
    // Check for duplicates
    const nameExists = availableLabels.some(label => 
      label.name.toLowerCase() === newLabel.name.trim().toLowerCase()
    );
    
    if (nameExists) {
      setInlineError("A label with this name already exists.");
      return;
    }

    setIsCreatingLabel(true);
    setInlineError(null);

    try {
      // Create the new label
      const created = await labelsApi.createLabel({
        name: newLabel.name.trim(),
        color: newLabel.color,
        icon: newLabel.icon.trim() || ''
      }, session);

      // Update available labels in state
      setAvailableLabels(prev => [...prev, created]);

      // Get current event labels
      const currentEvent = events.find(e => e.id === eventId);
      const currentLabels = currentEvent?.labels || [];

      // Close create form and picker first (label creation was successful)
      setCreatingLabelFor(null);
      setOpenLabelFor(null);
      setNewLabel({ name: "", color: "#FF6A00", icon: "" });

      // Try to auto-apply: attach the new label to the event
      try {
        if (created && created.id) {
          await labelsApi.attachLabel(created.id, 'event', eventId, session);
          // Update event labels optimistically only if attachment succeeds
          updateEventLabelsInState(eventId, [...currentLabels, created]);
        } else {
          console.warn('Created label does not have a valid ID, skipping attachment');
        }
      } catch (attachError) {
        console.error('Failed to attach newly created label:', attachError);
        // Don't show error to user since label creation was successful
        // User can manually attach the label if needed
      }

    } catch (error) {
      setInlineError('Failed to create label. Please try again.');
      console.error('Failed to create label:', error);
    } finally {
      setIsCreatingLabel(false);
    }
  };

  const handleRemoveLabel = async (eventId: string, label: Label, currentLabels: Label[]) => {
    const previousLabels = currentLabels;
    // Optimistic update
    updateEventLabelsInState(eventId, previousLabels.filter(l => l.id !== label.id));
    
    try {
      await labelsApi.detachLabel(label.id, 'event', eventId, session);
    } catch (error) {
      // Revert on error
      updateEventLabelsInState(eventId, previousLabels);
      console.error('Failed to remove label:', error);
    }
  };

  const handleAttachLabels = async (eventId: string, labelIds: string[], currentLabels: Label[]) => {
    if (labelIds.length === 0) {
      setOpenLabelFor(null);
      return;
    }

    setIsAttaching(true);
    setInlineError(null);
    
    const labelsToAttach = availableLabels.filter(l => labelIds.includes(l.id));
    const newLabels = [...currentLabels, ...labelsToAttach];
    
    // Optimistic update
    updateEventLabelsInState(eventId, newLabels);
    
    try {
      await labelsApi.bulkAttachLabels({
        label_ids: labelIds,
        entity_type: 'event',
        entity_ids: [eventId]
      }, session);
      
      setOpenLabelFor(null);
    } catch (error) {
      // Revert on error
      updateEventLabelsInState(eventId, currentLabels);
      setInlineError('Failed to add labels. Please try again.');
      console.error('Failed to attach labels:', error);
    } finally {
      setIsAttaching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sticky Toolbar */}
      <div className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/70 -mx-4 px-4 py-3 border-y border-slate-200">
        <div className="flex flex-col gap-3">
          {/* Row 1: Search Field */}
          <div className="relative w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              aria-label="Search events"
            />
          </div>

          {/* Row 2: Filter and Sort */}
          <div className="flex gap-3">
            {/* Filter by Labels */}
            <div className="flex-1 md:flex-none w-full md:w-auto">
              <LabelFilter
                session={session}
                selectedLabels={selectedLabels}
                onLabelsChange={setSelectedLabels}
                className="w-full"
              />
            </div>

            {/* Sort */}
            <div className="flex-1 md:flex-none w-full md:w-auto">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="w-full h-10 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                aria-label="Sort events"
              >
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="title-asc">A–Z</option>
                <option value="title-desc">Z–A</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedEventIds.size > 0 && (
        <div className="sticky top-16 z-10 -mx-4 px-4 py-3 bg-orange-50 border-y border-orange-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-orange-900">
              {selectedEventIds.size} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBulkLabelAssigner(true)}
                className="px-3 py-1 text-xs bg-white text-orange-700 border border-orange-300 rounded-full hover:bg-orange-50 transition-colors"
                aria-label="Add labels to selected events"
              >
                Add Labels
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1 text-xs bg-white text-red-700 border border-red-300 rounded-full hover:bg-red-50 transition-colors"
                aria-label="Delete selected events"
              >
                Delete
              </button>
              <button
                onClick={deselectAllEvents}
                className="px-3 py-1 text-xs text-orange-700 hover:text-orange-800 transition-colors"
                aria-label="Clear selection"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Events List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-600 border-t-transparent mx-auto mb-4"></div>
            <p className="text-slate-600">Loading events...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">Something went wrong</h3>
            <p className="text-slate-600 mb-6">{error}</p>
            <button
              onClick={() => refetchEvents()}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : filteredAndSortedEvents.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-6">📝</div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">
              {searchQuery ? 'No events match your search' : selectedLabels.length > 0 ? 'No events match selected labels' : 'No events yet'}
            </h3>
            <p className="text-slate-600">
              {searchQuery ? 'Try adjusting your search terms' : selectedLabels.length > 0 ? 'Try selecting different labels or create new ones' : 'Start recording to see your events here'}
            </p>
          </div>
        ) : (
          <>
            <div className="text-sm text-slate-600 mb-4">
              Showing {filteredAndSortedEvents.length} of {events.length} event{events.length !== 1 ? 's' : ''}
              {(searchQuery || selectedLabels.length > 0) && (
                <span className="ml-2">
                  {searchQuery && `matching "${searchQuery}"`}
                  {searchQuery && selectedLabels.length > 0 && ' and '}
                  {selectedLabels.length > 0 && `with ${selectedLabels.length} selected label${selectedLabels.length !== 1 ? 's' : ''}`}
                </span>
              )}
            </div>

            <div className="space-y-3">
              {filteredAndSortedEvents.map((event) => (
                <div
                  key={event.id}
                  className={`rounded-2xl border bg-white shadow-sm transition-all duration-200 ${
                    selectedEventIds.has(event.id)
                      ? 'border-orange-400 bg-orange-50'
                      : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                  }`}
                >
                  <div className="p-4 md:p-5">
                    <div className="flex items-start gap-4">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={selectedEventIds.has(event.id)}
                        onChange={() => toggleEventSelection(event.id)}
                        className="h-4 w-4 mt-0.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                        aria-label={`Select ${event.title || 'Untitled Event'}`}
                      />

                      {/* Main Content */}
                      <div className="flex-1 min-w-0">
                        {/* Title and Timestamp */}
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex-1">
                            <button
                              onClick={() => onSelectEvent(event.id)}
                              className="text-left hover:text-orange-600 transition-colors focus:outline-none focus:text-orange-600"
                              aria-label={`Open ${event.title || 'Untitled Event'}`}
                            >
                              <h3 className="text-lg font-semibold text-slate-900 line-clamp-2">
                                {event.title || "Untitled Event"}
                              </h3>
                            </button>
                            <p className="text-xs text-slate-500 mt-1">
                              {new Date(event.started_at).toLocaleDateString('en-US', {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-1.5">
                            {/* Combined Export Button */}
                            <div className="relative export-popup-container">
                              <button
                                onClick={(e) => handleExportClick(e, event.id)}
                                disabled={exportingId === event.id}
                                className="h-8 w-8 rounded-full border border-slate-300 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600 flex items-center justify-center transition-colors disabled:opacity-50"
                                title="Export Event"
                                aria-label="Export event"
                              >
                                {exportingId === event.id ? (
                                  <div className="animate-spin w-4 h-4 border border-slate-400 border-t-transparent rounded-full"></div>
                                ) : (
                                  <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                )}
                              </button>

                              {/* Export Options Popup */}
                              {showExportPopup === event.id && (
                                <div className="absolute top-full right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 min-w-[160px]">
                                  <div className="py-1">
                                    <button
                                      onClick={() => handleExportOption(event.id, 'pdf')}
                                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-orange-50 hover:text-orange-600 flex items-center gap-2"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                      Export as PDF
                                    </button>
                                    <button
                                      onClick={() => handleExportOption(event.id, 'google-docs')}
                                      className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                      Export to Google Docs
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Delete Button */}
                            <button
                              onClick={(e) => handleDeleteClick(e, event.id)}
                              disabled={deletingId === event.id}
                              className="h-8 w-8 rounded-full border border-slate-300 hover:bg-red-50 hover:border-red-300 hover:text-red-600 flex items-center justify-center transition-colors disabled:opacity-50"
                              title="Delete event"
                              aria-label="Delete event"
                            >
                              {deletingId === event.id ? (
                                <div className="animate-spin w-4 h-4 border border-slate-400 border-t-transparent rounded-full"></div>
                              ) : (
                                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-slate-200 my-3"></div>

                        {/* Event Labels Row */}
                        <div>
                          <h4 className="text-sm font-medium text-slate-700 mb-2">Event Labels</h4>

                          {/* Inline chips + Add button */}
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            {(event.labels?.length ?? 0) > 0 ? (
                              event.labels!.map(label => (
                                <span
                                  key={label.id}
                                  className="group relative inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border"
                                  style={{ backgroundColor: `${label.color}15`, color: label.color, borderColor: `${label.color}30` }}
                                >
                                  <span>{label.icon === 'tag' ? '🏷️' : label.icon}</span>
                                  {label.name}
                                  <button
                                    aria-label={`Remove label ${label.name}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveLabel(event.id, label, event.labels!);
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

                            {/* Add Label pill — inline with chips */}
                            <button
                              onClick={() => toggleLabelPicker(event.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  toggleLabelPicker(event.id);
                                }
                              }}
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

                          {/* Inline picker below the row */}
                          {openLabelFor === event.id && (
                            <div className="mt-2 p-3 rounded-lg border border-slate-200 bg-slate-50">
                              <LabelPicker
                                eventId={event.id}
                                availableLabels={availableLabels}
                                currentLabels={event.labels || []}
                                onApply={(labelIds) => handleAttachLabels(event.id, labelIds, event.labels || [])}
                                onClose={() => setOpenLabelFor(null)}
                                isLoading={isAttaching}
                                error={inlineError}
                                creatingLabelFor={creatingLabelFor}
                                newLabel={newLabel}
                                onStartCreate={startCreate}
                                onCancelCreate={cancelCreate}
                                onSubmitCreate={submitCreate}
                                onNewLabelChange={(updates) => setNewLabel(prev => ({ ...prev, ...updates }))}
                                isCreatingLabel={isCreatingLabel}
                              />
                            </div>
                          )}
                        </div>

                      </div>
                    </div>
                  </div>

                  {/* Delete Confirmation Modal */}
                  {showDeleteConfirm === event.id && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleCancelDelete}>
                      <div className="bg-white rounded-2xl p-6 max-w-md mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="text-center">
                          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </div>
                          <h3 className="text-xl font-semibold text-slate-900 mb-2">Delete Event</h3>
                          <p className="text-slate-600 mb-6">
                            Are you sure you want to delete "{event.title || 'Untitled Event'}"? This action cannot be undone.
                          </p>
                          <div className="flex gap-3">
                            <button
                              onClick={handleCancelDelete}
                              className="flex-1 px-4 py-2 text-slate-700 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors font-medium"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => deleteEvent(event.id)}
                              disabled={deletingId === event.id}
                              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 font-medium flex items-center justify-center"
                            >
                              {deletingId === event.id ? (
                                <>
                                  <div className="animate-spin w-4 h-4 border border-white border-t-transparent rounded-full mr-2"></div>
                                  Deleting...
                                </>
                              ) : (
                                'Delete'
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Bulk Label Assignment Modal */}
      {showBulkLabelAssigner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h3 className="text-lg font-semibold text-slate-900">Add Labels</h3>
              <button
                onClick={() => setShowBulkLabelAssigner(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <LabelFilter
                session={session}
                selectedLabels={[]}
                onLabelsChange={(labelIds) => handleBulkLabelAssignment(labelIds)}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}