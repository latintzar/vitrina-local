import type { UIMessage } from 'ai';

export type StreamEvent =
  | { type: 'text-delta'; id: string; delta: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: Record<string, unknown> }
  | { type: 'tool-result'; toolCallId: string; result: unknown }
  | { type: 'data-widget'; data: { widget: string; payload: Record<string, unknown> } }
  | { type: 'finish'; finishReason?: string }
  | { type: 'error'; error: string };

export type VitrinaUIMessage = UIMessage & {
  role: 'user' | 'assistant';
  content: string;
};

function baseUrl(): string {
  return import.meta.env.VITE_VITRINA_AGENT_URL || '/agent';
}

export async function* streamChatTurn(req: {
  messages: Pick<VitrinaUIMessage, 'role' | 'content'>[];
  thread_id?: string | null;
  user_id?: string | null;
  cart_key?: string | null;
  cart_ids?: string[];
  user_location?: Record<string, unknown> | null;
}): AsyncIterable<StreamEvent | { type: 'done' }> {
  const res = await fetch(`${baseUrl()}/v1/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok || !res.body) {
    yield { type: 'error', error: `agent ${res.status}` };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 2);
      if (!raw.startsWith('data:')) continue;
      const payload = raw.slice(5).trim();
      if (payload === '[DONE]') {
        yield { type: 'done' };
        return;
      }
      try {
        yield JSON.parse(payload) as StreamEvent;
      } catch {
        // Ignore malformed chunks; the stream keeps going.
      }
    }
  }
  yield { type: 'done' };
}
