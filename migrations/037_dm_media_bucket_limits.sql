-- Enforce size and MIME at the bucket level for dm-media.
-- The API also validates, but this is the last line of defense against
-- a client that skips the API and calls createSignedUploadUrl directly.

update storage.buckets
set
  file_size_limit = 15728640, -- 15 MiB
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]
where id = 'dm-media';
