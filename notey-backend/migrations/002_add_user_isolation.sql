-- Add User Isolation Migration
-- This migration adds user_id columns to concepts and chunk_concepts tables
-- for more efficient user-based filtering and better data isolation

-- Add user_id column to concepts table
ALTER TABLE concepts 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id column to chunk_concepts table
ALTER TABLE chunk_concepts 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update existing chunk_concepts to have user_id based on their chunk relationships
UPDATE chunk_concepts 
SET user_id = (
    SELECT e.user_id 
    FROM audio_chunks ac
    JOIN events e ON ac.event_id = e.id
    WHERE ac.id = chunk_concepts.chunk_id
)
WHERE user_id IS NULL;

-- Update existing concepts to have user_id based on their chunk relationships
UPDATE concepts 
SET user_id = (
    SELECT DISTINCT e.user_id 
    FROM chunk_concepts cc
    JOIN audio_chunks ac ON cc.chunk_id = ac.id
    JOIN events e ON ac.event_id = e.id
    WHERE cc.concept_id = concepts.id
    LIMIT 1
)
WHERE user_id IS NULL 
AND EXISTS (
    SELECT 1 FROM chunk_concepts cc 
    WHERE cc.concept_id = concepts.id
);

-- Delete orphaned concepts that have no chunk relationships
-- These concepts are not useful without any associated content
DELETE FROM concepts 
WHERE user_id IS NULL;

-- Create indexes for efficient filtering by user_id
CREATE INDEX IF NOT EXISTS idx_concepts_user_id ON concepts(user_id);
CREATE INDEX IF NOT EXISTS idx_chunk_concepts_user_id ON chunk_concepts(user_id);

-- Make user_id NOT NULL after cleaning and populating existing data
ALTER TABLE concepts ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE chunk_concepts ALTER COLUMN user_id SET NOT NULL;

-- Update RLS policies to use direct user_id comparison for better performance

-- Drop existing concepts policies
DROP POLICY IF EXISTS "Users can view their own concepts" ON concepts;
DROP POLICY IF EXISTS "Users can insert concepts" ON concepts;

-- Create new simplified concepts policies
CREATE POLICY "Users can view their own concepts" ON concepts
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own concepts" ON concepts
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own concepts" ON concepts
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own concepts" ON concepts
    FOR DELETE USING (user_id = auth.uid());

-- Drop existing chunk_concepts policies
DROP POLICY IF EXISTS "Users can view their own chunk_concepts" ON chunk_concepts;
DROP POLICY IF EXISTS "Users can insert their own chunk_concepts" ON chunk_concepts;
DROP POLICY IF EXISTS "Users can update their own chunk_concepts" ON chunk_concepts;
DROP POLICY IF EXISTS "Users can delete their own chunk_concepts" ON chunk_concepts;

-- Create new simplified chunk_concepts policies
CREATE POLICY "Users can view their own chunk_concepts" ON chunk_concepts
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own chunk_concepts" ON chunk_concepts
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own chunk_concepts" ON chunk_concepts
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own chunk_concepts" ON chunk_concepts
    FOR DELETE USING (user_id = auth.uid());

-- Update concept_relations policies to use direct user_id lookup
DROP POLICY IF EXISTS "Users can view their own concept_relations" ON concept_relations;
DROP POLICY IF EXISTS "Users can insert concept_relations for their concepts" ON concept_relations;

CREATE POLICY "Users can view their own concept_relations" ON concept_relations
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM concepts WHERE id = src AND user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM concepts WHERE id = dst AND user_id = auth.uid())
    );

CREATE POLICY "Users can insert concept_relations for their concepts" ON concept_relations
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM concepts WHERE id = src AND user_id = auth.uid())
        AND EXISTS (SELECT 1 FROM concepts WHERE id = dst AND user_id = auth.uid())
    );

CREATE POLICY "Users can update concept_relations for their concepts" ON concept_relations
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM concepts WHERE id = src AND user_id = auth.uid())
        AND EXISTS (SELECT 1 FROM concepts WHERE id = dst AND user_id = auth.uid())
    );

CREATE POLICY "Users can delete concept_relations for their concepts" ON concept_relations
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM concepts WHERE id = src AND user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM concepts WHERE id = dst AND user_id = auth.uid())
    );