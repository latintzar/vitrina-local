/**
 * SSE client for `backend/agent` (`/v1/chat`).
 *
 * The agent streams JSON events over `text/event-stream`:
 *   - `{ "type": "session", "session_id": "chat_..." }` (always first)
 *   - `{ "type": "message", "content": "..." }` (one or more)
 *   - terminator `data: [DONE]`
 *
 * We keep the wire format deliberately small so the backend can add
 * token-level streaming later without breaking the client — just add
 * a `{ "type": "token", "content": "..." }` event and have the
 * reducer accumulate it.
 */

export type ChatEvent =
  | { type: 'session'; session_id: string }
  | { type: 'message'; content: string }
  | { type: 'token'; content: string }
  | { type: 'error'; message: string }
  | { type: 'done' };

export interface ChatRequest {
  message: string;
  session_id?: string | null;
  user_id?: string | null;
}

function baseUrl(): string {
  const env = (import.meta as any).env ?? {};
  return env.VITE_VITRINA_AGENT_URL || '/agent';
}

/**
 * Open a chat turn as an async iterable of ChatEvents. Caller is
 * expected to `for await` through the iterator.
 */
export async function* streamChat(req: ChatRequest): AsyncIterable<ChatEvent> {
  const res = await fetch(`${baseUrl()}/v1/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok || !res.body) {
    yield { type: 'error', message: `agent ${res.status}` };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const raw = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 2);
      if (!raw.startsWith('data:')) continue;
      const payload = raw.slice(5).trim();
      if (payload === '[DONE]') {
        yield { type: 'done' };
        return;
      }
      try {
        const ev = JSON.parse(payload) as ChatEvent;
        yield ev;
      } catch {
        // ignore malformed chunks
      }
    }
  }
  yield { type: 'done' };
}

export async function fetchMessages(
  session_id: string,
): Promise<{ session_id: string; messages: { role: string; content: string }[] }> {
  const res = await fetch(`${baseUrl()}/v1/chat/${encodeURIComponent(session_id)}/messages`);
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}
