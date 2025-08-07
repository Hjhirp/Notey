# Database Schema Documentation

## Photos Table

The `photos` table stores metadata for photos associated with recording events.

### Schema

```sql
CREATE TABLE photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    offset_seconds DECIMAL(10,3) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient querying by event and timeline order
CREATE INDEX idx_photos_event_offset ON photos(event_id, offset_seconds);
```

### Fields

- `id`: Unique identifier for the photo record (UUID)
- `event_id`: Foreign key reference to the events table
- `photo_url`: Supabase Storage URL for the photo file
- `offset_seconds`: Timeline position when photo was taken (decimal seconds)
- `created_at`: Timestamp when the record was created

### Notes

- Photos are stored in Supabase Storage under the path: `photos/{event_id}/{timestamp_ms}_{offset_ms}_{filename}`
- The `offset_seconds` field supports decimal precision for sub-second accuracy
- Photos are automatically ordered by `offset_seconds` when retrieved for timeline synchronization
- Cascade delete ensures photos are removed when parent event is deleted