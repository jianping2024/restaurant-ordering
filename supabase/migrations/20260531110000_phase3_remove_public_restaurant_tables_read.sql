-- Remove public table UUID enumeration after staff/customer table reads moved behind validated paths.

drop policy if exists restaurant_tables_public_read on public.restaurant_tables;
revoke select on public.restaurant_tables from anon;
