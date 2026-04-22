-- 菜单项可选图片 URL（Supabase Storage 公共链接）
alter table public.menu_items
  add column if not exists image_url text;

-- ============================================================
-- Storage：菜品图片（公开读，仅餐厅 owner 可写）
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'menu-images',
  'menu-images',
  true,
  1048576,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 路径约定：{restaurant_id}/{menu_item_id}.{ext}
create policy "menu_images_public_read"
  on storage.objects for select
  using (bucket_id = 'menu-images');

create policy "menu_images_owner_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'menu-images'
    and split_part(name, '/', 1) in (
      select id::text from public.restaurants where owner_id = auth.uid()
    )
  );

create policy "menu_images_owner_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'menu-images'
    and split_part(name, '/', 1) in (
      select id::text from public.restaurants where owner_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'menu-images'
    and split_part(name, '/', 1) in (
      select id::text from public.restaurants where owner_id = auth.uid()
    )
  );

create policy "menu_images_owner_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'menu-images'
    and split_part(name, '/', 1) in (
      select id::text from public.restaurants where owner_id = auth.uid()
    )
  );
