-- Drop existing table if it exists
DROP TABLE IF EXISTS public.glossaries;

-- Create new glossaries table
CREATE TABLE public.glossaries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    series_id UUID NOT NULL REFERENCES public.series(id) ON DELETE CASCADE,
    source_term TEXT NOT NULL,
    translated_term TEXT NOT NULL,
    gender TEXT,
    role TEXT,
    alias TEXT,
    auto_suggested BOOLEAN DEFAULT false,
    source_context TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Create indexes
CREATE INDEX glossaries_series_id_idx ON public.glossaries(series_id);
CREATE INDEX glossaries_source_term_idx ON public.glossaries(source_term);

-- Enable RLS
ALTER TABLE public.glossaries ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for all users" ON public.glossaries
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.glossaries
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON public.glossaries
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.glossaries
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- Create function to update series glossary JSON
CREATE OR REPLACE FUNCTION public.update_series_glossary_json(series_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.series
    SET glossary_json = (
        SELECT jsonb_object_agg(
            source_term,
            jsonb_build_object(
                'translation', translated_term,
                'gender', gender,
                'role', role,
                'alias', alias
            )
        )
        FROM public.glossaries
        WHERE public.glossaries.series_id = update_series_glossary_json.series_id
    )
    WHERE id = series_id;
END;
$$ LANGUAGE plpgsql;

-- Example usage
SELECT public.update_series_glossary_json('your-series-id'); 