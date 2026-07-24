-- Fix auth_rls_initplan: evaluate auth.uid() once per statement (InitPlan).
-- Semantics unchanged; only wraps auth.uid() as (select auth.uid()).

DROP POLICY IF EXISTS abnormal_operations_owner_select ON public.abnormal_operations;
CREATE POLICY abnormal_operations_owner_select ON public.abnormal_operations AS PERMISSIVE FOR SELECT TO authenticated USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS abnormal_operations_owner_update ON public.abnormal_operations;
CREATE POLICY abnormal_operations_owner_update ON public.abnormal_operations AS PERMISSIVE FOR UPDATE TO authenticated USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid()))))) WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS bill_splits_owner_select ON public.bill_splits;
CREATE POLICY bill_splits_owner_select ON public.bill_splits AS PERMISSIVE FOR SELECT TO authenticated USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS bill_splits_owner_update ON public.bill_splits;
CREATE POLICY bill_splits_owner_update ON public.bill_splits AS PERMISSIVE FOR UPDATE TO authenticated USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid()))))) WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS buffet_calendar_owner_delete ON public.buffet_calendar_overrides;
CREATE POLICY buffet_calendar_owner_delete ON public.buffet_calendar_overrides AS PERMISSIVE FOR DELETE TO PUBLIC USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS buffet_calendar_owner_insert ON public.buffet_calendar_overrides;
CREATE POLICY buffet_calendar_owner_insert ON public.buffet_calendar_overrides AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS buffet_calendar_owner_update ON public.buffet_calendar_overrides;
CREATE POLICY buffet_calendar_owner_update ON public.buffet_calendar_overrides AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS buffet_price_rules_owner_delete ON public.buffet_price_rules;
CREATE POLICY buffet_price_rules_owner_delete ON public.buffet_price_rules AS PERMISSIVE FOR DELETE TO PUBLIC USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS buffet_price_rules_owner_insert ON public.buffet_price_rules;
CREATE POLICY buffet_price_rules_owner_insert ON public.buffet_price_rules AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS buffet_price_rules_owner_update ON public.buffet_price_rules;
CREATE POLICY buffet_price_rules_owner_update ON public.buffet_price_rules AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS buffet_time_slots_owner_delete ON public.buffet_time_slots;
CREATE POLICY buffet_time_slots_owner_delete ON public.buffet_time_slots AS PERMISSIVE FOR DELETE TO PUBLIC USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS buffet_time_slots_owner_insert ON public.buffet_time_slots;
CREATE POLICY buffet_time_slots_owner_insert ON public.buffet_time_slots AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS buffet_time_slots_owner_update ON public.buffet_time_slots;
CREATE POLICY buffet_time_slots_owner_update ON public.buffet_time_slots AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS buffets_owner_delete ON public.buffets;
CREATE POLICY buffets_owner_delete ON public.buffets AS PERMISSIVE FOR DELETE TO PUBLIC USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS buffets_owner_insert ON public.buffets;
CREATE POLICY buffets_owner_insert ON public.buffets AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS buffets_owner_update ON public.buffets;
CREATE POLICY buffets_owner_update ON public.buffets AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS menu_categories_owner_all ON public.menu_categories;
CREATE POLICY menu_categories_owner_all ON public.menu_categories AS PERMISSIVE FOR ALL TO PUBLIC USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid()))))) WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS menu_items_owner_all ON public.menu_items;
CREATE POLICY menu_items_owner_all ON public.menu_items AS PERMISSIVE FOR ALL TO PUBLIC USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid()))))) WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS orders_owner_select ON public.orders;
CREATE POLICY orders_owner_select ON public.orders AS PERMISSIVE FOR SELECT TO authenticated USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS orders_owner_update ON public.orders;
CREATE POLICY orders_owner_update ON public.orders AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS print_agent_devices_owner_select ON public.print_agent_devices;
CREATE POLICY print_agent_devices_owner_select ON public.print_agent_devices AS PERMISSIVE FOR SELECT TO PUBLIC USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS print_agent_pairings_owner_insert ON public.print_agent_pairings;
CREATE POLICY print_agent_pairings_owner_insert ON public.print_agent_pairings AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS print_agent_pairings_owner_select ON public.print_agent_pairings;
CREATE POLICY print_agent_pairings_owner_select ON public.print_agent_pairings AS PERMISSIVE FOR SELECT TO PUBLIC USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS print_agent_pairings_owner_update ON public.print_agent_pairings;
CREATE POLICY print_agent_pairings_owner_update ON public.print_agent_pairings AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS print_jobs_owner_delete ON public.print_jobs;
CREATE POLICY print_jobs_owner_delete ON public.print_jobs AS PERMISSIVE FOR DELETE TO PUBLIC USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS print_jobs_owner_insert ON public.print_jobs;
CREATE POLICY print_jobs_owner_insert ON public.print_jobs AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS print_jobs_owner_select ON public.print_jobs;
CREATE POLICY print_jobs_owner_select ON public.print_jobs AS PERMISSIVE FOR SELECT TO PUBLIC USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS print_jobs_owner_update ON public.print_jobs;
CREATE POLICY print_jobs_owner_update ON public.print_jobs AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS print_stations_owner_all ON public.print_stations;
CREATE POLICY print_stations_owner_all ON public.print_stations AS PERMISSIVE FOR ALL TO PUBLIC USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid()))))) WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS restaurant_staff_accounts_staff_select_own ON public.restaurant_staff_accounts;
CREATE POLICY restaurant_staff_accounts_staff_select_own ON public.restaurant_staff_accounts AS PERMISSIVE FOR SELECT TO authenticated USING (((user_id = (select auth.uid())) AND (disabled_at IS NULL)));

DROP POLICY IF EXISTS restaurant_table_group_members_owner_all ON public.restaurant_table_group_members;
CREATE POLICY restaurant_table_group_members_owner_all ON public.restaurant_table_group_members AS PERMISSIVE FOR ALL TO PUBLIC USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid()))))) WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS restaurant_table_groups_owner_all ON public.restaurant_table_groups;
CREATE POLICY restaurant_table_groups_owner_all ON public.restaurant_table_groups AS PERMISSIVE FOR ALL TO PUBLIC USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid()))))) WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS restaurant_tables_owner_all ON public.restaurant_tables;
CREATE POLICY restaurant_tables_owner_all ON public.restaurant_tables AS PERMISSIVE FOR ALL TO PUBLIC USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid()))))) WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS restaurants_delete_own ON public.restaurants;
CREATE POLICY restaurants_delete_own ON public.restaurants AS PERMISSIVE FOR DELETE TO PUBLIC USING ((owner_id = (select auth.uid())));

DROP POLICY IF EXISTS restaurants_insert_own ON public.restaurants;
CREATE POLICY restaurants_insert_own ON public.restaurants AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((owner_id = (select auth.uid())));

DROP POLICY IF EXISTS restaurants_select_own ON public.restaurants;
CREATE POLICY restaurants_select_own ON public.restaurants AS PERMISSIVE FOR SELECT TO PUBLIC USING ((owner_id = (select auth.uid())));

DROP POLICY IF EXISTS restaurants_update_own ON public.restaurants;
CREATE POLICY restaurants_update_own ON public.restaurants AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((owner_id = (select auth.uid())));

DROP POLICY IF EXISTS session_collected_payments_owner_select ON public.session_collected_payments;
CREATE POLICY session_collected_payments_owner_select ON public.session_collected_payments AS PERMISSIVE FOR SELECT TO authenticated USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS table_party_group_members_owner_all ON public.table_party_group_members;
CREATE POLICY table_party_group_members_owner_all ON public.table_party_group_members AS PERMISSIVE FOR ALL TO PUBLIC USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid()))))) WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS table_party_groups_owner_all ON public.table_party_groups;
CREATE POLICY table_party_groups_owner_all ON public.table_party_groups AS PERMISSIVE FOR ALL TO PUBLIC USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid()))))) WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS table_sessions_owner_select ON public.table_sessions;
CREATE POLICY table_sessions_owner_select ON public.table_sessions AS PERMISSIVE FOR SELECT TO authenticated USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

DROP POLICY IF EXISTS table_sessions_owner_update ON public.table_sessions;
CREATE POLICY table_sessions_owner_update ON public.table_sessions AS PERMISSIVE FOR UPDATE TO authenticated USING ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid()))))) WITH CHECK ((restaurant_id IN ( SELECT restaurants.id
   FROM restaurants
  WHERE (restaurants.owner_id = (select auth.uid())))));

