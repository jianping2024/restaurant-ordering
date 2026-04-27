-- ============================================================
-- Merge multiple source tables into one target table
-- ============================================================

create or replace function public.merge_multiple_table_sessions(
  p_restaurant_id uuid,
  p_source_tables integer[],
  p_target_table integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_table integer;
  v_target_session_id uuid;
begin
  if p_source_tables is null or array_length(p_source_tables, 1) is null then
    raise exception 'source tables cannot be empty';
  end if;

  if p_target_table = any(p_source_tables) then
    raise exception 'target table cannot be included in source tables';
  end if;

  foreach v_source_table in array p_source_tables loop
    v_target_session_id := public.merge_table_sessions(
      p_restaurant_id,
      v_source_table,
      p_target_table
    );
  end loop;

  return v_target_session_id;
end;
$$;

grant execute on function public.merge_multiple_table_sessions(uuid, integer[], integer) to anon, authenticated;
