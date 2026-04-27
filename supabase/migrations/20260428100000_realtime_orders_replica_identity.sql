-- Realtime：postgres_changes 使用 restaurant_id=eq.... 等非主键过滤时，
-- PostgreSQL 须将 replica identity 设为 FULL，否则 UPDATE/DELETE 往往无法匹配过滤条件，
-- 客户端收不到事件（例如服务员端 void 菜品后厨房不刷新）。

alter table public.orders replica identity full;

-- 厨房订阅 table_sessions；若未加入 publication 则无事件。
alter table public.table_sessions replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'table_sessions'
  ) then
    alter publication supabase_realtime add table public.table_sessions;
  end if;
end $$;
