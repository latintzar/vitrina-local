import { useState } from 'react';
import { localVideoUrl, type RecipeVideoSource, type RecipeVideoSummary } from './recipeVideosApi';

/**
 * Recipe video player.
 *
 * Two paths, in priority order:
 *
 *   1. **Self-hosted MP4** — when the backend has a pinned
 *      ``videos/<id>.mp4`` (see ``persist_video`` in extract), we render
 *      a plain ``<video autoplay muted playsinline loop>``. This sidesteps
 *      every iframe failure mode we kept hitting:
 *        - iOS Safari forbids cross-origin iframe autoplay regardless of
 *          ``allow="autoplay"`` and ``muted=1``;
 *        - TikTok's ``/embed/v2/{id}`` page silently swaps in a random
 *          "For You" clip when the original can't autoplay (this is why
 *          opening Molly Baz's BLP would play "Not Your Mama's Sunday
 *          Roast" instead);
 *        - Instagram's ``/p/{shortcode}/embed/`` page disables autoplay
 *          entirely and forces a tap-through to instagram.com.
 *      A native ``<video>`` autoplays on every modern browser as long as
 *      it's muted, has no platform overlays, and never serves the wrong
 *      clip.
 *
 *   2. **Platform iframe fallback** — when we don't yet have a local MP4
 *      (e.g. a brand-new shared URL whose extraction is queued). Same
 *      iframe shape we used before, with the original ``key={src}``
 *      unmount trick to kill audio when the modal closes.
 *
 * The ``video_url`` path is added by the backend on every newly-extracted
 * row and backfilled for existing rows by
 * ``recipe_videos/scripts/backfill_videos.py``.
 */
export interface RecipeEmbedProps {
  source: RecipeVideoSource;
  sourceUrl: string;
  sourceId: string;
  creator?: string;
  posterUrl?: string | null;
  /** Full backend video payload — we only need ``media.video_url``, but
   *  taking the whole row keeps the call site honest about which video
   *  we're rendering. */
  video?: Pick<RecipeVideoSummary, 'id' | 'media'> | null;
}

function instagramShortcode(sourceUrl: string, fallback: string): string {
  const match = sourceUrl.match(/instagram\.com\/(?:p|reel|reels|tv)\/([^/?#]+)/i);
  return match?.[1] ?? fallback;
}

export function RecipeEmbed({ source, sourceUrl, sourceId, posterUrl, video }: RecipeEmbedProps) {
  const localUrl = video ? localVideoUrl(video as RecipeVideoSummary) : null;
  const isPortrait = source === 'TikTok' || source === 'Instagram';

  // Track failed self-hosted URLs so we don't re-render the broken
  // <video> element on every state change. The catalog now emits an
  // absolute CDN URL for every row even when the MP4 isn't mirrored
  // (the deploy filters deliberately exclude the 160 MB videos
  // folder, and only ~14 of 40 are on the Hetzner CDN today). When
  // the CDN 404s, we drop the local URL and fall through to the
  // platform iframe — same fallback path we used before the CDN
  // existed, so the player keeps working until the rest of the
  // catalog is mirrored.
  const [localFailed, setLocalFailed] = useState(false);

  if (localUrl && !localFailed) {
    return (
      <div className="vitrina-recipe-embed">
        <video
          key={localUrl}
          className={`vitrina-recipe-embed__iframe ${isPortrait ? 'is-portrait' : 'is-landscape'}`}
          src={localUrl}
          poster={posterUrl ?? undefined}
          autoPlay
          muted
          loop
          playsInline
          controls
          preload="metadata"
          onError={() => setLocalFailed(true)}
        />
      </div>
    );
  }

  let iframeSrc: string | null = null;
  if (source === 'TikTok') {
    iframeSrc = `https://www.tiktok.com/embed/v2/${encodeURIComponent(sourceId)}?autoplay=1&muted=1`;
  } else if (source === 'Instagram') {
    const shortcode = instagramShortcode(sourceUrl, sourceId);
    iframeSrc = `https://www.instagram.com/p/${encodeURIComponent(shortcode)}/embed/`;
  } else if (source === 'YouTube') {
    iframeSrc = `https://www.youtube.com/embed/${encodeURIComponent(sourceId)}?autoplay=1&mute=1&playsinline=1`;
  }

  return (
    <div className="vitrina-recipe-embed">
      {posterUrl ? (
        <div className="vitrina-recipe-embed__poster" aria-hidden="true">
          <img src={posterUrl} alt="" loading="eager" />
        </div>
      ) : null}
      {iframeSrc ? (
        <iframe
          key={iframeSrc}
          className={`vitrina-recipe-embed__iframe ${isPortrait ? 'is-portrait' : 'is-landscape'}`}
          src={iframeSrc}
          title={`${source} recipe video`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
        />
      ) : sourceUrl ? (
        <a
          className="vitrina-recipe-embed__link"
          href={sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open original on {source}
        </a>
      ) : null}
    </div>
  );
}
