/**
 * Tiny event bus for "inject this prompt into chat".
 *
 * Used by chat-rendered widgets (RecipeWidget "Add to basket",
 * StretchCard "Add stretch recipe") so they can post structured
 * prompts back into the live chat without prop-drilling a callback
 * through the SSE renderer chain. The chat tab's send helper listens
 * for this event and calls `chat.sendMessage` directly.
 */

import type { VitrinaRecipeAttachment } from './uiMessageExtras';

const EVENT_NAME = 'vitrina:chat-prompt';

export type ChatPromptDetail =
  | string
  | { prompt: string; attachment?: VitrinaRecipeAttachment | null };

export function postChatPrompt(detail: ChatPromptDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
}

export function subscribeChatPrompt(
  handler: (prompt: string, attachment?: VitrinaRecipeAttachment | null) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const fn = (e: Event) => {
    const detail = (e as CustomEvent<ChatPromptDetail>).detail;
    if (typeof detail === 'string') {
      if (detail) handler(detail, undefined);
      return;
    }
    if (detail && typeof detail === 'object' && 'prompt' in detail) {
      const p = (detail as { prompt: string }).prompt;
      if (typeof p === 'string' && p) {
        handler(p, (detail as { attachment?: VitrinaRecipeAttachment | null }).attachment ?? null);
      }
    }
  };
  window.addEventListener(EVENT_NAME, fn);
  return () => window.removeEventListener(EVENT_NAME, fn);
}
