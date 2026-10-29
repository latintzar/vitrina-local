/**
 * ChatPage — sidebar + message thread + composer.
 *
 * Warm mobile-app chat surface with a bottom composer. It can also
 * accept a queued prompt from another tab, e.g. "build a basket from
 * this real creator video".
 */

import { useEffect, useRef, useState } from 'react';
import { LeoBubble, UserBubble } from '@scope/ui';
import { ChatPhotoThumbnails } from './ChatPhotoThumbnails';
import { RecipeAttachmentChip } from './RecipeAttachmentChip';
import { VitrinaVoiceBubble } from './VitrinaVoiceBubble';
import { useAuth } from '../auth/useAuth';
import { Composer } from './Composer';
import { Landing } from './Landing';
import { useVitrinaChat } from './useVitrinaChat';
import type { VitrinaRecipeAttachment } from './uiMessageExtras';
import { ChatWidgetRenderer } from './widgets/registry';
import { DoodleSpinner } from '../discover/DiscoverLoadingScreen';

export type QueuedChatHandoff = { prompt: string; attachment: VitrinaRecipeAttachment | null };

export function ChatPage({
  onFirstSend,
  queuedHandoff,
  onQueuedHandoffConsumed,
  isActive = true,
}: {
  onFirstSend?: () => boolean | Promise<boolean>;
  queuedHandoff?: QueuedChatHandoff | null;
  onQueuedHandoffConsumed?: () => void;
  /** True when the Chat tab is the active surface. ChatPage stays
   *  mounted across tab changes (so SSE streams survive); we use this
   *  flag to refetch thread history when the user returns to the tab
   *  so the latest messages are always visible. */
  isActive?: boolean;
}) {
  const { user } = useAuth();
  const { messages, streaming, send, sendVoice, threadHistoryLoaded } = useVitrinaChat({
    userId: user?.id,
    isActive,
  });
  const endRef = useRef<HTMLDivElement | null>(null);

  // Optimistic user bubble.
  //
  // When the user taps "Add to Basket" we set a queued prompt + flip to
  // the chat tab in the SAME React batch. ChatPage mounts; the AI SDK's
  // sendMessage is fired from a useEffect AFTER first paint, so the
  // very first frame would otherwise show the Landing screen for one
  // tick before the user bubble lands. We mirror the queued prompt
  // into local state synchronously (lazy initialiser) so the thread
  // shell renders WITH the user's message on the first frame, with no
  // Landing flash. The optional recipe attachment piggybacks here too
  // so the preview chip lands on the same frame as the bubble.
  const [optimisticUser, setOptimisticUser] = useState<{
    text: string;
    attachment?: VitrinaRecipeAttachment | null;
  } | null>(
    queuedHandoff?.prompt?.trim()
      ? { text: queuedHandoff.prompt, attachment: queuedHandoff.attachment ?? null }
      : null,
  );

  const handoffDrainLock = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // "Still on it…" doodle gate.
  //
  // We want the puff to appear immediately while the assistant is
  // streaming so the user sees we're working from t=0, not 10 s in.
  // Widgets still suppress it since they carry their own content,
  // and we hide the puff only briefly while text is actively growing
  // (so it doesn't crowd a live token stream).
  const lastAssistantText =
    messages.length && messages[messages.length - 1]?.role === 'assistant'
      ? messages[messages.length - 1]?.content ?? ''
      : '';
  const lastAssistantWidgetCount =
    messages.length && messages[messages.length - 1]?.role === 'assistant'
      ? messages[messages.length - 1]?.widgets?.length ?? 0
      : 0;
  const lastTextSnapshot = useRef({ len: lastAssistantText.length, at: Date.now() });
  if (lastAssistantText.length !== lastTextSnapshot.current.len) {
    lastTextSnapshot.current = { len: lastAssistantText.length, at: Date.now() };
  }
  const [, setDoodleTick] = useState(0);
  // Track when each streaming run started so the "Still on it…" label
  // only appears after a meaningful wait. Peter asked for ≥10 s
  // before showing the label — anything shorter reads as the agent
  // having stalled, even when responses are arriving in 2–4 s on a
  // fast network.
  const streamStartedAt = useRef<number | null>(null);
  useEffect(() => {
    if (!streaming) {
      streamStartedAt.current = null;
      return;
    }
    if (streamStartedAt.current == null) streamStartedAt.current = Date.now();
    const id = window.setInterval(() => setDoodleTick((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, [streaming]);
  const showStillOnItLabel =
    streaming &&
    streamStartedAt.current != null &&
    Date.now() - streamStartedAt.current >= 10_000;
  const sinceLastText = Date.now() - lastTextSnapshot.current.at;
  const shouldShowFollowupDoodle =
    streaming &&
    messages.length > 0 &&
    messages[messages.length - 1]?.role === 'assistant' &&
    lastAssistantWidgetCount === 0 &&
    (!lastAssistantText.trim() || sinceLastText > 600);

  // Wait for server history before treating the thread as "new" — otherwise
  // reopening chat briefly shows Landing while listThreadMessages is in flight.
  const isEmpty = messages.length === 0 && !optimisticUser && threadHistoryLoaded;

  // Prior turns must land BEFORE the new user message so the chat doesn't
  // look like a fresh thread for 5–10 s after a tab switch. We wait up to
  // 2 s for hydration; offline / cold-start always sends after the timeout.
  const threadHistoryLoadedRef = useRef(threadHistoryLoaded);
  threadHistoryLoadedRef.current = threadHistoryLoaded;
  const waitForHistory = async () => {
    if (threadHistoryLoadedRef.current) return;
    await new Promise<void>((resolve) => {
      const start = Date.now();
      const id = window.setInterval(() => {
        if (threadHistoryLoadedRef.current || Date.now() - start > 2000) {
          window.clearInterval(id);
          resolve();
        }
      }, 50);
    });
  };

  const handleSend = async (
    text: string,
    photoFiles?: File[],
    attachment?: VitrinaRecipeAttachment | null,
  ) => {
    if (isEmpty) {
      const ok = await onFirstSend?.();
      if (ok === false) return;
    }
    await waitForHistory();
    await send(text, photoFiles, attachment);
  };

  const handleSendVoice = async (
    blob: Blob,
    duration: number,
    waveform: number[],
    photoFiles?: File[],
  ) => {
    if (isEmpty) {
      const ok = await onFirstSend?.();
      if (ok === false) return;
    }
    await waitForHistory();
    await sendVoice(blob, duration, waveform, photoFiles);
  };

  useEffect(() => {
    const prompt = queuedHandoff?.prompt?.trim();
    if (!prompt || streaming || handoffDrainLock.current) return;
    const attachment = queuedHandoff?.attachment ?? null;
    handoffDrainLock.current = true;
    setOptimisticUser({ text: prompt, attachment });
    void (async () => {
      try {
        await handleSend(prompt, undefined, attachment ?? undefined);
      } finally {
        onQueuedHandoffConsumed?.();
        handoffDrainLock.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queuedHandoff, streaming]);

  // Clear the optimistic bubble once the SDK has appended the real
  // user message (or any user message with the same content).
  useEffect(() => {
    if (!optimisticUser) return;
    if (messages.some((m) => m.role === 'user' && m.content === optimisticUser.text)) {
      setOptimisticUser(null);
    }
  }, [messages, optimisticUser]);

  if (isEmpty) {
    return <Landing onSend={handleSend} onSendVoice={handleSendVoice} disabled={streaming} />;
  }

  const showHistorySpinner = !threadHistoryLoaded && messages.length === 0 && !optimisticUser;

  return (
    <div className="vitrina-chat-page">
      <div className="vitrina-chat-thread">
        {showHistorySpinner ? (
          <div className="vitrina-chat-history-loading" aria-busy="true" aria-label="Loading messages">
            <DoodleSpinner size={44} />
          </div>
        ) : null}
        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="vitrina-user-msg-col">
              {m.recipeAttachment ? <RecipeAttachmentChip attachment={m.recipeAttachment} /> : null}
              {m.photoUrls?.length ? <ChatPhotoThumbnails urls={m.photoUrls} /> : null}
              {m.isVoice ? (
                <VitrinaVoiceBubble
                  durationSec={m.voiceDuration ?? 0}
                  waveform={m.waveform}
                  transcript={m.transcript || m.content}
                  audioUrl={m.voiceUrl}
                />
              ) : (
                <UserBubble text={m.content} />
              )}
            </div>
          ) : (
            <div key={m.id} className="vitrina-assistant-message">
              {m.content ? (
                <LeoBubble text={m.content} />
              ) : m.pending ? (
                <div className="vitrina-thinking">
                  <DoodleSpinner size={44} />
                </div>
              ) : null}
              {m.widgets?.map((widget, index) => (
                <div key={`${widget.type}-${index}`} className="vitrina-chat-widget-slot">
                  <ChatWidgetRenderer widget={widget} />
                </div>
              ))}
            </div>
          ),
        )}
        {/* Optimistic bubble visible until the SDK push lands. */}
        {optimisticUser &&
        !messages.some((m) => m.role === 'user' && m.content === optimisticUser.text) ? (
          <div className="vitrina-user-msg-col">
            {optimisticUser.attachment ? (
              <RecipeAttachmentChip attachment={optimisticUser.attachment} />
            ) : null}
            <UserBubble text={optimisticUser.text} />
          </div>
        ) : null}
        {/*
          Thread-end doodle: after the user's message while waiting for the
          first assistant token, or follow-up "still working" per shouldShowFollowupDoodle.
          Do NOT duplicate the inline assistant placeholder spinner (empty assistant
          bubble while tokens haven't arrived yet) — that already shows DoodleSpinner.
        */}
        {(() => {
          const last = messages.length ? messages[messages.length - 1] : null;
          const inlineAssistantThinking =
            Boolean(streaming) &&
            last?.role === 'assistant' &&
            !String(last.content ?? '').trim();
          const showEndDoodle =
            (((streaming || optimisticUser) &&
              (messages.length === 0 || messages[messages.length - 1]?.role === 'user')) ||
              shouldShowFollowupDoodle) &&
            !inlineAssistantThinking;
          return showEndDoodle ? (
          <div className="vitrina-assistant-message vitrina-assistant-followup">
            <div className="vitrina-thinking">
              <DoodleSpinner size={44} />
              {showStillOnItLabel ? (
                <span className="vitrina-thinking-label">Still on it…</span>
              ) : null}
            </div>
          </div>
          ) : null;
        })()}
        <div ref={endRef} />
      </div>

      <div className="vitrina-chat-composer-wrap">
        <Composer
          onSend={handleSend}
          onSendVoice={handleSendVoice}
          disabled={streaming}
          inThread
        />
      </div>

      <style>{`
        .vitrina-chat-page {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: calc(100dvh - 142px);
          max-width: 820px;
          margin: 0 auto;
          padding: 86px 20px 92px 20px;
          width: 100%;
          box-sizing: border-box;
        }
        .vitrina-chat-history-loading {
          display: flex;
          justify-content: center;
          padding: 32px 0 24px;
          opacity: 0.85;
        }
        .vitrina-chat-thread {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 10px;
          overflow-y: auto;
          /* Space above fixed composer + bottom nav so the last bubble isn’t flush on the input. */
          padding-bottom: max(28px, calc(152px + env(safe-area-inset-bottom, 0px)));
        }
        .vitrina-user-msg-col {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
        }
        .vitrina-assistant-message {
          display: grid;
          gap: 8px;
          justify-items: start;
        }
        /* Widgets shouldn't be squashed to min-content — let them
           breathe across the column up to a comfortable max so
           summaries (basket lines, recipe rows) read clearly. Text
           bubbles keep their natural width. */
        .vitrina-chat-widget-slot {
          justify-self: stretch;
          width: 100%;
          max-width: 460px;
          display: block;
        }
        .vitrina-chat-widget-slot > * {
          width: 100%;
          box-sizing: border-box;
        }
        .vitrina-thinking {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 4px 0 8px;
          opacity: 0.85;
        }
        .vitrina-thinking-label {
          font-size: 0.82rem;
          color: var(--color-ink-light);
          font-weight: 500;
        }
        .vitrina-assistant-followup {
          margin-top: -4px;
        }
        .vitrina-chat-composer-wrap {
          position: fixed;
          left: 50%;
          /* Sits above the bottom-nav (tab bar is ~58px tall including icon +
             label + top-padding). 68px gives a clear visual gap so the
             composer never clips the nav icons. When the soft keyboard opens,
             App.tsx adds .vitrina-keyboard-open, the nav slides off, and
             the composer drops to bottom: 0 to dock flush above the keyboard. */
          bottom: calc(68px + env(safe-area-inset-bottom, 0px));
          z-index: 30;
          width: min(820px, calc(100vw - 28px));
          transform: translateX(-50%);
          padding: 0;
          transition: bottom 180ms ease;
        }
        .vitrina-chat-composer-wrap::before {
          content: '';
          position: absolute;
          left: 50%;
          bottom: -12px;
          width: 100vw;
          /* Hugs the input — fade ramps in just above the composer instead
             of bleeding ~110px up into the thread. */
          height: 64px;
          transform: translateX(-50%);
          pointer-events: none;
          z-index: 0;
          background:
            linear-gradient(
              to bottom,
              color-mix(in srgb, var(--color-cream) 0%, transparent) 0%,
              color-mix(in srgb, var(--color-cream) 60%, transparent) 55%,
              var(--color-cream) 100%
            );
          backdrop-filter: blur(7px);
          -webkit-backdrop-filter: blur(7px);
          mask-image: linear-gradient(to bottom, transparent 0%, black 50%, black 100%);
          -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 50%, black 100%);
        }
        .vitrina-chat-composer-wrap > .vitrina-composer {
          position: relative;
          z-index: 1;
        }
        .vitrina-keyboard-open .vitrina-chat-composer-wrap {
          bottom: env(safe-area-inset-bottom, 0px);
        }
        .vitrina-chat-page .leo-chat-user {
          border-radius: 6px 6px 4px 6px;
          background: #2a2420;
          color: #f4ede1;
          box-shadow: 0 12px 30px -22px rgba(42, 36, 32, 0.8);
        }
        /* Assistant text — plain copy, no card. The user explicitly
           wanted Leo's responses to read like text, not a styled
           bubble. We keep some leading-line breathing room and a
           slightly warmer ink colour and that's it. */
        .vitrina-chat-page .leo-chat-leo {
          color: #3a2f26;
          background: transparent;
          border: 0;
          border-radius: 0;
          padding: 4px 0;
          box-shadow: none;
        }
      `}</style>
    </div>
  );
}
