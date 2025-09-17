-- Create required extension for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create family_photos table
CREATE TABLE IF NOT EXISTS public.family_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  caption TEXT,
  uploaded_by TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  alt TEXT,
  likes INTEGER NOT NULL DEFAULT 0
);

-- Create photo_comments table
CREATE TABLE IF NOT EXISTS public.photo_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES public.family_photos(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_photo_comments_photo_id ON public.photo_comments(photo_id);
CREATE INDEX IF NOT EXISTS idx_photo_comments_created_at ON public.photo_comments(created_at);

-- Enable Row Level Security
ALTER TABLE public.family_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_comments ENABLE ROW LEVEL SECURITY;

-- Permissive policies for development (public access)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'family_photos' AND policyname = 'Public read photos'
  ) THEN
    CREATE POLICY "Public read photos" ON public.family_photos FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'family_photos' AND policyname = 'Public insert photos'
  ) THEN
    CREATE POLICY "Public insert photos" ON public.family_photos FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'family_photos' AND policyname = 'Public update photos'
  ) THEN
    CREATE POLICY "Public update photos" ON public.family_photos FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'family_photos' AND policyname = 'Public delete photos'
  ) THEN
    CREATE POLICY "Public delete photos" ON public.family_photos FOR DELETE USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'photo_comments' AND policyname = 'Public read comments'
  ) THEN
    CREATE POLICY "Public read comments" ON public.photo_comments FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'photo_comments' AND policyname = 'Public insert comments'
  ) THEN
    CREATE POLICY "Public insert comments" ON public.photo_comments FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'photo_comments' AND policyname = 'Public update comments'
  ) THEN
    CREATE POLICY "Public update comments" ON public.photo_comments FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'photo_comments' AND policyname = 'Public delete comments'
  ) THEN
    CREATE POLICY "Public delete comments" ON public.photo_comments FOR DELETE USING (true);
  END IF;
END $$;

-- Configure realtime
ALTER TABLE public.family_photos REPLICA IDENTITY FULL;
ALTER TABLE public.photo_comments REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.family_photos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.photo_comments;
