
DROP POLICY IF EXISTS "Anyone can insert reaction" ON public.post_reactions;
CREATE POLICY "Anyone can insert reaction" ON public.post_reactions
  FOR INSERT
  WITH CHECK (
    kind IN ('like','dislike')
    AND voter_key IS NOT NULL
    AND char_length(voter_key) BETWEEN 8 AND 128
    AND (user_id IS NULL OR user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Anyone can create comment" ON public.post_comments;
CREATE POLICY "Anyone can create comment" ON public.post_comments
  FOR INSERT
  WITH CHECK (
    status = 'aprovado'
    AND char_length(user_name) BETWEEN 1 AND 80
    AND char_length(text) BETWEEN 1 AND 2000
    AND (user_id IS NULL OR user_id = auth.uid())
  );
