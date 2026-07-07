
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS published_at timestamptz;
UPDATE public.posts SET published_at = created_at WHERE published = true AND published_at IS NULL;

CREATE OR REPLACE FUNCTION public.publish_scheduled_posts()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_count integer;
BEGIN
  UPDATE public.posts
     SET published = true,
         published_at = COALESCE(scheduled_at, now()),
         scheduled_at = NULL,
         updated_at = now()
   WHERE published = false
     AND scheduled_at IS NOT NULL
     AND scheduled_at <= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;
