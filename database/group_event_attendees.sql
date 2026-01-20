-- Create group_event_attendees table for RSVP functionality
CREATE TABLE IF NOT EXISTS public.group_event_attendees (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT group_event_attendees_pkey PRIMARY KEY (id),
  CONSTRAINT group_event_attendees_event_id_fkey FOREIGN KEY (event_id) 
    REFERENCES public.group_events(id) ON DELETE CASCADE,
  CONSTRAINT group_event_attendees_user_id_fkey FOREIGN KEY (user_id) 
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT group_event_attendees_unique UNIQUE (event_id, user_id)
) TABLESPACE pg_default;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_group_event_attendees_event_id 
  ON public.group_event_attendees USING btree (event_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_group_event_attendees_user_id 
  ON public.group_event_attendees USING btree (user_id) TABLESPACE pg_default;

