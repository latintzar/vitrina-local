/**
 * Global "open basket sheet" bus — mirrors recipeViewer so chat widgets
 * can open BasketSheet without prop-drilling through ChatWidgetRenderer.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

export function openBasket(): void {
  for (const fn of listeners) fn();
}

export function subscribeBasketOpen(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
