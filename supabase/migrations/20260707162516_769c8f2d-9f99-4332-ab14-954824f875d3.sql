
-- Reactions
CREATE TABLE public.post_reactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('like','dislike')),
  voter_key TEXT NOT NULL,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, voter_key)
);
CREATE INDEX post_reactions_post_idx ON public.post_reactions(post_id);

GRANT SELECT, INSERT ON public.post_reactions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_reactions TO authenticated;
GRANT ALL ON public.post_reactions TO service_role;

ALTER TABLE public.post_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view reactions" ON public.post_reactions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert reaction" ON public.post_reactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage reactions" ON public.post_reactions FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Comments
CREATE TABLE public.post_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aprovado',
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT post_comments_text_len CHECK (char_length(text) BETWEEN 1 AND 2000),
  CONSTRAINT post_comments_name_len CHECK (char_length(user_name) BETWEEN 1 AND 80)
);
CREATE INDEX post_comments_post_idx ON public.post_comments(post_id, status, created_at DESC);

GRANT SELECT, INSERT ON public.post_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_comments TO authenticated;
GRANT ALL ON public.post_comments TO service_role;

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view approved comments" ON public.post_comments FOR SELECT USING (status = 'aprovado');
CREATE POLICY "Anyone can create comment" ON public.post_comments FOR INSERT WITH CHECK (status = 'aprovado');
CREATE POLICY "Admins can manage comments" ON public.post_comments FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER update_post_comments_updated_at BEFORE UPDATE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;
