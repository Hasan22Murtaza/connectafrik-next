-- Thread-level archive flag (hidden from main list when true; clients may filter on this).

alter table public.chat_threads
  add column if not exists archived boolean not null default false;
