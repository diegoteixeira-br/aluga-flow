import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ThumbsUp, ThumbsDown, Loader2, MessageSquare } from "lucide-react";
import { formatDateBR } from "@/lib/blog-utils";

type Comment = {
  id: string;
  user_name: string;
  text: string;
  created_at: string;
};

function getVoterKey(): string {
  if (typeof window === "undefined") return "";
  let k = localStorage.getItem("blog_voter_key");
  if (!k) {
    k = crypto.randomUUID();
    localStorage.setItem("blog_voter_key", k);
  }
  return k;
}

function votedKey(postId: string) {
  return `blog_voted_${postId}`;
}

export function BlogEngagement({ postId }: { postId: string }) {
  const [likes, setLikes] = useState(0);
  const [dislikes, setDislikes] = useState(0);
  const [myVote, setMyVote] = useState<"like" | "dislike" | null>(null);
  const [voting, setVoting] = useState(false);

  const [comments, setComments] = useState<Comment[]>([]);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(votedKey(postId));
      if (stored === "like" || stored === "dislike") setMyVote(stored);
      setName(localStorage.getItem("blog_commenter_name") ?? "");
    }
  }, [postId]);

  const loadReactions = async () => {
    const [likeRes, dislikeRes] = await Promise.all([
      supabase.from("post_reactions").select("id", { count: "exact", head: true }).eq("post_id", postId).eq("kind", "like"),
      supabase.from("post_reactions").select("id", { count: "exact", head: true }).eq("post_id", postId).eq("kind", "dislike"),
    ]);
    setLikes(likeRes.count ?? 0);
    setDislikes(dislikeRes.count ?? 0);
  };

  const loadComments = async () => {
    const { data } = await supabase
      .from("post_comments")
      .select("id,user_name,text,created_at")
      .eq("post_id", postId)
      .eq("status", "aprovado")
      .order("created_at", { ascending: false });
    setComments((data ?? []) as Comment[]);
  };

  useEffect(() => {
    loadReactions();
    loadComments();

    const channel = supabase
      .channel(`blog-engagement-${postId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "post_reactions", filter: `post_id=eq.${postId}` }, () => loadReactions())
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments", filter: `post_id=eq.${postId}` }, () => loadComments())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const vote = async (kind: "like" | "dislike") => {
    if (myVote) {
      toast.info("Você já avaliou este artigo.");
      return;
    }
    setVoting(true);
    const voter_key = getVoterKey();
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("post_reactions").insert({
      post_id: postId,
      kind,
      voter_key,
      user_id: userData.user?.id ?? null,
    });
    setVoting(false);
    if (error) {
      if (error.code === "23505") {
        setMyVote(kind);
        localStorage.setItem(votedKey(postId), kind);
        toast.info("Você já avaliou este artigo.");
      } else {
        toast.error("Não foi possível registrar sua avaliação.");
      }
      return;
    }
    setMyVote(kind);
    localStorage.setItem(votedKey(postId), kind);
    toast.success("Obrigado pelo seu voto!");
  };

  const submitComment = async () => {
    const nm = name.trim();
    const tx = text.trim();
    if (nm.length < 2) return toast.error("Informe seu nome.");
    if (tx.length < 2) return toast.error("Escreva um comentário.");
    if (tx.length > 2000) return toast.error("Comentário muito longo (máx. 2000).");
    setSending(true);
    try {
      const { approved } = await moderateComment({ data: { text: tx } });
      if (!approved) {
        setSending(false);
        toast.error("Seu comentário contém termos não permitidos por nossas diretrizes de comunidade e não pôde ser publicado.");
        return;
      }
    } catch {
      setSending(false);
      toast.error("Não foi possível validar seu comentário agora. Tente novamente em instantes.");
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("post_comments").insert({
      post_id: postId,
      user_name: nm.slice(0, 80),
      text: tx,
      status: "aprovado",
      user_id: userData.user?.id ?? null,
    });
    setSending(false);
    if (error) return toast.error("Não foi possível enviar o comentário.");
    localStorage.setItem("blog_commenter_name", nm);
    setText("");
    toast.success("Comentário enviado!");
  };

  return (
    <section className="mt-10 border-t pt-8">
      <div className="rounded-lg border bg-card p-5">
        <h3 className="text-lg font-semibold">Este artigo foi útil?</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant={myVote === "like" ? "default" : "outline"}
            size="sm"
            disabled={voting || !!myVote}
            onClick={() => vote("like")}
          >
            <ThumbsUp className="mr-2 h-4 w-4" /> Gostei · {likes}
          </Button>
          <Button
            variant={myVote === "dislike" ? "default" : "outline"}
            size="sm"
            disabled={voting || !!myVote}
            onClick={() => vote("dislike")}
          >
            <ThumbsDown className="mr-2 h-4 w-4" /> Não gostei · {dislikes}
          </Button>
        </div>
        {myVote && <p className="mt-2 text-xs text-muted-foreground">Você já avaliou este artigo.</p>}
      </div>

      <div className="mt-8">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <MessageSquare className="h-5 w-5" /> Comentários ({comments.length})
        </h3>

        <div className="mt-4 space-y-3 rounded-lg border bg-card p-4">
          <Input
            placeholder="Seu nome"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Textarea
            placeholder="Deixe seu comentário..."
            rows={4}
            maxLength={2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{text.length}/2000</span>
            <Button size="sm" onClick={submitComment} disabled={sending}>
              {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar comentário
            </Button>
          </div>
        </div>

        <ul className="mt-6 space-y-4">
          {comments.length === 0 ? (
            <li className="text-sm text-muted-foreground">Seja o primeiro a comentar.</li>
          ) : (
            comments.map((c) => (
              <li key={c.id} className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{c.user_name}</span>
                  <span className="text-xs text-muted-foreground">{formatDateBR(c.created_at)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{c.text}</p>
              </li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}
