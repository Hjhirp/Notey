-- Labels System Migration
-- This migration creates the labels and label_links tables for organizing content
-- Implements a Gmail-like labeling system with polymorphic relationships

-- Labels table - stores label definitions with visual properties
CREATE TABLE public.labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#8E8E93',
    icon TEXT DEFAULT 'tag',
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT labels_user_name_unique UNIQUE(user_id, name)
);

-- Label links table - polymorphic many-to-many relationships between labels and entities
CREATE TABLE public.label_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('audio_chunk', 'event', 'photo')),
    entity_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT label_links_unique_assignment UNIQUE(label_id, entity_type, entity_id)
);

-- Indexes for performance
CREATE INDEX idx_labels_user_id ON public.labels(user_id);
CREATE INDEX idx_labels_user_name ON public.labels(user_id, name);
CREATE INDEX idx_label_links_user_id ON public.label_links(user_id);
CREATE INDEX idx_label_links_label_id ON public.label_links(label_id);
CREATE INDEX idx_label_links_entity ON public.label_links(entity_type, entity_id);
CREATE INDEX idx_label_links_user_entity ON public.label_links(user_id, entity_type, entity_id);

-- Enable Row Level Security
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.label_links ENABLE ROW LEVEL SECURITY;

-- Labels RLS policies
CREATE POLICY "Users can view their own labels" ON public.labels
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own labels" ON public.labels
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own labels" ON public.labels
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own labels" ON public.labels
    FOR DELETE USING (user_id = auth.uid());

-- Label links RLS policies
CREATE POLICY "Users can view their own label links" ON public.label_links
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own label links" ON public.label_links
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own label links" ON public.label_links
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own label links" ON public.label_links
    FOR DELETE USING (user_id = auth.uid());

-- Additional validation function to ensure entity exists and belongs to user
CREATE OR REPLACE FUNCTION validate_label_link_entity()
RETURNS TRIGGER AS $$
BEGIN
    -- Validate that the entity exists and belongs to the user
    CASE NEW.entity_type
        WHEN 'audio_chunk' THEN
            IF NOT EXISTS (
                SELECT 1 FROM audio_chunks ac
                JOIN events e ON ac.event_id = e.id
                WHERE ac.id = NEW.entity_id AND e.user_id = NEW.user_id
            ) THEN
                RAISE EXCEPTION 'Audio chunk does not exist or does not belong to user';
            END IF;
        WHEN 'event' THEN
            IF NOT EXISTS (
                SELECT 1 FROM events
                WHERE id = NEW.entity_id AND user_id = NEW.user_id
            ) THEN
                RAISE EXCEPTION 'Event does not exist or does not belong to user';
            END IF;
        WHEN 'photo' THEN
            IF NOT EXISTS (
                SELECT 1 FROM photos p
                JOIN events e ON p.event_id = e.id
                WHERE p.id = NEW.entity_id AND e.user_id = NEW.user_id
            ) THEN
                RAISE EXCEPTION 'Photo does not exist or does not belong to user';
            END IF;
    END CASE;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate entity ownership on insert/update
CREATE TRIGGER validate_label_link_entity_trigger
    BEFORE INSERT OR UPDATE ON public.label_links
    FOR EACH ROW
    EXECUTE FUNCTION validate_label_link_entity();

-- Comments for documentation
COMMENT ON TABLE public.labels IS 'User-defined labels for organizing content with visual properties';
COMMENT ON TABLE public.label_links IS 'Polymorphic relationships between labels and entities (audio_chunks, events, photos)';
COMMENT ON COLUMN public.labels.color IS 'Hex color code for label display, defaults to #8E8E93';
COMMENT ON COLUMN public.labels.icon IS 'Icon identifier for label display, defaults to tag';
COMMENT ON COLUMN public.label_links.entity_type IS 'Type of entity being labeled: audio_chunk, event, or photo';
COMMENT ON COLUMN public.label_links.entity_id IS 'UUID of the entity being labeled';