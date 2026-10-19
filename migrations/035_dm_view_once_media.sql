-- Add media columns to dm_messages
ALTER TABLE dm_messages
ADD COLUMN media_path text,
ADD COLUMN media_type text CHECK (media_type IN ('photo', 'video')),
ADD COLUMN media_mime text,
ADD COLUMN media_size integer,
ADD COLUMN media_duration integer,
ADD COLUMN viewed_at timestamptz;

-- Create a private storage bucket for DM media
INSERT INTO storage.buckets (id, name, public)
VALUES ('dm-media', 'dm-media', false)
ON CONFLICT (id) DO NOTHING;

-- Only the service role (our backend) can read/write to this bucket
CREATE POLICY "Server can manage dm-media"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'dm-media');
