-- By-item ledger merge: paid tickets keep existing amount (never rewritten by later recalculate).

create or replace function public.merge_by_item_split_result_with_ledger(
  p_incoming jsonb,
  p_existing jsonb
) returns jsonb
language plpgsql
set search_path to public
as $$
declare
  v_inc jsonb := coalesce(p_incoming, '[]'::jsonb);
  v_ex jsonb := coalesce(p_existing, '[]'::jsonb);
  v_ex_len integer;
  v_inc_len integer;
  v_i integer;
  v_j integer;
  v_ex_row jsonb;
  v_inc_row jsonb;
  v_ex_party text;
  v_inc_party text;
  v_ex_name text;
  v_inc_name text;
  v_row jsonb;
  v_result jsonb := '[]'::jsonb;
  v_used boolean[];
  v_paid boolean;
begin
  if jsonb_typeof(v_inc) <> 'array' then
    v_inc := '[]'::jsonb;
  end if;
  if jsonb_typeof(v_ex) <> 'array' then
    v_ex := '[]'::jsonb;
  end if;

  v_ex_len := jsonb_array_length(v_ex);
  v_inc_len := jsonb_array_length(v_inc);

  if v_inc_len = 0 then
    return v_ex;
  end if;
  if v_ex_len = 0 then
    return v_inc;
  end if;

  v_used := array_fill(false, array[v_inc_len]);

  for v_i in 0 .. v_ex_len - 1 loop
    v_ex_row := v_ex -> v_i;
    v_ex_party := nullif(btrim(coalesce(v_ex_row ->> 'party_id', '')), '');
    v_ex_name := lower(btrim(coalesce(v_ex_row ->> 'name', '')));
    v_inc_row := null;

    if v_ex_party is not null then
      for v_j in 0 .. v_inc_len - 1 loop
        if v_used[v_j + 1] then
          continue;
        end if;
        v_inc_party := nullif(btrim(coalesce(v_inc -> v_j ->> 'party_id', '')), '');
        if v_inc_party is not null and lower(v_inc_party) = lower(v_ex_party) then
          v_inc_row := v_inc -> v_j;
          v_used[v_j + 1] := true;
          exit;
        end if;
      end loop;
    elsif v_ex_name <> '' then
      for v_j in 0 .. v_inc_len - 1 loop
        if v_used[v_j + 1] then
          continue;
        end if;
        v_inc_name := lower(btrim(coalesce(v_inc -> v_j ->> 'name', '')));
        if v_inc_name = v_ex_name then
          v_inc_row := v_inc -> v_j;
          v_used[v_j + 1] := true;
          exit;
        end if;
      end loop;
    end if;

    if v_inc_row is null then
      continue;
    end if;

    v_paid :=
      coalesce((v_ex_row ->> 'paid')::boolean, false)
      or coalesce((v_inc_row ->> 'paid')::boolean, false);

    v_row := v_ex_row || jsonb_build_object(
      'amount',
        case
          when v_paid then (v_ex_row ->> 'amount')::numeric
          else (v_inc_row ->> 'amount')::numeric
        end,
      'paid', v_paid
    );
    v_inc_party := nullif(btrim(coalesce(v_inc_row ->> 'party_id', '')), '');
    if v_inc_party is not null then
      v_row := v_row || jsonb_build_object('party_id', v_inc_party);
    end if;
    v_result := v_result || jsonb_build_array(v_row);
  end loop;

  for v_j in 0 .. v_inc_len - 1 loop
    if v_used[v_j + 1] then
      continue;
    end if;
    v_inc_row := v_inc -> v_j;
    v_inc_name := btrim(coalesce(v_inc_row ->> 'name', ''));
    if v_inc_name = '' then
      continue;
    end if;
    v_result := v_result || jsonb_build_array(v_inc_row);
  end loop;

  return v_result;
end;
$$;
