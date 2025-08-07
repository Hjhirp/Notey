# Implementation Plan

- [x] 1. Backend Database and API Foundation
  - Create database schema for photos table if not exists
  - Implement photo upload endpoint with file validation and storage
  - Enhance event details endpoint to include photo data
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

- [x] 2. Backend Photo Upload Implementation
  - Implement POST /events/{event_id}/photo endpoint in routes.py
  - Add photo upload validation (file type, size, event permissions)
  - Integrate with existing Supabase storage service for photo uploads
  - Create database record creation for photo metadata
  - Add comprehensive error handling and HTTP status codes
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.8_

- [x] 3. Backend Photo Retrieval Enhancement
  - Modify GET /events/{event_id} endpoint to include photos
  - Implement photo sorting by offset_seconds in database query
  - Update database.py get_event_details function for photo integration
  - Ensure photos are returned with correct timeline ordering
  - _Requirements: 4.6, 4.7, 6.1_

- [x] 4. Frontend Photo Upload Component Enhancement
  - Enhance PhotoButton component with actual file capture functionality
  - Implement file picker integration for photo selection
  - Add photo upload logic with FormData and fetch API
  - Implement upload progress indication and error handling
  - Add client-side file validation (type, size)
  - _Requirements: 1.1, 1.2, 1.3, 5.1, 5.2, 5.3, 5.5_

- [x] 5. Frontend Recording View Photo Integration
  - Integrate enhanced PhotoButton into Recorder component
  - Implement photo thumbnail preview display during recording
  - Add photo upload state management and success feedback
  - Handle multiple photo uploads and thumbnail grid layout
  - Implement proper error handling and user feedback
  - _Requirements: 1.4, 1.5, 5.1, 5.2, 5.3, 5.4_

- [x] 6. Frontend PhotoTimelinePlayer Component Creation
  - Create new PhotoTimelinePlayer component with timeline synchronization
  - Implement audio currentTime monitoring with 500ms interval
  - Add photo display logic based on offset_seconds timing
  - Implement shown photos tracking to prevent duplicates
  - Add seek handling to reset photo visibility state
  - _Requirements: 3.2, 3.3, 3.4, 3.7, 6.2, 6.3, 6.4, 6.7_

- [x] 7. Frontend Replay View Timeline Integration
  - Integrate PhotoTimelinePlayer component into Replay component
  - Pass audio reference and playback state to PhotoTimelinePlayer
  - Implement photo loading and preparation for timeline sync
  - Add proper component lifecycle management for audio monitoring
  - Handle audio pause/play state changes for photo display
  - _Requirements: 3.1, 3.5, 3.6, 6.1, 6.5, 6.6_

- [x] 8. Frontend Photo Display and UI Enhancement
  - Implement responsive photo display layout in PhotoTimelinePlayer
  - Add photo loading states and error handling for broken images
  - Implement proper photo sizing and aspect ratio handling
  - Add photo metadata display (timing information)
  - Ensure mobile-friendly touch interactions and responsive design
  - _Requirements: 3.4, 3.6, 5.4_

- [x] 9. Integration Testing and Error Handling
  - Test complete photo upload workflow from recording to storage
  - Test timeline synchronization accuracy during audio playback
  - Implement comprehensive error handling for network failures
  - Test photo display with various file formats and sizes
  - Verify proper cleanup and state management during component unmounting
  - _Requirements: 5.1, 5.2, 5.3, 6.2, 6.3, 6.4_

- [x] 10. Performance Optimization and Polish
  - Optimize photo loading and caching for better performance
  - Implement lazy loading for photos not yet reached in timeline
  - Add loading indicators and smooth transitions for photo appearance
  - Optimize timeline monitoring performance and memory usage
  - Test and optimize for mobile devices and slower networks
  - _Requirements: 3.2, 3.3, 3.4, 5.1, 6.7_