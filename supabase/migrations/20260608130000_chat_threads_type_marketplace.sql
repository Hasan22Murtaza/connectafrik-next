-- Allow marketplace threads on chat_threads.
alter table public.chat_threads drop constraint if exists chat_threads_type_check;

alter table public.chat_threads
  add constraint chat_threads_type_check check (
    type in ('direct', 'group', 'marketplace')
  )
  not valid;
