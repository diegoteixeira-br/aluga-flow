import { createParser } from "eventsource-parser";
import { flushSync } from "react-dom";

type ImageEventPayload =
  | { type: "image_generation.partial_image"; b64_json: string; partial_image_index: number }
  | { type: "image_generation.completed"; b64_json: string }
  | { type: "error"; error: { message: string } };

export async function streamImage(
  endpoint: string,
  prompt: string,
  onFrame: (b64: string, isFinal: boolean) => void,
  extraHeaders?: Record<string, string>,
): Promise<void> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(extraHeaders ?? {}) },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Image generation failed: ${res.status} ${await res.text().catch(() => "")}`);
  }

  let sawCompleted = false;
  let streamError: string | undefined;
  const parser = createParser({
    onEvent(event) {
      let payload: ImageEventPayload | undefined;
      try { payload = JSON.parse(event.data) as ImageEventPayload; } catch { /* ignore */ }
      if (event.event === "error" || payload?.type === "error") {
        streamError = (payload as { error?: { message?: string } })?.error?.message ?? "Falha na geração da imagem";
        return;
      }
      if (event.event !== "image_generation.partial_image" && event.event !== "image_generation.completed") return;
      if (!payload) return;
      const isFinal = event.event === "image_generation.completed";
      flushSync(() => {
        onFrame((payload as { b64_json: string }).b64_json, isFinal);
      });
      if (isFinal) sawCompleted = true;
    },
  });

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      parser.feed(value);
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  if (streamError) throw new Error(streamError);
  if (!sawCompleted) throw new Error("A geração terminou sem imagem final");
}
