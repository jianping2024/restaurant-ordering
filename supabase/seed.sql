-- Local dev seed: 巨好吃餐厅 (menu snapshot from cloud; no orders/sessions).
-- Login: dev-owner@local.test / localdev123
-- Regenerate: node scripts/generate-juhaochi-seed.mjs

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
  v_pw text := extensions.crypt('localdev123', extensions.gen_salt('bf'));
BEGIN
  DELETE FROM auth.identities WHERE user_id = '40bb02de-21e0-47e7-a3d6-caab3d8bb059';
  DELETE FROM auth.users WHERE id = '40bb02de-21e0-47e7-a3d6-caab3d8bb059';

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    phone, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    is_sso_user, is_anonymous
  ) VALUES (
    '40bb02de-21e0-47e7-a3d6-caab3d8bb059',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'dev-owner@local.test', v_pw, NOW(),
    '', '', '', '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('email', 'dev-owner@local.test', 'email_verified', true, 'sub', '40bb02de-21e0-47e7-a3d6-caab3d8bb059'),
    NOW(), NOW(), false, false
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), '40bb02de-21e0-47e7-a3d6-caab3d8bb059',
    jsonb_build_object('sub', '40bb02de-21e0-47e7-a3d6-caab3d8bb059', 'email', 'dev-owner@local.test', 'email_verified', true),
    'email', '40bb02de-21e0-47e7-a3d6-caab3d8bb059', NOW(), NOW(), NOW());
END $$;

INSERT INTO public.restaurants (
  id, name, slug, owner_id, logo_url, address, phone, plan, kitchen_password, waiter_password,
  geo_latitude, geo_longitude, print_locale, print_agent_config, kitchen_password_version, waiter_password_version,
  order_radius_meters, buffet_friday_weekend_from
) VALUES (
  '19ad30c9-6c10-4845-8c89-583f3898274d', '巨好吃餐厅', 'restaurant-mo9y14xc', '40bb02de-21e0-47e7-a3d6-caab3d8bb059', NULL, NULL, NULL, 'free',
  '1234', '5678', NULL, NULL, 'pt', '{"poll":{"after_print_interval_sec":5,"busy_interval_sec":5,"closed_check_sec":60,"error_interval_sec":5,"idle_interval_sec":10,"warm_after_activity_sec":1800,"warm_interval_sec":5},"schedule":{"timezone":"Europe/Lisbon","weekday":{"windows":[{"end":"18:00","start":"09:00"},{"end":"23:00","start":"19:10"}]}}}'::jsonb,
  1, 4, 1000, '18:00:00'
) ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, slug = EXCLUDED.slug, owner_id = EXCLUDED.owner_id, kitchen_password = EXCLUDED.kitchen_password,
  waiter_password = EXCLUDED.waiter_password, print_locale = EXCLUDED.print_locale, print_agent_config = EXCLUDED.print_agent_config,
  kitchen_password_version = EXCLUDED.kitchen_password_version, waiter_password_version = EXCLUDED.waiter_password_version,
  order_radius_meters = EXCLUDED.order_radius_meters, buffet_friday_weekend_from = EXCLUDED.buffet_friday_weekend_from;

DELETE FROM public.print_stations WHERE restaurant_id = '19ad30c9-6c10-4845-8c89-583f3898274d';
DELETE FROM public.restaurant_tables WHERE restaurant_id = '19ad30c9-6c10-4845-8c89-583f3898274d';

INSERT INTO public.print_stations (id, restaurant_id, name_pt, name_en, name_zh, sort_order, created_at) VALUES ('9afa3554-ca41-412b-acde-064cef735cd9', '19ad30c9-6c10-4845-8c89-583f3898274d', 'Bar', 'Bar', '吧台', 0, '2026-05-14T20:56:16.965282+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.print_stations (id, restaurant_id, name_pt, name_en, name_zh, sort_order, created_at) VALUES ('2528adae-d688-439f-a97a-1801e21e3611', '19ad30c9-6c10-4845-8c89-583f3898274d', 'caixa-1', 'checkout-1', '收银台-1', 2, '2026-05-24T19:12:51.09583+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.print_stations (id, restaurant_id, name_pt, name_en, name_zh, sort_order, created_at) VALUES ('2b0c4dae-0376-46cd-a389-6173733449a7', '19ad30c9-6c10-4845-8c89-583f3898274d', 'ciziha', 'kich', '后厨', 3, '2026-05-25T12:54:50.814842+00:00') ON CONFLICT (id) DO NOTHING;

INSERT INTO public.menu_categories (id, restaurant_id, parent_id, name_pt, name_en, name_zh, sort_order, active, print_station_id, item_code, created_at) VALUES ('bc6b075f-dd1f-4246-9bdf-314475f86024', '19ad30c9-6c10-4845-8c89-583f3898274d', NULL, 'REFRIGIRANTE', 'DRINK', '饮料', 0, true, '9afa3554-ca41-412b-acde-064cef735cd9', 'RE1', '2026-05-25T13:00:01.139532+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.menu_categories (id, restaurant_id, parent_id, name_pt, name_en, name_zh, sort_order, active, print_station_id, item_code, created_at) VALUES ('ba3af431-aec9-431b-9c22-8d31fdc559c5', '19ad30c9-6c10-4845-8c89-583f3898274d', NULL, 'VINHO TINTO', 'RED WINE', '红酒', 1, true, '9afa3554-ca41-412b-acde-064cef735cd9', 'VT1', '2026-05-25T13:01:35.541932+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.menu_categories (id, restaurant_id, parent_id, name_pt, name_en, name_zh, sort_order, active, print_station_id, item_code, created_at) VALUES ('952a1d97-d27c-43f1-abbe-169583fb3403', '19ad30c9-6c10-4845-8c89-583f3898274d', NULL, 'Vinho branco', 'Vinho branco', '白酒', 2, true, '9afa3554-ca41-412b-acde-064cef735cd9', NULL, '2026-05-25T13:19:56.236289+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.menu_categories (id, restaurant_id, parent_id, name_pt, name_en, name_zh, sort_order, active, print_station_id, item_code, created_at) VALUES ('865b64dc-7149-4889-a4f2-f0fade505e9d', '19ad30c9-6c10-4845-8c89-583f3898274d', NULL, 'Whisky', 'Whisky', '威士忌', 3, true, '9afa3554-ca41-412b-acde-064cef735cd9', NULL, '2026-05-25T13:27:02.913394+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.menu_categories (id, restaurant_id, parent_id, name_pt, name_en, name_zh, sort_order, active, print_station_id, item_code, created_at) VALUES ('11dfe345-dcff-4e3c-b887-ae5f29edae25', '19ad30c9-6c10-4845-8c89-583f3898274d', NULL, 'Chá', 'Tea', '茶', 4, true, '9afa3554-ca41-412b-acde-064cef735cd9', NULL, '2026-05-25T13:27:38.272946+00:00') ON CONFLICT (id) DO NOTHING;

INSERT INTO public.menu_items (id, restaurant_id, name_pt, name_en, name_zh, description_pt, description_en, price, category, emoji, available, sort_order, image_url, note_preset_keys, category_en, category_zh, category_id, print_station_id, item_code, created_at) VALUES ('e098534a-71c5-46f2-b6e4-5fc466519288', '19ad30c9-6c10-4845-8c89-583f3898274d', 'Cola', 'Cole', '可乐', NULL, NULL, 1, 'REFRIGIRANTE', '🍺', true, 0, NULL, ARRAY[]::text[], 'DRINK', '饮料', 'bc6b075f-dd1f-4246-9bdf-314475f86024', NULL, NULL, '2026-05-25T13:07:48.002337+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.menu_items (id, restaurant_id, name_pt, name_en, name_zh, description_pt, description_en, price, category, emoji, available, sort_order, image_url, note_preset_keys, category_en, category_zh, category_id, print_station_id, item_code, created_at) VALUES ('57391c3d-0c1d-43e8-b4b3-8a15562fcac3', '19ad30c9-6c10-4845-8c89-583f3898274d', 'Vinho casa', 'Vinho casa', '本家酒', NULL, NULL, 5, 'VINHO TINTO', '🍽️', true, 0, NULL, ARRAY[]::text[], 'RED WINE', '红酒', 'ba3af431-aec9-431b-9c22-8d31fdc559c5', NULL, '101', '2026-05-25T13:16:46.011182+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.menu_items (id, restaurant_id, name_pt, name_en, name_zh, description_pt, description_en, price, category, emoji, available, sort_order, image_url, note_preset_keys, category_en, category_zh, category_id, print_station_id, item_code, created_at) VALUES ('ccb8e5ad-e2a4-452d-839d-f931659455c2', '19ad30c9-6c10-4845-8c89-583f3898274d', 'Vinho casa', 'Vinho casa', '本家酒', NULL, NULL, 6.5, 'Vinho branco', '🍺', true, 0, NULL, ARRAY[]::text[], 'Vinho branco', '白酒', '952a1d97-d27c-43f1-abbe-169583fb3403', NULL, '201', '2026-05-25T13:21:44.414174+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.menu_items (id, restaurant_id, name_pt, name_en, name_zh, description_pt, description_en, price, category, emoji, available, sort_order, image_url, note_preset_keys, category_en, category_zh, category_id, print_station_id, item_code, created_at) VALUES ('cdd2d9e3-d15e-444b-9e41-e353afc0edd6', '19ad30c9-6c10-4845-8c89-583f3898274d', 'Vinho porto', 'Vinho porto', 'Vinho porto', NULL, NULL, 3.5, 'Whisky', '🍺', true, 0, NULL, ARRAY[]::text[], 'Whisky', '威士忌', '865b64dc-7149-4889-a4f2-f0fade505e9d', NULL, '301', '2026-05-25T13:29:37.264302+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.menu_items (id, restaurant_id, name_pt, name_en, name_zh, description_pt, description_en, price, category, emoji, available, sort_order, image_url, note_preset_keys, category_en, category_zh, category_id, print_station_id, item_code, created_at) VALUES ('50e37a6d-c2e6-4403-b9df-bb179e1fba83', '19ad30c9-6c10-4845-8c89-583f3898274d', 'Chá camomila', 'Chá camomila', '茉莉花茶', NULL, NULL, 6.5, 'Chá', '🍺', true, 0, NULL, ARRAY[]::text[], 'Tea', '茶', '11dfe345-dcff-4e3c-b887-ae5f29edae25', NULL, '401', '2026-05-25T13:32:34.646276+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.menu_items (id, restaurant_id, name_pt, name_en, name_zh, description_pt, description_en, price, category, emoji, available, sort_order, image_url, note_preset_keys, category_en, category_zh, category_id, print_station_id, item_code, created_at) VALUES ('d5b91222-ab6e-4a91-bf83-77e07f01e7d3', '19ad30c9-6c10-4845-8c89-583f3898274d', 'Sumol laranja', 'Orange juice', '橙汁', NULL, NULL, 2, 'REFRIGIRANTE', '🍽️', true, 1, NULL, ARRAY[]::text[], 'DRINK', '饮料', 'bc6b075f-dd1f-4246-9bdf-314475f86024', NULL, NULL, '2026-05-25T13:09:02.813072+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.menu_items (id, restaurant_id, name_pt, name_en, name_zh, description_pt, description_en, price, category, emoji, available, sort_order, image_url, note_preset_keys, category_en, category_zh, category_id, print_station_id, item_code, created_at) VALUES ('2054c775-2b04-41fc-a373-9ab520c0054d', '19ad30c9-6c10-4845-8c89-583f3898274d', 'Chaminé', 'Chaminé', 'Chaminé', NULL, NULL, 15, 'VINHO TINTO', '🍺', true, 1, NULL, ARRAY[]::text[], 'RED WINE', '红酒', 'ba3af431-aec9-431b-9c22-8d31fdc559c5', NULL, '102', '2026-05-25T13:17:29.4715+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.menu_items (id, restaurant_id, name_pt, name_en, name_zh, description_pt, description_en, price, category, emoji, available, sort_order, image_url, note_preset_keys, category_en, category_zh, category_id, print_station_id, item_code, created_at) VALUES ('5e8722e5-632c-4b8e-9043-ef08b18a0d31', '19ad30c9-6c10-4845-8c89-583f3898274d', 'Borba', 'Borba', 'Borba', NULL, NULL, 12.5, 'Vinho branco', '🍺', true, 1, NULL, ARRAY[]::text[], 'Vinho branco', '白酒', '952a1d97-d27c-43f1-abbe-169583fb3403', NULL, '202', '2026-05-25T13:22:34.934205+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.menu_items (id, restaurant_id, name_pt, name_en, name_zh, description_pt, description_en, price, category, emoji, available, sort_order, image_url, note_preset_keys, category_en, category_zh, category_id, print_station_id, item_code, created_at) VALUES ('d844a652-0ffb-4000-9aaf-e7ad1e094fca', '19ad30c9-6c10-4845-8c89-583f3898274d', 'Licor beirão 0.5L', 'Licor beirão 0.5L', 'Licor beirão 0.5L', NULL, NULL, 5.5, 'Whisky', '🍺', true, 1, NULL, ARRAY[]::text[], 'Whisky', '威士忌', '865b64dc-7149-4889-a4f2-f0fade505e9d', NULL, '302', '2026-05-25T13:30:59.751502+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.menu_items (id, restaurant_id, name_pt, name_en, name_zh, description_pt, description_en, price, category, emoji, available, sort_order, image_url, note_preset_keys, category_en, category_zh, category_id, print_station_id, item_code, created_at) VALUES ('47cd765c-1443-454a-bd75-e73638c310f5', '19ad30c9-6c10-4845-8c89-583f3898274d', 'Fanta laranja', 'Orange fanta', '芬达', NULL, NULL, 1, 'REFRIGIRANTE', '🍽️', true, 2, NULL, ARRAY[]::text[], 'DRINK', '饮料', 'bc6b075f-dd1f-4246-9bdf-314475f86024', NULL, '01', '2026-05-25T13:11:05.215851+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.menu_items (id, restaurant_id, name_pt, name_en, name_zh, description_pt, description_en, price, category, emoji, available, sort_order, image_url, note_preset_keys, category_en, category_zh, category_id, print_station_id, item_code, created_at) VALUES ('f3a5d9df-3cc2-4f46-8800-0de8e33288aa', '19ad30c9-6c10-4845-8c89-583f3898274d', 'Borba', 'Borba', 'Borba', NULL, NULL, 15.5, 'VINHO TINTO', '🍺', true, 2, NULL, ARRAY[]::text[], 'RED WINE', '红酒', 'ba3af431-aec9-431b-9c22-8d31fdc559c5', NULL, '104', '2026-05-25T13:18:51.201674+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.menu_items (id, restaurant_id, name_pt, name_en, name_zh, description_pt, description_en, price, category, emoji, available, sort_order, image_url, note_preset_keys, category_en, category_zh, category_id, print_station_id, item_code, created_at) VALUES ('e200c99b-7d8f-430b-a74c-b478e0923f33', '19ad30c9-6c10-4845-8c89-583f3898274d', 'E A', 'E A', 'E A', NULL, NULL, 16.5, 'Vinho branco', '🍺', true, 2, NULL, ARRAY[]::text[], 'Vinho branco', '白酒', '952a1d97-d27c-43f1-abbe-169583fb3403', NULL, '203', '2026-05-25T13:23:11.115173+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.menu_items (id, restaurant_id, name_pt, name_en, name_zh, description_pt, description_en, price, category, emoji, available, sort_order, image_url, note_preset_keys, category_en, category_zh, category_id, print_station_id, item_code, created_at) VALUES ('85c88f29-fcec-4896-b80c-f42f7ac85d18', '19ad30c9-6c10-4845-8c89-583f3898274d', 'Guarna', 'Guarna', 'Guarna', NULL, NULL, 1, 'REFRIGIRANTE', '🍺', true, 3, NULL, ARRAY[]::text[], 'DRINK', '饮料', 'bc6b075f-dd1f-4246-9bdf-314475f86024', NULL, '02', '2026-05-25T13:11:37.594433+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.menu_items (id, restaurant_id, name_pt, name_en, name_zh, description_pt, description_en, price, category, emoji, available, sort_order, image_url, note_preset_keys, category_en, category_zh, category_id, print_station_id, item_code, created_at) VALUES ('e61f84c7-a87d-41a3-8825-5d357058e298', '19ad30c9-6c10-4845-8c89-583f3898274d', 'Evel', 'Evel', 'Evel', NULL, NULL, 18, 'Vinho branco', '🍺', true, 3, NULL, ARRAY[]::text[], 'Vinho branco', '白酒', '952a1d97-d27c-43f1-abbe-169583fb3403', NULL, '204', '2026-05-25T13:23:49.09055+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.menu_items (id, restaurant_id, name_pt, name_en, name_zh, description_pt, description_en, price, category, emoji, available, sort_order, image_url, note_preset_keys, category_en, category_zh, category_id, print_station_id, item_code, created_at) VALUES ('be7a290e-38df-436a-8580-55ac0aa44f0c', '19ad30c9-6c10-4845-8c89-583f3898274d', '7 up', '7 up', '7up', NULL, NULL, 2, 'REFRIGIRANTE', '🍺', true, 4, NULL, ARRAY[]::text[], 'DRINK', '饮料', 'bc6b075f-dd1f-4246-9bdf-314475f86024', NULL, '03', '2026-05-25T13:12:13.622758+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.menu_items (id, restaurant_id, name_pt, name_en, name_zh, description_pt, description_en, price, category, emoji, available, sort_order, image_url, note_preset_keys, category_en, category_zh, category_id, print_station_id, item_code, created_at) VALUES ('79ae46f3-ccef-40bc-acb2-854a5859358c', '19ad30c9-6c10-4845-8c89-583f3898274d', 'Periquita', 'Piriquita', 'Piriquita', NULL, NULL, 16, 'REFRIGIRANTE', '🍺', true, 5, NULL, ARRAY[]::text[], 'DRINK', '饮料', 'bc6b075f-dd1f-4246-9bdf-314475f86024', NULL, '103', '2026-05-25T13:18:10.261028+00:00') ON CONFLICT (id) DO NOTHING;
