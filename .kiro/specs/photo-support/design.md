# Design Document

## Overview

The Photo Support MVP feature integrates photo capture and timeline synchronization into the existing Notey application. The design leverages the current FastAPI backend architecture and React frontend, extending the existing event-based recording system to support visual content with precise timing information.

The feature enables users to capture photos during recording sessions and automatically synchronize them with audio playback during replay, creating a rich multimedia note-taking experience.

## Architecture

### System Components

The photo support feature integrates with the existing three-tier architecture:

1. **Frontend (React/TypeScript)**: Enhanced recording and replay components with photo capture and timeline synchronization
2. **Backend (FastAPI/Python)**: New photo upload endpoint and enhanced event retrieval with photo data
3. **Storage (Supabase)**: Photo file storage and metadata persistence

### Data Flow

```
Recording Flow:
User clicks photo button → Frontend captures timing → File upload to backend → 
Supabase Storage + Database record → Success response

Replay Flow:
Load event → Fetch photos with timing → Monitor audio playback → 
Display photos at correct timeline positions
```

## Components and Interfaces

### Backend Components

#### Photo Upload Endpoint
- **Route**: `POST /events/{event_id}/photo`
- **Purpose**: Handle photo file uploads with timing metadata
- **Integration**: Extends existing `/events/{event_id}/audio` pattern

#### Enhanced Event Retrieval
- **Route**: `GET /events/{event_id}`
- **Enhancement**: Include photo data in existing event details response
- **Sorting**: Photos ordered by `offset_seconds` for timeline synchronization

#### Database Integration
- **Table**: `photos` (assumed to exist based on current code)
- **Fields**: `id`, `event_id`, `photo_url`, `offset_seconds`, `created_at`
- **Relationships**: Foreign key to `events` table

### Frontend Components

#### Enhanced PhotoButton Component
- **Current State**: Stub implementation that logs timing
- **Enhancement**: Actual file capture and upload functionality
- **Integration**: Maintains existing interface with `Recorder` component

#### Enhanced Recorder Component
- **Current State**: Manages audio recording and photo timing collection
- **Enhancement**: Real photo upload during recording session
- **State Management**: Track uploaded photos and display thumbnails

#### Enhanced Replay Component
- **Current State**: Displays photos in static gallery
- **Enhancement**: Integrate `PhotoTimelinePlayer` component for synchronized display
- **Responsibility**: Manage overall event display and pass audio timing to photo player

#### PhotoTimelinePlayer Component (New)
- **Purpose**: Dedicated component for timeline-synchronized photo display
- **Props**: `photos[]`, `audioRef`, `isPlaying`
- **State Management**: Track shown photos and current timeline position
- **Timing Logic**: Monitor `audio.currentTime` and show photos at correct moments
- **Reusability**: Can be used in other audio-photo synchronization contexts

## Data Models

### Photo Record Schema
```typescript
interface Photo {
  id: string;           // UUID
  event_id: string;     // Foreign key to events
  photo_url: string;    // Supabase Storage URL
  offset_seconds: number; // Timeline position
  created_at: string;   // ISO timestamp
}
```

### PhotoTimelinePlayer Props
```typescript
interface PhotoTimelinePlayerProps {
  photos: Photo[];      // Photos sorted by offset_seconds
  audioRef: RefObject<HTMLAudioElement>; // Reference to audio element
  isPlaying: boolean;   // Audio playback state
  className?: string;   // Optional styling
}
```

### API Request/Response Models

#### Upload Request
```typescript
// FormData
{
  event_id: string;     // Path parameter
  offset: number;       // Form field (seconds)
  file: File;          // Image file
}
```

#### Upload Response
```typescript
{
  status: "photo uploaded";
  photo_url: string;
  event_id: string;
  offset_seconds: number;
}
```

#### Event Details Response (Enhanced)
```typescript
{
  audio_url?: string;
  transcript: string;
  summary: string;
  photos: Photo[];      // Sorted by offset_seconds
}
```

## Error Handling

### Backend Error Scenarios
1. **Invalid Event ID**: Return 404 with descriptive message
2. **File Upload Failure**: Return 500 with Supabase error details
3. **Invalid File Format**: Return 400 with format requirements
4. **Database Write Failure**: Return 500 with database error
5. **Missing Parameters**: Return 422 with validation details

### Frontend Error Scenarios
1. **Upload Failure**: Display error message, allow retry
2. **Network Issues**: Show connection error, queue for retry
3. **File Size Limits**: Validate before upload, show size requirements
4. **Timeline Sync Issues**: Graceful degradation to static photo display

### Error Recovery Strategies
- **Retry Logic**: Automatic retry for network failures
- **Graceful Degradation**: Show photos without timeline sync if audio fails
- **User Feedback**: Clear error messages with actionable guidance

## Testing Strategy

### Backend Testing
1. **Unit Tests**: Photo upload logic, database operations, file validation
2. **Integration Tests**: End-to-end photo upload and retrieval workflows
3. **Error Testing**: Invalid inputs, storage failures, database errors

### Frontend Testing
1. **Component Tests**: PhotoButton upload, Recorder integration, Replay synchronization
2. **Timeline Tests**: Audio playback synchronization accuracy
3. **User Interaction Tests**: Photo capture during recording, replay navigation

### Performance Testing
1. **File Upload**: Large image handling, concurrent uploads
2. **Timeline Sync**: Audio playback performance with multiple photos
3. **Storage**: Supabase Storage performance under load

## Implementation Considerations

### File Handling
- **Supported Formats**: JPEG, PNG, WebP (common mobile formats)
- **Size Limits**: 10MB per photo (reasonable for mobile captures)
- **Compression**: Client-side compression for large images
- **Naming Convention**: `{event_id}/{timestamp_ms}_{original_filename}`

### Timeline Synchronization
- **Polling Interval**: 500ms for smooth synchronization without performance impact
- **Accuracy**: Sub-second precision using `offset_seconds` with decimal values
- **State Management**: Track shown photos to prevent duplicates
- **Seek Handling**: Reset photo visibility when user seeks in audio

### Storage Organization
- **Bucket Structure**: `photos/{event_id}/` for logical organization
- **URL Generation**: Consistent with existing audio storage patterns
- **Cleanup**: Consider future cleanup strategy for deleted events

### Security Considerations
- **File Validation**: Server-side file type and size validation
- **Access Control**: Inherit existing event-based permissions
- **Storage Security**: Leverage Supabase Storage security policies
- **Input Sanitization**: Validate all user inputs including filenames

### Performance Optimizations
- **Lazy Loading**: Load photos only when needed for replay
- **Thumbnail Generation**: Consider generating thumbnails for gallery view
- **Caching**: Browser caching for frequently accessed photos
- **Progressive Loading**: Show photos as they load during timeline sync

### Mobile Considerations
- **Touch Interfaces**: Ensure photo button is touch-friendly (48px minimum)
- **Camera Integration**: Support both camera capture and gallery selection
- **Network Handling**: Handle poor network conditions gracefully
- **Storage Efficiency**: Optimize for mobile data usage