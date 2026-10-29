/**
 * RecipeAttachmentChip — small "I'm talking about THIS recipe" preview
 * card that sits above the user bubble in the chat.
 *
 * When `recipeId` is present (Add to basket / Modify recipe handoffs),
 * tapping opens the same full-screen recipe modal as Discover.
 */

import { useCallback, useState } from 'react';
import { getRecipeVideo } from '../discover/recipeVideosApi';
import { openRecipe } from '../discover/recipeViewer';
import type { VitrinaRecipeAttachment } from './uiMessageExtras';

function ChipInner({ attachment }: { attachment: VitrinaRecipeAttachment }) {
  const { thumbnailUrl, recipeTitle } = attachment;
  return (
    <>
      <div className="vitrina-recipe-chip__thumb" aria-hidden>
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt="" loading="lazy" />
        ) : (
          <span className="vitrina-recipe-chip__mono">
            {(recipeTitle || '?').trim().charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <span className="vitrina-recipe-chip__title">{recipeTitle}</span>
    </>
  );
}

export function RecipeAttachmentChip({ attachment }: { attachment: VitrinaRecipeAttachment }) {
  const { recipeTitle, recipeId } = attachment;
  const [busy, setBusy] = useState(false);

  const onOpen = useCallback(async () => {
    if (!recipeId) return;
    setBusy(true);
    try {
      const detail = await getRecipeVideo(recipeId);
      openRecipe(detail);
    } catch {
      // Silent fail — chip still reads as context for the thread.
    } finally {
      setBusy(false);
    }
  }, [recipeId]);

  const sharedStyle = `
        .vitrina-recipe-chip {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 6px 12px 6px 6px;
          margin-bottom: 6px;
          border-radius: 6px;
          background: color-mix(in srgb, var(--color-ink) 5%, transparent);
          align-self: flex-end;
          max-width: 260px;
        }
        .vitrina-recipe-chip--btn {
          border: 0;
          cursor: pointer;
          font: inherit;
          color: inherit;
          text-align: left;
        }
        .vitrina-recipe-chip--btn:disabled {
          cursor: wait;
          opacity: 0.88;
        }
        .vitrina-recipe-chip__thumb {
          width: 44px;
          height: 56px;
          border-radius: 6px;
          overflow: hidden;
          flex-shrink: 0;
          background: color-mix(in srgb, var(--color-ink) 10%, transparent);
          display: grid;
          place-items: center;
        }
        .vitrina-recipe-chip__thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .vitrina-recipe-chip__mono {
          font-family: var(--font-display);
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-ink-light);
        }
        .vitrina-recipe-chip__title {
          font-family: var(--font-display);
          font-size: 0.86rem;
          font-weight: 600;
          color: var(--color-ink);
          line-height: 1.25;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
      `;

  if (recipeId) {
    return (
      <button
        type="button"
        className="vitrina-recipe-chip vitrina-recipe-chip--btn"
        aria-label={`Open recipe: ${recipeTitle}`}
        disabled={busy}
        onClick={() => void onOpen()}
      >
        <ChipInner attachment={attachment} />
        <style>{sharedStyle}</style>
      </button>
    );
  }

  return (
    <div className="vitrina-recipe-chip" aria-label={`Recipe context: ${recipeTitle}`}>
      <ChipInner attachment={attachment} />
      <style>{sharedStyle}</style>
    </div>
  );
}
