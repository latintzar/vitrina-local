import type { UIMessage } from 'ai';

/** Voice payload stored on user message `metadata` (Leo casa parity). */
export type VitrinaVoicePayload = {
  /** Blob/object URL for same-session playback. It is not available after reload. */
  voiceUrl?: string;
  voiceDuration: number;
  waveform: number[];
  transcript: string;
  /** Object URLs from staged photos sent with the voice note */
  photoUrls?: string[];
};

/**
 * Recipe-context payload attached to a user message — rendered as a
 * small "preview card" above the user bubble (thumbnail + title), so
 * when Peter taps "Add to Basket" or "Modify recipe" the chat sees
 * exactly which video he's talking about. The agent can also read the
 * attached title/id from metadata to keep the conversation grounded.
 */
export type VitrinaRecipeAttachment = {
  thumbnailUrl: string | null;
  recipeTitle: string;
  recipeId?: string | null;
};

export type VitrinaMessageMetadata = {
  vitrinaVoice?: VitrinaVoicePayload;
  vitrinaRecipe?: VitrinaRecipeAttachment;
};

export function imagePartUrlsFromMessage(m: UIMessage): string[] {
  if (m.role !== 'user') return [];
  return m.parts
    .filter(
      (p): p is { type: 'file'; url: string; mediaType: string } =>
        p.type === 'file' &&
        'url' in p &&
        typeof (p as { url?: string }).url === 'string' &&
        'mediaType' in p &&
        typeof (p as { mediaType?: string }).mediaType === 'string' &&
        (p as { mediaType: string }).mediaType.startsWith('image/'),
    )
    .map((p) => p.url);
}

export function vitrinaVoiceFromMessage(m: UIMessage): VitrinaVoicePayload | undefined {
  if (m.role !== 'user') return undefined;
  const md = (m as UIMessage & { metadata?: VitrinaMessageMetadata }).metadata;
  return md?.vitrinaVoice;
}

export function vitrinaRecipeFromMessage(m: UIMessage): VitrinaRecipeAttachment | undefined {
  if (m.role !== 'user') return undefined;
  const md = (m as UIMessage & { metadata?: VitrinaMessageMetadata }).metadata;
  return md?.vitrinaRecipe;
}
