-- Concept Graph Migration
-- This migration adds tables for storing concepts and their relationships

-- Create concepts table
CREATE TABLE IF NOT EXISTS concepts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create chunk_concepts junction table
CREATE TABLE IF NOT EXISTS chunk_concepts (
    chunk_id UUID REFERENCES audio_chunks(id) ON DELETE CASCADE,
    concept_id UUID REFERENCES concepts(id) ON DELETE CASCADE,
    score REAL DEFAULT 1.0,
    from_sec REAL,
    to_sec REAL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (chunk_id, concept_id)
);

-- Create concept_relations table for concept-to-concept relationships
CREATE TABLE IF NOT EXISTS concept_relations (
    src UUID REFERENCES concepts(id) ON DELETE CASCADE,
    dst UUID REFERENCES concepts(id) ON DELETE CASCADE,
    score REAL DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (src, dst)
);

-- Add missing columns to audio_chunks if they don't exist
ALTER TABLE audio_chunks 
ADD COLUMN IF NOT EXISTS transcript TEXT,
ADD COLUMN IF NOT EXISTS summary TEXT,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_concepts_name ON concepts(name);
CREATE INDEX IF NOT EXISTS idx_chunk_concepts_chunk_id ON chunk_concepts(chunk_id);
CREATE INDEX IF NOT EXISTS idx_chunk_concepts_concept_id ON chunk_concepts(concept_id);
CREATE INDEX IF NOT EXISTS idx_chunk_concepts_score ON chunk_concepts(score DESC);
CREATE INDEX IF NOT EXISTS idx_concept_relations_src ON concept_relations(src);
CREATE INDEX IF NOT EXISTS idx_concept_relations_dst ON concept_relations(dst);
CREATE INDEX IF NOT EXISTS idx_concept_relations_score ON concept_relations(score DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunk_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_relations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for concepts
-- Users can only see concepts related to their own events
CREATE POLICY "Users can view their own concepts" ON concepts
    FOR SELECT USING (
        id IN (
            SELECT DISTINCT cc.concept_id 
            FROM chunk_concepts cc
            JOIN audio_chunks ac ON cc.chunk_id = ac.id
            JOIN events e ON ac.event_id = e.id
            WHERE e.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert concepts" ON concepts
    FOR INSERT WITH CHECK (true);

-- RLS Policies for chunk_concepts
CREATE POLICY "Users can view their own chunk_concepts" ON chunk_concepts
    FOR SELECT USING (
        chunk_id IN (
            SELECT ac.id 
            FROM audio_chunks ac
            JOIN events e ON ac.event_id = e.id
            WHERE e.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own chunk_concepts" ON chunk_concepts
    FOR INSERT WITH CHECK (
        chunk_id IN (
            SELECT ac.id 
            FROM audio_chunks ac
            JOIN events e ON ac.event_id = e.id
            WHERE e.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own chunk_concepts" ON chunk_concepts
    FOR UPDATE USING (
        chunk_id IN (
            SELECT ac.id 
            FROM audio_chunks ac
            JOIN events e ON ac.event_id = e.id
            WHERE e.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own chunk_concepts" ON chunk_concepts
    FOR DELETE USING (
        chunk_id IN (
            SELECT ac.id 
            FROM audio_chunks ac
            JOIN events e ON ac.event_id = e.id
            WHERE e.user_id = auth.uid()
        )
    );

-- RLS Policies for concept_relations
CREATE POLICY "Users can view their own concept_relations" ON concept_relations
    FOR SELECT USING (
        src IN (
            SELECT DISTINCT cc.concept_id 
            FROM chunk_concepts cc
            JOIN audio_chunks ac ON cc.chunk_id = ac.id
            JOIN events e ON ac.event_id = e.id
            WHERE e.user_id = auth.uid()
        )
        OR dst IN (
            SELECT DISTINCT cc.concept_id 
            FROM chunk_concepts cc
            JOIN audio_chunks ac ON cc.chunk_id = ac.id
            JOIN events e ON ac.event_id = e.id
            WHERE e.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert concept_relations for their concepts" ON concept_relations
    FOR INSERT WITH CHECK (
        src IN (
            SELECT DISTINCT cc.concept_id 
            FROM chunk_concepts cc
            JOIN audio_chunks ac ON cc.chunk_id = ac.id
            JOIN events e ON ac.event_id = e.id
            WHERE e.user_id = auth.uid()
        )
        AND dst IN (
            SELECT DISTINCT cc.concept_id 
            FROM chunk_concepts cc
            JOIN audio_chunks ac ON cc.chunk_id = ac.id
            JOIN events e ON ac.event_id = e.id
            WHERE e.user_id = auth.uid()
        )
    );