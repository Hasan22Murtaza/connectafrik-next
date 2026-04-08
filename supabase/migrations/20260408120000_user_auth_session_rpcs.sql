-- Server-side helpers for "where you're logged in" (auth.sessions).
-- Callable only by service_role via PostgREST (Next.js API routes).

create or replace function public.list_user_auth_sessions(p_user_id uuid)
returns json
language sql
security definer
set search_path = auth
stable
as $$
  select coalesce(
    json_agg(
      json_build_object(
        'id', s.id,
        'user_agent', s.user_agent,
        'ip', s.ip,
        'created_at', s.created_at,
        'updated_at', s.updated_at,
        'refreshed_at', s.refreshed_at
      )
      order by coalesce(s.refreshed_at, s.updated_at, s.created_at) desc nulls last
    ),
    '[]'::json
  )
  from auth.sessions s
  where s.user_id = p_user_id;
$$;

create or replace function public.revoke_user_auth_session(p_user_id uuid, p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = auth
as $$
declare
  n int;
begin
  delete from auth.sessions
  where id = p_session_id and user_id = p_user_id;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke all on function public.list_user_auth_sessions(uuid) from public;
revoke all on function public.revoke_user_auth_session(uuid, uuid) from public;
grant execute on function public.list_user_auth_sessions(uuid) to service_role;
grant execute on function public.revoke_user_auth_session(uuid, uuid) to service_role;
