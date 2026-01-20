-- Create group_post_comments table
CREATE TABLE IF NOT EXISTS public.group_post_comments (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  group_post_id uuid NOT NULL,
  author_id uuid NOT NULL,
  content text NOT NULL,
  parent_id uuid NULL,
  likes_count integer NULL DEFAULT 0,
  created_at timestamp with time zone NULL DEFAULT now(),
  updated_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT group_post_comments_pkey PRIMARY KEY (id),
  CONSTRAINT group_post_comments_group_post_id_fkey FOREIGN KEY (group_post_id) 
    REFERENCES public.group_posts(id) ON DELETE CASCADE,
  CONSTRAINT group_post_comments_author_id_fkey FOREIGN KEY (author_id) 
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT group_post_comments_parent_id_fkey FOREIGN KEY (parent_id) 
    REFERENCES public.group_post_comments(id) ON DELETE CASCADE,
  CONSTRAINT group_post_comments_content_check CHECK (
    (length(content) >= 1) AND (length(content) <= 2000)
  ),
  CONSTRAINT group_post_comments_likes_count_check CHECK ((likes_count >= 0))
) TABLESPACE pg_default;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_group_post_comments_group_post_id 
  ON public.group_post_comments USING btree (group_post_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_group_post_comments_author_id 
  ON public.group_post_comments USING btree (author_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_group_post_comments_parent_id 
  ON public.group_post_comments USING btree (parent_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_group_post_comments_created_at 
  ON public.group_post_comments USING btree (created_at DESC) TABLESPACE pg_default;

-- Create comment_likes table if it doesn't exist (for liking comments)
CREATE TABLE IF NOT EXISTS public.comment_likes (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  comment_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamp with time zone NULL DEFAULT now(),
  CONSTRAINT comment_likes_pkey PRIMARY KEY (id),
  CONSTRAINT comment_likes_comment_id_fkey FOREIGN KEY (comment_id) 
    REFERENCES public.group_post_comments(id) ON DELETE CASCADE,
  CONSTRAINT comment_likes_user_id_fkey FOREIGN KEY (user_id) 
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT comment_likes_unique UNIQUE (comment_id, user_id)
) TABLESPACE pg_default;

-- Create index for comment_likes
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id 
  ON public.comment_likes USING btree (comment_id) TABLESPACE pg_default;

CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id 
  ON public.comment_likes USING btree (user_id) TABLESPACE pg_default;

