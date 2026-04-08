-- Client-reported friendly names for auth sessions (Supabase auth.sessions.user_agent is often minimal).

create table if not exists public.auth_session_device_labels (
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null,
  device_label text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, session_id)
);

create index if not exists auth_session_device_labels_user_id_idx
  on public.auth_session_device_labels (user_id);

alter table public.auth_session_device_labels enable row level security;
