-- Dish motion videos (`menu_items.video_url | rail_video_url`, 20261030120000) are stored
-- in the `menu-images` bucket next to the photo. A bucket that carries an explicit MIME
-- whitelist (cloud, created in the dashboard with image types only) rejects them with
-- "mime type video/mp4 is not supported". Append video/mp4 to that whitelist; a bucket
-- with no whitelist (NULL = any type, e.g. local) already accepts it and stays untouched.

UPDATE storage.buckets
SET allowed_mime_types = array_append(allowed_mime_types, 'video/mp4')
WHERE id = 'menu-images'
  AND allowed_mime_types IS NOT NULL
  AND NOT ('video/mp4' = ANY (allowed_mime_types));
