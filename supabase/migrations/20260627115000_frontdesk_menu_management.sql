-- Frontdesk staff may manage menu categories, dishes, print stations, and menu images.

CREATE POLICY menu_categories_frontdesk_all ON public.menu_categories
  FOR ALL TO authenticated
  USING (public.is_active_restaurant_staff(restaurant_id, ARRAY['frontdesk'::text]))
  WITH CHECK (public.is_active_restaurant_staff(restaurant_id, ARRAY['frontdesk'::text]));
CREATE POLICY menu_items_frontdesk_all ON public.menu_items
  FOR ALL TO authenticated
  USING (public.is_active_restaurant_staff(restaurant_id, ARRAY['frontdesk'::text]))
  WITH CHECK (public.is_active_restaurant_staff(restaurant_id, ARRAY['frontdesk'::text]));
CREATE POLICY print_stations_frontdesk_all ON public.print_stations
  FOR ALL TO authenticated
  USING (public.is_active_restaurant_staff(restaurant_id, ARRAY['frontdesk'::text]))
  WITH CHECK (public.is_active_restaurant_staff(restaurant_id, ARRAY['frontdesk'::text]));
CREATE POLICY menu_images_frontdesk_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'menu-images'
    AND split_part(name, '/', 1) IN (
      SELECT restaurant_id::text
      FROM public.restaurant_staff_accounts
      WHERE user_id = auth.uid()
        AND disabled_at IS NULL
        AND role = 'frontdesk'
    )
  );
CREATE POLICY menu_images_frontdesk_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND split_part(name, '/', 1) IN (
      SELECT restaurant_id::text
      FROM public.restaurant_staff_accounts
      WHERE user_id = auth.uid()
        AND disabled_at IS NULL
        AND role = 'frontdesk'
    )
  )
  WITH CHECK (
    bucket_id = 'menu-images'
    AND split_part(name, '/', 1) IN (
      SELECT restaurant_id::text
      FROM public.restaurant_staff_accounts
      WHERE user_id = auth.uid()
        AND disabled_at IS NULL
        AND role = 'frontdesk'
    )
  );
CREATE POLICY menu_images_frontdesk_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND split_part(name, '/', 1) IN (
      SELECT restaurant_id::text
      FROM public.restaurant_staff_accounts
      WHERE user_id = auth.uid()
        AND disabled_at IS NULL
        AND role = 'frontdesk'
    )
  );
