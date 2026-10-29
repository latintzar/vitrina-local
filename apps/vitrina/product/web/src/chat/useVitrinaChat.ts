import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { subscribeChatPrompt } from './promptBus';
import { useChat } from '@ai-sdk/react';
import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai';
import { getActiveCartIds } from '../cart/useCart';
import {
  appendThreadMessage,
  clearActiveThreadId,
  createThread,
  getActiveThreadId,
  getAnonCartKey,
  invalidateThreadMessagesCache,
  prefetchThreadMessages,
  setActiveThreadId,
  subscribeThreadMessages,
  type ChatThreadMessage,
} from './threadsApi';
import { streamChatTurn } from './useChatStream';
import { transcribeAudio } from './voiceApi';
import {
  imagePartUrlsFromMessage,
  vitrinaRecipeFromMessage,
  vitrinaVoiceFromMessage,
  type VitrinaMessageMetadata,
  type VitrinaRecipeAttachment,
  type VitrinaVoicePayload,
} from './uiMessageExtras';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
  isVoice?: boolean;
  voiceUrl?: string;
  voiceDuration?: number;
  waveform?: number[];
  transcript?: string;
  /** Image URLs (data URLs from SDK file parts or blob: from voice metadata) */
  photoUrls?: string[];
  /** Recipe context preview (thumbnail + title) shown above the bubble. */
  recipeAttachment?: VitrinaRecipeAttachment;
  widgets?: { type: string; payload: Record<string, unknown> }[];
}

let _id = 0;
function newId(): string {
  _id += 1;
  return `m${Date.now()}_${_id}`;
}

function textFromParts(message: UIMessage): string {
  // Tool calls used to surface inline as "Calling recipes.add_to_basket…"
  // — that's developer-product noise. Vitrina is a consumer surface, so
  // we drop tool parts from the visible bubble entirely. The pending-
  // dot indicator on the message already conveys "thinking"; specific
  // tool names are not useful to a shopper.
  return message.parts
    .map((part) => (part.type === 'text' ? part.text : ''))
    .filter(Boolean)
    .join('\n');
}

/** Normalise text so DB-backed rows match SDK bubbles after newline joins. */
function normalizeForDedupe(s: string): string {
  return s.replace(/\n\n+/g, '\n\n').trim();
}

/** Stable key for deduping a live UIMessage against `chat_messages` rows.
 *  SDK ids are client-generated (`m…`); DB ids are UUIDs — we cannot rely
 *  on id equality. Compare role + visible text (or voice transcript). */
function uiMessageDedupeKey(m: UIMessage): string {
  if (m.role === 'user') {
    // Backend persists voice-note user turns as TEXT (the transcript
    // string) while the frontend separately appends a voice-shaped row
    // ({transcript,duration,waveform}). Keying both as `u:{transcript}`
    // (no v/t distinction) means the two persisted rows AND the SDK
    // live message all collapse to the same key — no duplicate user
    // bubble after the page refreshes.
    const vm = vitrinaVoiceFromMessage(m);
    const text = vm?.transcript?.trim() || textFromParts(m);
    return `u:${normalizeForDedupe(text)}`;
  }
  return `a:${normalizeForDedupe(textFromParts(m))}`;
}

function persistedRowDedupeKey(row: ChatThreadMessage): string {
  if (row.role === 'user') {
    const voice = storedVoiceFromContent(row.content);
    const text = voice?.transcript?.trim() || textFromPersistedContent(row.content);
    return `u:${normalizeForDedupe(text)}`;
  }
  return `a:turn:${normalizeForDedupe(textFromPersistedContent(row.content))}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseMaybeJsonObject(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function storedVoiceFromContent(content: unknown): VitrinaVoicePayload | undefined {
  const payload = parseMaybeJsonObject(content);
  if (!isRecord(payload)) return undefined;
  const transcript = payload.transcript;
  const duration = payload.voiceDuration ?? payload.duration;
  const waveform = payload.waveform;
  if (typeof transcript !== 'string' || !Array.isArray(waveform)) return undefined;
  const voiceDuration = Number(duration);
  return {
    voiceDuration: Number.isFinite(voiceDuration) ? voiceDuration : 0,
    waveform: waveform
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value)),
    transcript,
    voiceUrl: typeof payload.voiceUrl === 'string' ? payload.voiceUrl : undefined,
    photoUrls: Array.isArray(payload.photoUrls)
      ? payload.photoUrls.filter((url): url is string => typeof url === 'string')
      : undefined,
  };
}

function textFromPersistedContent(content: unknown): string {
  const payload = parseMaybeJsonObject(content);
  if (typeof payload === 'string') return payload;
  if (isRecord(payload) && typeof payload.text === 'string') return payload.text;
  if (isRecord(payload) && typeof payload.transcript === 'string') return payload.transcript;
  return JSON.stringify(payload ?? '');
}

interface PersistedWidget {
  type: string;
  payload: Record<string, unknown>;
}

/** Pull `{type, payload}` widget array out of a persisted assistant turn.
 *  Stored shape (server-side):
 *    {kind: 'assistant_turn', text: '...', widgets: [{type, payload}]}
 *  See backend/agent/session.py::_persist_assistant_turn.
 */
function widgetsFromPersistedContent(content: unknown): PersistedWidget[] {
  const payload = parseMaybeJsonObject(content);
  if (!isRecord(payload)) return [];
  const widgets = payload.widgets;
  if (!Array.isArray(widgets)) return [];
  const out: PersistedWidget[] = [];
  for (const w of widgets) {
    if (!isRecord(w)) continue;
    if (typeof w.type !== 'string') continue;
    const p = isRecord(w.payload) ? (w.payload as Record<string, unknown>) : {};
    out.push({ type: w.type, payload: p });
  }
  return out;
}

/** Pull explicit ``bubbles`` array out of a persisted assistant turn.
 *  Newer rows include this so rehydration recreates the live multi-
 *  bubble layout exactly; older rows only have `text` and we fall back
 *  to splitting on `\n\n` (see rowToUIMessages). */
function bubblesFromPersistedContent(content: unknown): string[] | null {
  const payload = parseMaybeJsonObject(content);
  if (!isRecord(payload)) return null;
  const bubbles = payload.bubbles;
  if (!Array.isArray(bubbles)) return null;
  const out: string[] = [];
  for (const b of bubbles) {
    if (typeof b === 'string' && b.trim()) out.push(b);
  }
  return out.length > 0 ? out : null;
}

function widgetsFromParts(message: UIMessage): ChatMessage['widgets'] {
  return message.parts
    .filter((part): part is typeof part & { type: `data-${string}`; data?: Record<string, unknown> } => part.type.startsWith('data-'))
    .map((part) => ({
      type: part.type.replace(/^data-/, ''),
      payload: part.data || {},
    }));
}

function toBackendMessages(messages: UIMessage[]): { role: 'user' | 'assistant'; content: string }[] {
  const out: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const m of messages) {
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    const content = textFromParts(m);
    if (content.trim()) out.push({ role: m.role, content });
  }
  return out;
}

function makeVitrinaTransport(
  awaitThreadId: () => Promise<string | null>,
  getMemoryUserId: () => string | null,
): ChatTransport<UIMessage> {
  return {
    async sendMessages({ messages }) {
      return new ReadableStream<UIMessageChunk>({
        async start(controller) {
          let textId: string | null = null;
          let assistantText = '';
          let textStarted = false;
          let textEnded = false;

          // Recipe URL extraction is now handled server-side by the
          // chat agent via the `recipes.extract_from_url` MCP tool. The
          // agent emits a `data-recipe_video_card` widget through the
          // regular SSE channel — same code path as Discover Buy.

          const ensureTextStarted = () => {
            if (textStarted) return;
            if (!textId) return;
            controller.enqueue({ type: 'text-start', id: textId });
            textStarted = true;
          };
          const ensureTextEnded = () => {
            if (!textStarted || textEnded) return;
            if (!textId) return;
            controller.enqueue({ type: 'text-end', id: textId });
            textEnded = true;
          };

          try {
            // Wait for the thread id here (NOT in the send() caller)
            // so the SDK's user-message bubble can render synchronously
            // while the thread create RTT happens in the background.
            const threadId = await awaitThreadId();
            for await (const ev of streamChatTurn({
              messages: toBackendMessages(messages),
              thread_id: threadId,
              user_id: getMemoryUserId(),
              cart_key: getAnonCartKey(),
              cart_ids: getActiveCartIds(),
              user_location: null,
            })) {
              if (ev.type === 'text-delta') {
                if (ev.id) {
                  if (textId !== null && ev.id !== textId) {
                    ensureTextEnded();
                    textId = ev.id;
                    textStarted = false;
                    textEnded = false;
                  } else if (textId === null) {
                    textId = ev.id;
                  }
                } else if (textId === null) {
                  textId = newId();
                }
                ensureTextStarted();
                assistantText += ev.delta;
                controller.enqueue({ type: 'text-delta', id: textId!, delta: ev.delta });
              } else if (ev.type === 'tool-call') {
                ensureTextEnded();
                controller.enqueue({
                  type: 'tool-input-available',
                  toolCallId: ev.toolCallId,
                  toolName: ev.toolName,
                  input: ev.args,
                  dynamic: true,
                });
              } else if (ev.type === 'tool-result') {
                controller.enqueue({
                  type: 'tool-output-available',
                  toolCallId: ev.toolCallId,
                  output: ev.result,
                  dynamic: true,
                });
              } else if (ev.type === 'data-widget') {
                controller.enqueue({
                  type: `data-${ev.data.widget}`,
                  data: ev.data.payload,
                } as UIMessageChunk);
              } else if (ev.type === 'error') {
                controller.enqueue({ type: 'error', errorText: ev.error });
              } else if (ev.type === 'finish' || ev.type === 'done') {
                ensureTextEnded();
              }
            }
            ensureTextEnded();
            // Assistant persistence is server-side now (see backend
            // session.py::_persist_assistant_turn). Writing here would
            // double-store the message AND drop widgets — the agent
            // turn is the source of truth for what the bubble should
            // look like on rehydration.
            controller.close();
          } catch (e) {
            controller.enqueue({ type: 'error', errorText: e instanceof Error ? e.message : String(e) });
            ensureTextEnded();
            controller.close();
          }
        },
      });
    },
    async reconnectToStream() {
      return null;
    },
  };
}

export function useVitrinaChat(opts: { userId?: string | null; isActive?: boolean }) {
  // Synchronously restore the active thread on mount so that:
  //   1. ensureThread() doesn't spin up a NEW thread the first time
  //      `send` is called after a tab switch / page reload.
  //   2. The very next assistant turn keeps writing into the same
  //      thread Peter was already mid-conversation in, instead of
  //      orphaning a new thread per recipe.add and feeling like a
  //      fresh chat each time.
  const initialThreadId = getActiveThreadId();
  // Do not call `prefetchThreadMessages` during render — it would refetch on
  // every re-render after the in-flight map entry clears. The hydration
  // `useEffect` + composer paths call `prefetchThreadMessages` when needed.
  const [threadId, setThreadId] = useState<string | null>(initialThreadId);
  const threadIdRef = useRef<string | null>(initialThreadId);
  /** False until `listThreadMessages` finishes when reopening a saved thread — avoids Landing flash. */
  const [threadHistoryLoaded, setThreadHistoryLoaded] = useState(() => !initialThreadId);
  const creatingThread = useRef<Promise<string> | null>(null);
  const [pendingVoice, setPendingVoice] = useState<ChatMessage[]>([]);
  const pendingVoiceRef = useRef<ChatMessage[]>([]);
  pendingVoiceRef.current = pendingVoice;
  const [transcribing, setTranscribing] = useState(false);
  const memoryUserIdRef = useRef<string | null>(opts.userId || getAnonCartKey());
  memoryUserIdRef.current = opts.userId || getAnonCartKey();
  const transport = useMemo(
    () =>
      makeVitrinaTransport(
        // Promise-aware getter — if a thread create is in flight when
        // the SDK starts streaming, we await it before issuing the
        // SSE call. This is what lets `send()` fire chat.sendMessage
        // synchronously without losing the thread id at the network
        // layer.
        async () => {
          if (threadIdRef.current) return threadIdRef.current;
          if (creatingThread.current) return await creatingThread.current;
          return null;
        },
        () => memoryUserIdRef.current,
      ),
    [],
  );
  const chat = useChat({ transport });
  const sdkStreaming = chat.status === 'submitted' || chat.status === 'streaming';
  const sdkStreamingRef = useRef(sdkStreaming);
  sdkStreamingRef.current = sdkStreaming;

  // Hydrate prior turns from the server when a saved thread is
  // restored. This runs once on mount; for a fresh chat (no saved
  // thread) we skip cleanly and leave the SDK with empty messages.
  //
  // Race-safety: if the user fired off a fresh message during the
  // hydration RTT (e.g. tap "Add to Basket" → switch to chat tab →
  // queued prompt sends before the listThreadMessages fetch returns)
  // we MUST NOT clobber that fresh message. We use the function form
  // of setMessages and prepend the seeded history to whatever the SDK
  // has accumulated so the bubble survives the hydration replace.
  /**
   * Convert a persisted `chat_messages` row into a UIMessage shape
   * the AI SDK can render. Used both during initial hydration AND for
   * realtime assistant pushes (see `useEffect` below).
   */
  /**
   * Convert a persisted row into one *or more* UIMessages.
   *
   * Multi-bubble assistant turns are stored as a single chat_messages
   * row whose `text` is `\n\n`-joined (the SSE adapter writes BREAKs
   * that way). To make rehydration look identical to the live stream
   * — separate bubbles, widget below the closing bubble — we split the
   * stored text on `\n\n` and produce N UIMessages, attaching all
   * widgets to the LAST one (deferral on the wire ensures widgets
   * always close out the turn after their explanatory sentence).
   *
   * Without this split, a turn that streamed as
   *   "Looking…" / "Added recipe (4 portions)" + [recipe widget]
   * rehydrated as one fat bubble with text first then widget,
   * which Peter saw as the "widget got replaced by the text" bug.
   */
  const rowToUIMessages = useCallback(
    (row: ChatThreadMessage, fallbackIdx = 0): UIMessage[] => {
      const voice = row.role === 'user' ? storedVoiceFromContent(row.content) : undefined;
      const text = voice?.transcript ?? textFromPersistedContent(row.content);
      const metadata: VitrinaMessageMetadata | undefined = voice
        ? { vitrinaVoice: voice }
        : undefined;
      const widgets =
        row.role === 'assistant' ? widgetsFromPersistedContent(row.content) : [];

      const baseId = row.id ?? `s${fallbackIdx}`;
      const widgetParts: UIMessage['parts'] = widgets.map(
        (w) =>
          ({
            type: `data-${w.type}` as `data-${string}`,
            data: w.payload,
          } as unknown as UIMessage['parts'][number]),
      );

      if (row.role !== 'assistant') {
        const parts: UIMessage['parts'] = [
          { type: 'text', text } as UIMessage['parts'][number],
        ];
        return [
          {
            id: baseId,
            role: row.role,
            parts,
            ...(metadata ? { metadata } : {}),
          } as UIMessage,
        ];
      }

      const bubbles =
        bubblesFromPersistedContent(row.content) ??
        text
          .split(/\n\n+/g)
          .map((b) => b.trim())
          .filter((b) => b.length > 0);

      if (bubbles.length === 0) {
        return widgetParts.length
          ? [{ id: baseId, role: 'assistant', parts: widgetParts } as UIMessage]
          : [];
      }

      return bubbles.map((bubbleText, idx) => {
        const isLast = idx === bubbles.length - 1;
        const parts: UIMessage['parts'] = [
          { type: 'text', text: bubbleText } as UIMessage['parts'][number],
          ...(isLast ? widgetParts : []),
        ];
        return {
          id: bubbles.length === 1 ? baseId : `${baseId}_b${idx}`,
          role: 'assistant',
          parts,
        } as UIMessage;
      });
    },
    [],
  );

  /**
   * Load thread history from the server and merge with whatever the SDK
   * already has. Used on first mount AND every time the chat tab
   * becomes active again (Discover → Chat) so a long-running session
   * always shows the latest messages — including any the agent
   * persisted while the user was on another tab.
   *
   * Race-safety: if the user fired off a fresh message during the RTT
   * we merge instead of replacing, keyed by a normalized text fingerprint.
   */
  const loadThreadHistory = useCallback(
    async (opts: { invalidateCache?: boolean } = {}): Promise<void> => {
      const tid = threadIdRef.current;
      if (!tid) {
        setThreadHistoryLoaded(true);
        return;
      }
      if (opts.invalidateCache) invalidateThreadMessagesCache(tid);
      const rows = await prefetchThreadMessages(tid);
      if (rows.length === 0) {
        setThreadHistoryLoaded(true);
        return;
      }
      const allSeeded: UIMessage[] = rows.flatMap((row, i) => rowToUIMessages(row, i));
      const byKey = new Map<string, UIMessage>();
      const order: string[] = [];
      for (const m of allSeeded) {
        const k = uiMessageDedupeKey(m);
        const existing = byKey.get(k);
        const incomingHasVoice = Boolean(vitrinaVoiceFromMessage(m));
        if (!existing) {
          byKey.set(k, m);
          order.push(k);
          continue;
        }
        const existingHasVoice = Boolean(vitrinaVoiceFromMessage(existing));
        if (incomingHasVoice && !existingHasVoice) {
          byKey.set(k, m);
        }
      }
      const seeded = order.map((k) => byKey.get(k)!).filter(Boolean);
      chat.setMessages((current) => {
        if (current.length === 0) return seeded;
        // Multiset: N identical keys in `seeded` let us drop up to N
        // matching client copies (same text / voice), but keep extras
        // when the user truly repeated the same phrase.
        const surplus = new Map<string, number>();
        for (const s of seeded) {
          const k = uiMessageDedupeKey(s);
          surplus.set(k, (surplus.get(k) || 0) + 1);
        }
        const fresh: UIMessage[] = [];
        for (const f of current) {
          const k = uiMessageDedupeKey(f);
          const n = surplus.get(k) || 0;
          if (n > 0) {
            surplus.set(k, n - 1);
            continue;
          }
          fresh.push(f);
        }
        return [...seeded, ...fresh];
      });
      setThreadHistoryLoaded(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const loadThreadHistoryRef = useRef(loadThreadHistory);
  loadThreadHistoryRef.current = loadThreadHistory;

  useEffect(() => {
    let cancelled = false;
    void loadThreadHistoryRef.current({ invalidateCache: false }).catch(() => {
      if (!cancelled) setThreadHistoryLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Refetch when the chat tab transitions inactive → active. ChatPage
  // is mounted-but-hidden across tab switches in App.tsx (so streaming
  // SSE survives), which means the mount-time hydration above only
  // runs once. Without this, opening Chat after a few minutes on
  // Discover shows a stale message list — Realtime can miss rows when
  // the connection drops, and any agent-side push that happened while
  // off-tab won't appear until refresh. Invalidate the cache so we
  // bypass the in-flight RTT dedupe and force a fresh fetch.
  const wasActiveRef = useRef<boolean>(opts.isActive ?? true);
  useEffect(() => {
    const isActive = opts.isActive ?? true;
    const wasActive = wasActiveRef.current;
    wasActiveRef.current = isActive;
    if (!wasActive && isActive && threadIdRef.current) {
      void loadThreadHistoryRef.current({ invalidateCache: true });
    }
  }, [opts.isActive]);

  /** Next `prefetchThreadMessages` after tab hide/show sees fresh rows (in-flight map only). */
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      const tid = threadIdRef.current;
      if (tid) invalidateThreadMessagesCache(tid);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  /**
   * Realtime push for assistant messages emitted by background workers
   * (e.g. recipes.extract_from_url_async progress / final card). The
   * SDK bubble for the in-flight turn is already updated via SSE; this
   * subscription handles **post-turn** assistant rows that the agent
   * — or one of its background workers — appends directly to
   * `chat_messages`. Without it, the user has to refresh to see the
   * "Recipe ready" card after leaving the chat tab.
   *
   * Dedupe: by `chat_messages.id`, then by content (SDK ids ≠ DB UUIDs),
   * then by full assistant turn text vs trailing assistant bubbles.
   */
  // Stable ref so the subscription closure never goes stale — this is
  // the key fix. `chat.setMessages` and `rowToUIMessages` are stable
  // across renders but `chat` itself is a new object on every render
  // (the AI SDK returns a fresh object each time). If we close over
  // `chat` directly in the subscription effect, the dep array changes
  // every render → effect tears down + recreates the subscription on
  // every render → each new subscription starts with a fresh `seen = {}`
  // → the 5-second poll re-delivers every persisted row → triple sends.
  const setMessagesRef = useRef(chat.setMessages);
  setMessagesRef.current = chat.setMessages;
  const rowToUIMessagesRef = useRef(rowToUIMessages);
  rowToUIMessagesRef.current = rowToUIMessages;

  useEffect(() => {
    if (!threadId || threadId.startsWith('local-')) return;
    return subscribeThreadMessages(threadId, (row) => {
      if (!row || typeof row !== 'object') return;
      setMessagesRef.current((current) => {
        if (row.id && current.some((m) => m.id === row.id)) return current;

        // While the SDK is streaming an assistant reply, ignore assistant
        // rows from Realtime/poll — the persisted row often lands before the
        // stream finishes and would duplicate or reorder bubbles vs SSE.
        if (row.role === 'assistant' && sdkStreamingRef.current) {
          return current;
        }

        // Same visible message often exists under a client id — Realtime
        // delivers the canonical DB row (UUID). Never stack duplicates.
        if (row.role === 'user') {
          const k = persistedRowDedupeKey(row);
          if (current.some((m) => m.role === 'user' && uiMessageDedupeKey(m) === k)) {
            return current;
          }
        } else {
          const incomingNorm = normalizeForDedupe(textFromPersistedContent(row.content));
          const trailingTurn: UIMessage[] = [];
          for (let i = current.length - 1; i >= 0; i -= 1) {
            const m = current[i];
            if (m.role !== 'assistant') break;
            trailingTurn.unshift(m);
          }
          const trailingText = normalizeForDedupe(
            trailingTurn
              .map((m) => textFromParts(m))
              .filter((t) => t.length > 0)
              .join('\n\n'),
          );
          if (incomingNorm !== '' && trailingText === incomingNorm) return current;
        }

        return [...current, ...rowToUIMessagesRef.current(row)];
      });
    });
    // threadId is the only thing that should cause a new subscription.
    // Everything else is accessed via stable refs above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  const ensureThread = useCallback(async (titleSeed: string) => {
    if (threadIdRef.current) return threadIdRef.current;
    if (!creatingThread.current) {
      creatingThread.current = createThread(titleSeed.slice(0, 48) || 'New Vitrina chat')
        .then((thread) => {
          threadIdRef.current = thread.id;
          setThreadId(thread.id);
          setActiveThreadId(thread.id);
          return thread.id;
        })
        .finally(() => {
          creatingThread.current = null;
        });
    }
    return creatingThread.current;
  }, []);

  type PendingTextSend = {
    text: string;
    photoFiles: File[];
    recipeAttachment: VitrinaRecipeAttachment | null | undefined;
  };
  const textSendQueueRef = useRef<PendingTextSend[]>([]);

  const runTextSend = useCallback(
    async (
      text: string,
      photoFiles?: File[],
      recipeAttachment?: VitrinaRecipeAttachment | null,
    ) => {
      const photos = photoFiles ?? [];
      const trimmed = text.trim();
      if (!trimmed && photos.length === 0) return;
      const caption =
        trimmed || (photos.length === 1 ? 'Sent a photo' : `Sent ${photos.length} photos`);

      // User text is persisted by the agent (`session_source.persist_user_turn`)
      // when the SSE request runs — do not `appendThreadMessage` here or we
      // get duplicate `chat_messages` rows and scrambled Realtime merges.

      await ensureThread(caption);

      const metadata: VitrinaMessageMetadata = {};
      if (recipeAttachment) metadata.vitrinaRecipe = recipeAttachment;
      const metaArg = Object.keys(metadata).length
        ? { metadata: metadata as unknown as Record<string, unknown> }
        : {};

      if (photos.length) {
        const dt = new DataTransfer();
        for (const f of photos) dt.items.add(f);
        await chat.sendMessage({ text: caption, files: dt.files, ...metaArg });
      } else {
        await chat.sendMessage({ text: caption, ...metaArg });
      }
    },
    [chat, ensureThread],
  );

  const send = useCallback(
    async (
      text: string,
      photoFiles?: File[],
      recipeAttachment?: VitrinaRecipeAttachment | null,
    ) => {
      const photos = photoFiles ?? [];
      const trimmed = text.trim();
      if ((!trimmed && photos.length === 0) || transcribing) return;
      if (sdkStreaming) {
        textSendQueueRef.current.push({ text, photoFiles: photos, recipeAttachment });
        return;
      }
      await runTextSend(text, photoFiles, recipeAttachment);
    },
    [runTextSend, sdkStreaming, transcribing],
  );

  const prevSdkStatusRef = useRef(chat.status);
  useEffect(() => {
    const prev = prevSdkStatusRef.current;
    prevSdkStatusRef.current = chat.status;
    const wasBusy = prev === 'submitted' || prev === 'streaming';
    const nowIdle = chat.status === 'ready' || chat.status === 'error';
    if (!wasBusy || !nowIdle || transcribing) return;
    const next = textSendQueueRef.current.shift();
    if (!next) return;
    void runTextSend(next.text, next.photoFiles, next.recipeAttachment ?? null);
  }, [chat.status, transcribing, runTextSend]);

  // Chat-rendered widgets (RecipeWidget "Add to basket", StretchCard
  // "Add stretch") post structured prompts via the prompt bus. We
  // forward them through the same `send` path so the chat agent
  // handles them with `recipes.add_to_basket` like any user message.
  useEffect(() =>
    subscribeChatPrompt((prompt, attachment) => {
      void send(prompt, undefined, attachment ?? undefined);
    }),
  [send]);

  const sendVoice = useCallback(
    async (blob: Blob, duration: number, waveform: number[], photoFiles?: File[]) => {
      if (blob.size === 0 || sdkStreaming || transcribing) return;
      const photos = photoFiles ?? [];
      const photoUrls = photos.map((f) => URL.createObjectURL(f));
      setTranscribing(true);
      const voiceUrl = URL.createObjectURL(blob);
      const pendingId = newId();
      const userMsg: ChatMessage = {
        id: pendingId,
        role: 'user',
        content: 'Transcribing…',
        isVoice: true,
        voiceUrl,
        voiceDuration: duration,
        waveform,
        photoUrls: photoUrls.length ? photoUrls : undefined,
      };
      setPendingVoice((m) => [...m, userMsg]);

      const revokeVoicePhotos = () => {
        URL.revokeObjectURL(voiceUrl);
        photoUrls.forEach((u) => URL.revokeObjectURL(u));
      };

      try {
        const result = await transcribeAudio(blob, { polish: false });
        const transcript = result.text;
        if (!transcript) {
          revokeVoicePhotos();
          setPendingVoice((m) => m.filter((msg) => msg.id !== userMsg.id));
          console.warn(result.error || 'No speech detected.');
          return;
        }

        // Same parallelisation as text send: kick thread create off
        // alongside the SDK dispatch so the voice bubble swaps in
        // immediately. Transport awaits the thread before SSE.
        void ensureThread(transcript).then((tid) => {
          void appendThreadMessage(tid, { role: 'user', content: { transcript, duration, waveform } });
        });

        const metaPayload: VitrinaMessageMetadata = {
          vitrinaVoice: {
            voiceUrl,
            voiceDuration: duration,
            waveform,
            transcript,
            photoUrls: photoUrls.length ? photoUrls : undefined,
          },
        };

        // Remove the local "Transcribing…" placeholder BEFORE we
        // dispatch to the SDK. `chat.sendMessage` synchronously adds
        // its own user message (with the voice metadata so it renders
        // as a real voice bubble), and only resolves AFTER the full
        // assistant reply has streamed back. If we leave the pending
        // bubble in place across that window, the user sees two voice
        // bubbles for the same audio for the entire turn — the bug
        // visible in Peter's screenshot. Kick the SDK call off and
        // don't await it here; errors land in the SDK's own state.
        setPendingVoice((m) => m.filter((msg) => msg.id !== pendingId));
        void chat.sendMessage({
          text: transcript,
          metadata: metaPayload as unknown as Record<string, unknown>,
        });
      } catch (err) {
        revokeVoicePhotos();
        setPendingVoice((m) => m.filter((msg) => msg.id !== userMsg.id));
        console.warn('voice_send_failed', err);
      } finally {
        setTranscribing(false);
      }
    },
    [chat, ensureThread, sdkStreaming, transcribing],
  );

  const reset = useCallback(() => {
    for (const m of chat.messages) {
      const vm = vitrinaVoiceFromMessage(m);
      if (vm?.voiceUrl) URL.revokeObjectURL(vm.voiceUrl);
      vm?.photoUrls?.forEach((u) => {
        if (u.startsWith('blob:')) URL.revokeObjectURL(u);
      });
    }
    for (const p of pendingVoiceRef.current) {
      if (p.voiceUrl) URL.revokeObjectURL(p.voiceUrl);
      p.photoUrls?.forEach((u) => {
        if (u.startsWith('blob:')) URL.revokeObjectURL(u);
      });
    }
    chat.setMessages([]);
    threadIdRef.current = null;
    setThreadId(null);
    clearActiveThreadId();
    setPendingVoice([]);
    setThreadHistoryLoaded(true);
    textSendQueueRef.current = [];
  }, [chat]);

  const messages = useMemo<ChatMessage[]>(() => {
    let lastStreamingAssistantId: string | null = null;
    if (sdkStreaming) {
      for (let i = chat.messages.length - 1; i >= 0; i -= 1) {
        const u = chat.messages[i];
        if (u && u.role === 'assistant') {
          lastStreamingAssistantId = u.id;
          break;
        }
      }
    }
    const mapped: ChatMessage[] = [];
    for (const m of chat.messages) {
      if (m.role !== 'user' && m.role !== 'assistant') continue;
      const vm = m.role === 'user' ? vitrinaVoiceFromMessage(m) : undefined;
      const recipeAttachment = m.role === 'user' ? vitrinaRecipeFromMessage(m) : undefined;
      const fromParts = m.role === 'user' ? imagePartUrlsFromMessage(m) : [];
      const photoUrls =
        fromParts.length > 0 ? fromParts : vm?.photoUrls && vm.photoUrls.length > 0 ? vm.photoUrls : undefined;
      const w = m.role === 'assistant' ? widgetsFromParts(m) ?? [] : [];
      const text = m.role === 'user' ? (vm?.transcript ?? textFromParts(m)) : textFromParts(m);
      const showThinking =
        m.role === 'assistant' &&
        sdkStreaming &&
        m.id === lastStreamingAssistantId &&
        !text.trim() &&
        w.length === 0;
      mapped.push({
        id: m.id,
        role: m.role,
        content: text,
        pending: showThinking,
        widgets: w,
        photoUrls,
        recipeAttachment,
        isVoice: Boolean(vm),
        voiceUrl: vm?.voiceUrl,
        voiceDuration: vm?.voiceDuration,
        waveform: vm?.waveform,
        transcript: vm?.transcript,
      });
    }
    const sdkIds = new Set(mapped.map((m) => m.id));
    return [...mapped, ...pendingVoice.filter((m) => !sdkIds.has(m.id))];
  }, [chat.messages, pendingVoice, sdkStreaming]);

  return {
    messages,
    threadId,
    streaming: sdkStreaming || transcribing,
    send,
    sendVoice,
    reset,
    threadHistoryLoaded,
  };
}
