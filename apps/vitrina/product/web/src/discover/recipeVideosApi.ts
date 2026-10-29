import { getCachedSession, getSupabase, waitForSessionPrime } from '../auth/supabaseClient';
import { getAnonCartKey } from '../chat/threadsApi';

export type RecipeVideoSource = 'TikTok' | 'Instagram' | 'YouTube' | 'Facebook' | 'Web';

export interface RecipeIngredient {
  quantity?: number | string | null;
  units?: string | null;
  description: string;
  confidence?: number;
  evidence?: string;
}

export interface RecipeStep {
  step: number;
  text: string;
  evidence?: string;
}

export interface RecipeProduct {
  id: string;
  shop_id: string;
  name: string;
  description?: string;
  category?: string;
  unit?: string;
  unit_size?: string;
  price_eur: number;
  price_minor?: number;
  image_url?: string;
}

export interface RecipeShopCard {
  id: string;
  name: string;
  trade?: string;
  address?: string;
  lat?: number;
  lng?: number;
  distance_km?: number;
  walking_minutes?: number;
}

export interface RecipeStockItem {
  ingredient?: string;
  quantity?: string | number | null;
  quantity_recipe?: string | number | null;
  quantity_purchase?: string | null;
  quantity_g?: number | string | null;
  pack_grams?: number | string | null;
  product: RecipeProduct;
  substitution?: string | null;
  confidence?: number | null;
}

export interface RecipeStockGroup {
  shop: RecipeShopCard;
  items: RecipeStockItem[];
  subtotal_eur?: number;
  subtotal_minor?: number;
}

export interface RecipeMatchGap {
  ingredient: string;
  blocking: boolean;
  suggestion?: string | null;
}

export type RecipeFeasibility = 'full' | 'partial' | 'infeasible' | 'unknown';

export interface RecipeMatch {
  feasibility: RecipeFeasibility;
  summary?: string;
  shop_groups: RecipeStockGroup[];
  missing: RecipeMatchGap[];
  blockers: RecipeMatchGap[];
  total_eur?: number;
  total_minor?: number;
  currency?: string;
  catchment_km?: number | null;
  expanded_to_km?: number | null;
  user_pin?: { lat: number; lng: number } | null;
  computed_at?: string;
  model_meta?: { model: string; ms: number; input_tokens?: number; output_tokens?: number };
}

export interface RecipeVideoMedia {
  thumbnail_url?: string;
  /** Path to the locally-pinned MP4 (e.g. `/recipe-videos/<id>/source.mp4`).
   *  When present, the embed renders a native `<video autoplay muted
   *  playsinline loop>` instead of the platform iframe — sidesteps both
   *  the "no autoplay on iOS" and the "TikTok shows a random For You
   *  clip" failure modes. */
  video_url?: string;
  duration_seconds?: number;
  width?: number;
  height?: number;
  view_count?: number;
  uploader?: string;
}

export interface RecipeVideoSummary {
  id: string;
  sort: number;
  source: RecipeVideoSource;
  source_id: string;
  source_url: string;
  creator: string;
  title: string;
  status: 'processed' | 'failed';
  summary: string;
  recipe_title: string;
  ingredient_preview: string[];
  feasibility?: RecipeFeasibility;
  media?: RecipeVideoMedia;
}

export interface RecipeVideoDetail extends RecipeVideoSummary {
  recipe: {
    title?: string;
    description?: string;
    source_url?: string;
    source_platform?: string;
    ingredients?: RecipeIngredient[];
    directions?: RecipeStep[];
    equipment?: string[];
    tips?: string[];
    unknowns?: string[];
    confidence?: number;
    servings?: { quantity?: number | null; unit?: string; evidence?: string };
    [key: string]: unknown;
  };
  stock_groups: RecipeStockGroup[];
  match?: RecipeMatch | null;
}

function apiBase() {
  return import.meta.env.VITE_VITRINA_API_URL || '/api';
}

async function userHeaders(): Promise<Record<string, string>> {
  // Stamps `X-User-Id` from the Supabase session so the backend can
  // bias Discover toward creators this user has personally shared.
  // Unauthenticated requests just omit the header — backend treats it
  // as a global feed.
  if (!getSupabase()) return {};
  try {
    await waitForSessionPrime();
    const uid = getCachedSession()?.user?.id;
    return uid ? { 'X-User-Id': uid } : {};
  } catch {
    return {};
  }
}

async function req<T>(path: string): Promise<T> {
  const headers = await userHeaders();
  const res = await fetch(`${apiBase()}${path}`, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return (await res.json()) as T;
}

export interface RecipeListOptions {
  lat?: number;
  lng?: number;
  catchmentKm?: number;
}

function buildMatchQuery(opts: RecipeListOptions | undefined): string {
  if (!opts) return '';
  const parts: string[] = [];
  if (typeof opts.lat === 'number' && typeof opts.lng === 'number') {
    parts.push(`lat=${opts.lat}`, `lng=${opts.lng}`);
  }
  if (typeof opts.catchmentKm === 'number') parts.push(`catchment_km=${opts.catchmentKm}`);
  return parts.length ? `&${parts.join('&')}` : '';
}

export async function listRecipeVideos(
  cursor = 0,
  limit = 20,
  seed?: number,
  opts?: RecipeListOptions,
): Promise<{
  videos: RecipeVideoSummary[];
  next_cursor: number | null;
  total: number;
  seed?: number | null;
  catchment_km?: number | null;
  filtered_by_prematch?: boolean;
}> {
  const seedSuffix = seed === undefined ? '' : `&seed=${seed}`;
  const matchSuffix = buildMatchQuery(opts);
  // device_id ties this request to a (device, recipe) prematch row when
  // the user has provided a location. The backend joins user_recipe_matches
  // and only returns rows whose status is `resolved`. See plan C3.
  const deviceSuffix = `&device_id=${encodeURIComponent(getAnonCartKey())}`;
  return await req<{
    videos: RecipeVideoSummary[];
    next_cursor: number | null;
    total: number;
    seed?: number | null;
    catchment_km?: number | null;
    filtered_by_prematch?: boolean;
  }>(`/recipe-videos?cursor=${cursor}&limit=${limit}${seedSuffix}${deviceSuffix}${matchSuffix}`);
}

export interface PrematchStatus {
  total: number;
  resolved: number;
  skipped: number;
  failed: number;
  queued: number;
  running: number;
}

/** Kick off the per-device prematch worker. Server returns 202 immediately. */
export async function kickoffPrematch(
  lat: number,
  lng: number,
  catchmentKm?: number,
): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await userHeaders()),
  };
  const res = await fetch(`${apiBase()}/recipe-videos/prematch`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      device_id: getAnonCartKey(),
      lat,
      lng,
      catchment_km: catchmentKm,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status}: ${body}`);
  }
}

export async function getPrematchStatus(): Promise<PrematchStatus> {
  const headers: Record<string, string> = await userHeaders();
  const res = await fetch(
    `${apiBase()}/recipe-videos/prematch/status?device_id=${encodeURIComponent(getAnonCartKey())}`,
    { headers },
  );
  if (!res.ok) {
    return { total: 0, resolved: 0, skipped: 0, failed: 0, queued: 0, running: 0 };
  }
  return (await res.json()) as PrematchStatus;
}

/** Best-effort Mem0 graph edge for liked / unliked recipes (requires auth + server Mem0). */
export async function postRecipeLikeMem0(payload: {
  video_id: string;
  liked: boolean;
  title?: string;
  creator?: string;
  source_url?: string;
}): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await userHeaders()),
  };
  const res = await fetch(`${apiBase()}/recipe-videos/like`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status}: ${body}`);
  }
}

export async function getRecipeVideo(
  videoId: string,
  opts?: RecipeListOptions,
): Promise<RecipeVideoDetail> {
  const matchSuffix = buildMatchQuery(opts).replace(/^&/, '?');
  return await req(`/recipe-videos/${encodeURIComponent(videoId)}${matchSuffix}`);
}

/**
 * Resolve a thumbnail URL for a recipe video to an absolute path.
 *
 * The backend serves committed cover JPGs at `/recipe-videos/{id}/cover.jpg`;
 * this helper joins them with the configured API base so the same component
 * works with both the bundled fallback (relative to /api) and a live API.
 */
/**
 * Match any URL anywhere in a chat message.
 *
 * The chat transport uses this to detect when a user pastes a recipe
 * link so we can synchronously extract it via POST /recipe-videos/extract
 * and render an inline RecipeWidget. We accept any URL, not just
 * TikTok/Instagram — the backend decides whether the link is a video
 * (yt-dlp covers TikTok, Instagram, YouTube, Facebook, and many more)
 * or a written recipe page (article scrape + LLM extraction).
 *
 * Heuristic: any http(s) URL. The backend rejects URLs it can't handle
 * with a 4xx so the widget simply doesn't appear.
 */
const URL_RE = /(https?:\/\/[^\s)]+)/i;

export function detectRecipeUrl(text: string): string | null {
  const match = text.match(URL_RE);
  if (!match) return null;
  const url = match[1].replace(/[.,;!?]+$/, '');
  return url;
}

export async function extractRecipeVideo(url: string): Promise<RecipeVideoDetail> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await userHeaders()),
  };
  const res = await fetch(`${apiBase()}/recipe-videos/extract`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return (await res.json()) as RecipeVideoDetail;
}

/**
 * Resolve the *committed* video poster (curated/upstream thumbnail).
 *
 * 2026-04-27: Peter — "Make sure thumbnails are the video thumbnails
 * and not the first video frame, which isn't thumbnailable."
 *
 * Strategy:
 *   1. ALWAYS prefer the local cover endpoint (`/recipe-videos/{id}/cover.jpg`)
 *      — that file is the curated poster (TikTok/IG/YouTube cover) that
 *      our ingest pipeline pinned at upload time. Local-cached, never
 *      expires, never falls back to a video frame.
 *   2. If the backend's metadata explicitly carries an absolute upstream
 *      thumbnail URL (legacy), use that as a secondary signal — but
 *      prefer the local-cached path because upstream URLs are signed
 *      with ~36h TTL.
 *
 * The element-level onError handler in the card swaps to the alt URL
 * if the primary 404s.
 */
export function thumbnailUrl(video: RecipeVideoSummary): string | null {
  if (!video?.id) return null;
  return `/demo-cover.svg`;
}

/** Resolve the locally-pinned MP4 URL (absolute), or null if we don't
 *  have one for this video. The frontend prefers this over the platform
 *  iframe whenever it exists. */
export function localVideoUrl(video: RecipeVideoSummary): string | null {
  const path = video?.media?.video_url;
  if (!path) return null;
  if (/^https?:/i.test(path)) return path;
  return `${apiBase()}${path}`;
}

/** Fallback URL if the local cover.jpg 404s — usually the upstream signed URL. */
export function thumbnailFallbackUrl(video: RecipeVideoSummary): string | null {
  const path = video.media?.thumbnail_url;
  if (!path) return null;
  if (/^https?:/i.test(path)) return path;
  return `${apiBase()}${path}`;
}
