-- P1: transfer/merge RPCs are staff-only (waiter API + dashboard owner); block anonymous abuse.

revoke execute on function public.transfer_table_session(uuid, integer, integer) from anon;
revoke execute on function public.merge_table_sessions(uuid, integer, integer) from anon;
revoke execute on function public.merge_multiple_table_sessions(uuid, integer[], integer) from anon;
