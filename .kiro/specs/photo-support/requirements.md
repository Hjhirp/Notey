# Requirements Document

## Introduction

The Photo Support MVP feature enables users to attach photos to their recording events, providing visual context to their audio recordings and transcripts. This feature allows users to capture and associate images with specific events, enhancing the overall note-taking experience by combining audio, text, and visual elements.

## Requirements

### Requirement 1

**User Story:** As a user recording an event, I want to attach photos to my recording session, so that I can provide visual context and enhance my notes with relevant images.

#### Acceptance Criteria

1. WHEN a user is in the recording view THEN the system SHALL display a "📸 Attach Photo" button
2. WHEN a user clicks the attach photo button THEN the system SHALL open a file picker for image selection
3. WHEN a user selects an image file THEN the system SHALL upload the photo to the backend storage
4. WHEN a photo is successfully uploaded THEN the system SHALL display a thumbnail preview under the current event
5. WHEN multiple photos are attached THEN the system SHALL display all thumbnails in a grid layout

### Requirement 2

**User Story:** As a user, I want my photos to be securely stored and associated with the correct event with timeline information, so that I can retrieve them later and see them synchronized with the audio playback.

#### Acceptance Criteria

1. WHEN a photo is uploaded THEN the system SHALL store the image file in Supabase Storage under the path photos/{event_id}/filename.png
2. WHEN a photo is uploaded THEN the system SHALL create a metadata record in the photos table with id, event_id, photo_url, offset_seconds, and created_at fields
3. WHEN storing photo metadata THEN the system SHALL generate a unique UUID for the photo id
4. WHEN storing photo metadata THEN the system SHALL associate the photo with the correct event_id as a foreign key
5. WHEN a photo is uploaded during recording THEN the system SHALL capture the current recording time as offset_seconds
6. WHEN a photo is uploaded THEN the system SHALL store the Supabase Storage URL as photo_url

### Requirement 3

**User Story:** As a user viewing event replay, I want to see photos synchronized with the audio timeline, so that I can see the visual context at the exact moment it was captured during recording.

#### Acceptance Criteria

1. WHEN a user views the replay/event details page THEN the system SHALL fetch all photos associated with that event sorted by offset_seconds
2. WHEN audio playback is active THEN the system SHALL monitor the current playback time every 500ms
3. WHEN the audio playback time reaches a photo's offset_seconds THEN the system SHALL display that photo
4. WHEN a photo is displayed during playback THEN the system SHALL show it in a designated photo display area
5. WHEN multiple photos have been reached during playback THEN the system SHALL keep all reached photos visible
6. WHEN photos are displayed THEN the system SHALL show them in timeline order based on offset_seconds
7. WHEN the user seeks to a different time in the audio THEN the system SHALL update the visible photos to match the current timeline position

### Requirement 4

**User Story:** As a developer, I want a robust backend API for photo management with timeline support, so that the frontend can reliably upload and retrieve photos with accurate timing information.

#### Acceptance Criteria

1. WHEN the backend receives a POST request to /upload-photo THEN the system SHALL accept event_id, file, and offset_seconds parameters
2. WHEN processing a photo upload THEN the system SHALL validate that the event_id exists and the user has permission to add photos to it
3. WHEN processing a photo upload THEN the system SHALL validate that the uploaded file is a valid image format
4. WHEN processing a photo upload THEN the system SHALL upload the file to Supabase Storage and generate a photo_url
5. WHEN a photo upload is successful THEN the system SHALL return JSON with event_id, offset_seconds, and photo_url
6. WHEN the backend receives a GET request to /events/:event_id/photos THEN the system SHALL return all photos for that event ordered by offset_seconds ASC
7. WHEN returning photo data THEN the system SHALL include offset_seconds and photo_url fields
8. WHEN an error occurs during upload THEN the system SHALL return appropriate HTTP status codes and error messages

### Requirement 5

**User Story:** As a user, I want the photo upload process to be intuitive and provide clear feedback, so that I know when my photos are successfully attached.

#### Acceptance Criteria

1. WHEN a photo is being uploaded THEN the system SHALL display a loading indicator
2. WHEN a photo upload is successful THEN the system SHALL show a success message or visual confirmation
3. WHEN a photo upload fails THEN the system SHALL display an error message explaining the issue
4. WHEN viewing photo thumbnails THEN the system SHALL provide visual feedback on hover or interaction
5. WHEN the photo upload is in progress THEN the system SHALL disable the upload button to prevent duplicate uploads
##
# Requirement 6

**User Story:** As a user, I want photos to appear automatically during audio replay at the exact moment they were taken, so that I can experience the recording with synchronized visual context.

#### Acceptance Criteria

1. WHEN the replay page loads THEN the system SHALL fetch all photos for the event and prepare them for timeline synchronization
2. WHEN audio playback starts THEN the system SHALL begin monitoring the audio currentTime property
3. WHEN the audio currentTime reaches or exceeds a photo's offset_seconds THEN the system SHALL display that photo if not already shown
4. WHEN displaying a timeline-synchronized photo THEN the system SHALL add it to a "shown" set to prevent duplicate displays
5. WHEN the user seeks backward in the audio THEN the system SHALL reset the shown photos and re-evaluate which photos should be visible
6. WHEN the user pauses audio playback THEN the system SHALL maintain the current photo display state
7. WHEN the monitoring interval runs THEN the system SHALL check every 500ms for new photos to display based on current playback time