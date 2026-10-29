/**
 * Navigate to Browse and open a specific shop's storefront.
 * App.tsx wires the listener; BrowsePage consumes `focusShop`.
 */

import type { Shop } from '../api/types';

type Listener = (shop: Shop) => void;

const listeners = new Set<Listener>();

export function openShopInBrowse(shop: Shop): void {
  for (const fn of listeners) fn(shop);
}

export function subscribeShopNavigator(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
