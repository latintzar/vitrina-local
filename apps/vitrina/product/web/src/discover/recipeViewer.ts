/**
 * Tiny event bus for opening the global recipe modal.
 *
 * Both the Discover grid and the chat `RecipeWidget` need to open the
 * same full-screen recipe modal (cover hero + ingredients by shop +
 * sticky add-to-basket). Rather than threading a callback through every
 * component, we mount the modal once at `App.tsx` level, subscribe to
 * this bus, and let any surface call `openRecipe(detail)`.
 */

import { getRecipeVideo, type RecipeVideoDetail } from './recipeVideosApi';

type Listener = (detail: RecipeVideoDetail) => void;

const listeners = new Set<Listener>();

export function openRecipe(detail: RecipeVideoDetail) {
  for (const fn of listeners) fn(detail);
}

export function subscribeRecipeViewer(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/**
 * Fetch a recipe by id and open the global modal — same surface that
 * Discover hands off to. Used by the basket and order pages so that
 * the "See recipe" button on a recipe group shows the in-app recipe
 * view (video + ingredients by shop + add-to-basket) instead of
 * deep-linking to the original TikTok/Instagram URL.
 */
export async function openRecipeById(videoId: string): Promise<void> {
  const detail = await getRecipeVideo(videoId);
  openRecipe(detail);
}
