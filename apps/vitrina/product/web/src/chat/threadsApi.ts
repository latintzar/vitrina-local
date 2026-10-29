import { getCachedAccessToken, getSupabase, waitForSessionPrime } from '../auth/supabaseClient';

export interface ChatThread {
  id: string;
  title?: string | null;
  pinned?: boolean;
  updated_at?: string;
  created_at?: string;
}

export interface ChatThreadMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: unknown;
  created_at?: string;
}

const CART_KEY_STORAGE = 'vitrina:cart_key';
const ACTIVE_THREAD_STORAGE = 'vitrina:active_thread';

export function getActiveThreadId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(ACTIVE_THREAD_STORAGE);
    return v && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

export function setActiveThreadId(id: string): void {
  try {
    window.localStorage.setItem(ACTIVE_THREAD_STORAGE, id);
  } catch {}
}

export function clearActiveThreadId(): void {
  try {
    window.localStorage.removeItem(ACTIVE_THREAD_STORAGE);
  } catch {}
}

function apiBase() {
  return import.meta.env.VITE_VITRINA_API_URL || '/api';
}

export function getAnonCartKey() {
  if (typeof window === 'undefined') return 'server';
  const existing = window.localStorage.getItem(CART_KEY_STORAGE);
  if (existing) return existing;
  const next =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `anon_${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(CART_KEY_STORAGE, next);
  return next;
}

function localThread(title?: string): ChatThread {
  return {
    id: `local-${getAnonCartKey()}`,
    title: title || 'New Vitrina chat',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function authHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    'X-Vitrina-Cart-Key': getAnonCartKey(),
  };
  if (getSupabase()) {
    await waitForSessionPrime();
    const token = getCachedAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function jsonHeaders(): Promise<HeadersInit> {
  return {
    ...(await authHeaders()),
    'Content-Type': 'application/json',
  };
}

export async function createThread(title?: string): Promise<ChatThread> {
  const res = await fetch(`${apiBase()}/chat/threads`, {
    method: 'POST',
    headers: await jsonHeaders(),
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    console.warn(`create_thread_failed:${res.status}; using local thread`);
    return localThread(title);
  }
  return (await res.json()) as ChatThread;
}

export async function appendThreadMessage(
  threadId: string,
  message: ChatThreadMessage,
): Promise<ChatThreadMessage> {
  if (threadId.startsWith('local-')) return message;
  const res = await fetch(`${apiBase()}/chat/threads/${encodeURIComponent(threadId)}/messages`, {
    method: 'POST',
    headers: await jsonHeaders(),
    body: JSON.stringify(message),
  });
  if (!res.ok) {
    console.warn(`append_thread_message_failed:${res.status}`);
    return message;
  }
  return (await res.json()) as ChatThreadMessage;
}

export async function listThreadMessages(threadId: string): Promise<ChatThreadMessage[]> {
  if (threadId.startsWith('local-')) return [];
  const res = await fetch(
    `${apiBase()}/chat/threads/${encodeURIComponent(threadId)}/messages`,
    { headers: await authHeaders() },
  );
  if (!res.ok) {
    console.warn(`list_thread_messages_failed:${res.status}`);
    return [];
  }
  return (await res.json()) as ChatThreadMessage[];
}

/**
 * In-flight dedupe only — **do not** cache settled results.
 *
 * A forever-cache of `listThreadMessages` returns stale rows after the user
 * chats, closes the tab, and comes back in the same JS session (same thread
 * id): hydration merged old history + live SDK state → scrambled/double
 * bubbles. Coalescing concurrent fetches for the same thread is still
 * worthwhile so prefetch + hydration share one RTT.
 */
const _threadMessagesInFlight = new Map<string, Promise<ChatThreadMessage[]>>();

export function prefetchThreadMessages(threadId: string): Promise<ChatThreadMessage[]> {
  if (!threadId || threadId.startsWith('local-')) return Promise.resolve([]);
  let p = _threadMessagesInFlight.get(threadId);
  if (!p) {
    p = listThreadMessages(threadId)
      .catch(() => [] as ChatThreadMessage[])
      .finally(() => {
        _threadMessagesInFlight.delete(threadId);
      });
    _threadMessagesInFlight.set(threadId, p);
  }
  return p;
}

export function invalidateThreadMessagesCache(threadId?: string): void {
  if (threadId) _threadMessagesInFlight.delete(threadId);
  else _threadMessagesInFlight.clear();
}

export async function listThreads(limit = 50): Promise<ChatThread[]> {
  const res = await fetch(`${apiBase()}/chat/users/me/threads?limit=${limit}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) {
    console.warn(`list_threads_failed:${res.status}`);
    return [];
  }
  return (await res.json()) as ChatThread[];
}

export async function patchThread(
  threadId: string,
  patch: { title?: string; pinned?: boolean },
): Promise<ChatThread> {
  if (threadId.startsWith('local-')) return { id: threadId, ...patch };
  const res = await fetch(`${apiBase()}/chat/threads/${encodeURIComponent(threadId)}`, {
    method: 'PATCH',
    headers: {
      ...(await authHeaders()),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    console.warn(`patch_thread_failed:${res.status}`);
    return { id: threadId, ...patch };
  }
  return (await res.json()) as ChatThread;
}

export async function deleteThread(threadId: string): Promise<void> {
  if (threadId.startsWith('local-')) return;
  const res = await fetch(`${apiBase()}/chat/threads/${encodeURIComponent(threadId)}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!res.ok) {
    console.warn(`delete_thread_failed:${res.status}`);
  }
}

/**
 * Subscribe to new chat_messages rows for a thread.
 *
 * Uses Supabase Realtime when available (instant push for assistant
 * progress messages emitted by background workers — see backend
 * `mcp/chat_jobs.py`) PLUS a 5-second polling fallback for environments
 * where Realtime is disabled or the websocket is blocked. Both paths
 * dedupe by message id, so they're safe to run concurrently.
 *
 * Returns an unsubscribe fn that tears down both the channel and the
 * polling interval.
 */
export function subscribeThreadMessages(
  threadId: string,
  onNewMessage: (msg: ChatThreadMessage) => void,
): () => void {
  if (threadId.startsWith('local-')) return () => {};

  const seen = new Set<string>();
  const handle = (raw: unknown) => {
    const row = raw as ChatThreadMessage;
    if (!row || typeof row !== 'object') return;
    const id = row.id;
    if (id) {
      if (seen.has(id)) return;
      seen.add(id);
    } else {
      // Rows without `id` must not hit Realtime/poll every 5s unchecked —
      // that triple-renders the whole thread. Dedupe by stable row shape.
      const fallbackKey = `${row.role}:${typeof row.content === 'string' ? row.content : JSON.stringify(row.content)}:${row.created_at ?? ''}`;
      if (seen.has(fallbackKey)) return;
      seen.add(fallbackKey);
    }
    onNewMessage(row);
  };

  const sb = getSupabase();
  let channel: ReturnType<NonNullable<ReturnType<typeof getSupabase>>['channel']> | null = null;
  if (sb) {
    // Cast through `any` because `@supabase/supabase-js`'s typed
    // overloads accept only the static event names ("system", etc.) for
    // the public ``on`` signature, while ``postgres_changes`` is the
    // documented runtime channel for table-level subscriptions. The SDK
    // resolves it correctly at runtime; the type narrowing just hasn't
    // caught up. See https://supabase.com/docs/guides/realtime.
    channel = (sb.channel(`chat:${threadId}`) as any)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload: { new?: ChatThreadMessage }) => {
          if (payload.new) handle(payload.new);
        },
      )
      .subscribe();
  }

  // Belt-and-braces polling. Production may have Realtime publication
  // off for `chat_messages`, and CDNs/network conditions can drop the
  // websocket. We poll every 5 s and rely on dedupe by id to avoid
  // double-rendering.
  let cancelled = false;
  const pollInterval = window.setInterval(async () => {
    if (cancelled) return;
    try {
      const rows = await listThreadMessages(threadId);
      // Re-check after the async fetch — cleanup may have fired while the
      // request was in-flight.  Without this, a torn-down subscription
      // still delivers every row it fetched, causing duplicate messages.
      if (cancelled) return;
      for (const row of rows) handle(row);
    } catch {
      // swallow — next tick retries
    }
  }, 5_000);

  return () => {
    cancelled = true;
    window.clearInterval(pollInterval);
    if (channel && sb) {
      try {
        sb.removeChannel(channel);
      } catch {}
    }
  };
}
