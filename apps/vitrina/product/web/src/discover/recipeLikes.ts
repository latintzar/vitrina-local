/**
 * Local saved recipes (likes) + optional Mem0 sync via REST.
 *
 * Source of truth for the Saved tab is localStorage so the grid works
 * offline. When the user is signed in and the API has Mem0 configured,
 * toggling also POSTs structured hints for future recommendation graphs.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { postRecipeLikeMem0 } from './recipeVideosApi';
import type { RecipeVideoDetail, RecipeVideoSummary } from './recipeVideosApi';

export const RECIPE_LIKES_EVENT = 'vitrina-recipe-likes-changed';
const STORAGE_KEY = 'vitrina_recipe_likes_v1';

export type StoredRecipeLike = {
  likedAt: string;
  summary: RecipeVideoSummary;
};

function readRaw(): Record<string, StoredRecipeLike> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, StoredRecipeLike>;
  } catch {
    return {};
  }
}

function writeRaw(next: Record<string, StoredRecipeLike>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(RECIPE_LIKES_EVENT));
  } catch {
    // quota / private mode — ignore
  }
}

export function toSummary(video: RecipeVideoSummary | RecipeVideoDetail): RecipeVideoSummary {
  if ('stock_groups' in video) {
    const d = video as RecipeVideoDetail;
    return {
      id: d.id,
      sort: d.sort,
      source: d.source,
      source_id: d.source_id,
      source_url: d.source_url,
      creator: d.creator,
      title: d.title,
      status: d.status,
      summary: d.summary,
      recipe_title: d.recipe_title,
      ingredient_preview: d.ingredient_preview,
      feasibility: d.feasibility,
      media: d.media,
    };
  }
  return video as RecipeVideoSummary;
}

export function isRecipeLiked(videoId: string): boolean {
  return Boolean(readRaw()[videoId]);
}

export function listStoredLikes(): StoredRecipeLike[] {
  return Object.values(readRaw()).sort((a, b) => (a.likedAt < b.likedAt ? 1 : -1));
}

/** Merge feed rows with any saved summaries not currently in the feed (Saved tab). */
export function buildSavedOnlyFeed(
  feed: RecipeVideoSummary[],
  store: Record<string, StoredRecipeLike>,
): RecipeVideoSummary[] {
  const fromFeed = feed.filter((v) => store[v.id]);
  const seen = new Set(fromFeed.map((v) => v.id));
  const fromStore = Object.values(store)
    .filter((e) => !seen.has(e.summary.id))
    .sort((a, b) => (a.likedAt < b.likedAt ? 1 : -1))
    .map((e) => e.summary);
  return [...fromStore, ...fromFeed];
}

export function setRecipeLiked(
  video: RecipeVideoSummary | RecipeVideoDetail,
  liked: boolean,
): void {
  const summary = toSummary(video);
  const id = summary.id;
  const cur = readRaw();
  if (!liked) {
    if (!cur[id]) return;
    const { [id]: _, ...rest } = cur;
    writeRaw(rest);
    return;
  }
  writeRaw({
    ...cur,
    [id]: { likedAt: new Date().toISOString(), summary },
  });
}

export function useRecipeLikes() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener(RECIPE_LIKES_EVENT, on);
    return () => window.removeEventListener(RECIPE_LIKES_EVENT, on);
  }, []);

  const store = useMemo(() => readRaw(), [tick]);

  const likedSet = useMemo(() => new Set(Object.keys(store)), [store]);

  const isLiked = useCallback((id: string) => likedSet.has(id), [likedSet]);

  const toggle = useCallback((video: RecipeVideoSummary | RecipeVideoDetail, nextLiked: boolean) => {
    const summary = toSummary(video);
    setRecipeLiked(summary, nextLiked);
  }, []);

  return { store, likedSet, isLiked, toggle, tick };
}

/** Fire-and-forget Mem0 graph edge (no-op if API rejects or user anonymous). */
export function fireRecipeLikeMem0(video: RecipeVideoSummary | RecipeVideoDetail, liked: boolean): void {
  const s = toSummary(video);
  void postRecipeLikeMem0({
    video_id: s.id,
    liked,
    title: s.recipe_title || s.title,
    creator: s.creator,
    source_url: s.source_url,
  }).catch(() => {});
}
