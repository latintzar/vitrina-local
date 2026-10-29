import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type TouchEvent,
} from 'react';
import { openRecipe } from './recipeViewer';
import { RecipeLikeButton } from './RecipeLikeButton';
import { buildSavedOnlyFeed, fireRecipeLikeMem0, useRecipeLikes } from './recipeLikes';
import {
  getPrematchStatus,
  getRecipeVideo,
  kickoffPrematch,
  listRecipeVideos,
  thumbnailUrl,
  thumbnailFallbackUrl,
  type PrematchStatus,
  type RecipeVideoDetail,
  type RecipeVideoSummary,
} from './recipeVideosApi';
import { DiscoverLoadingScreen, DoodleSpinner } from './DiscoverLoadingScreen';
import type { UserLocation } from '../location/useUserLocation';

type BuildBasketVideo = {
  source: RecipeVideoSummary['source'];
  title: string;
  url: string;
};

function iframeUrlFor(video: RecipeVideoSummary): string | null {
  switch (video.source) {
    case 'TikTok':
      return `https://www.tiktok.com/embed/v2/${encodeURIComponent(video.source_id)}`;
    case 'YouTube':
      return `https://www.youtube.com/embed/${encodeURIComponent(video.source_id)}`;
    case 'Instagram': {
      const m = (video.source_url || '').match(/instagram\.com\/(?:p|reel|reels|tv)\/([^/?#]+)/i);
      const code = m ? m[1] : video.source_id;
      return `https://www.instagram.com/p/${encodeURIComponent(code)}/embed/`;
    }
    default:
      return null;
  }
}

function prefetchIframe(url: string | null): void {
  // <link rel="prefetch" as="document"> is BLOCKED by CORS for the
  // TikTok / Instagram embed origins (no Access-Control-Allow-Origin
  // header, since the embed pages aren't served as fetchable docs by
  // those CDNs). Every hover used to spam the console with CORS errors.
  // dns-prefetch is harmless and gives us the same warm-up benefit
  // (DNS resolution + TLS warm-up before the iframe loads).
  if (!url || typeof document === 'undefined') return;
  let host: string;
  try {
    host = new URL(url).origin;
  } catch {
    return;
  }
  const existing = document.head.querySelector<HTMLLinkElement>(`link[data-vitrina-prefetch="${host}"]`);
  if (existing) return;
  const link = document.createElement('link');
  link.rel = 'dns-prefetch';
  link.href = host;
  link.setAttribute('data-vitrina-prefetch', host);
  document.head.appendChild(link);
}

const VISIBLE_BATCH_SIZE = 10;
const PREFETCH_BATCH_SIZE = 20;
const MIN_BUFFER_SIZE = 10;
const PULL_REFRESH_THRESHOLD = 72;

function locationOpts(loc?: UserLocation | null) {
  if (!loc) return undefined;
  return { lat: loc.lat, lng: loc.lng, catchmentKm: 1.5 };
}

function newFeedSeed() {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const values = new Uint32Array(1);
    crypto.getRandomValues(values);
    return values[0];
  }
  return Math.floor(Math.random() * 2 ** 32);
}

/** Nearest ancestor that actually scrolls; else document scrolling element. */
function findScrollRoot(start: HTMLElement | null): Element {
  if (typeof document === 'undefined') {
    return null as unknown as Element;
  }
  if (!start) {
    return document.scrollingElement ?? document.documentElement;
  }
  let el: HTMLElement | null = start;
  while (el) {
    const st = window.getComputedStyle(el);
    const oy = st.overflowY;
    if ((oy === 'auto' || oy === 'scroll' || oy === 'overlay') && el.scrollHeight > el.clientHeight + 2) {
      return el;
    }
    el = el.parentElement;
  }
  return document.scrollingElement ?? document.documentElement;
}

function isViewportScrollRoot(el: Element): boolean {
  return el === document.body || el === document.documentElement;
}

export function DiscoverPage({
  onBuildBasket: _onBuildBasket,
  onOpenBasket: _onOpenBasket,
  location,
}: {
  onBuildBasket: (video: BuildBasketVideo) => void;
  onOpenBasket: () => void;
  location?: UserLocation | null;
}) {
  // The CTA callbacks are owned by the shared RecipeModal mounted at App
  // level. Keeping the props here for API compat with App.tsx; the modal
  // is opened via the recipeViewer bus.
  void _onBuildBasket;
  void _onOpenBasket;
  const [videos, setVideos] = useState<RecipeVideoSummary[]>([]);
  const [visibleCount, setVisibleCount] = useState(VISIBLE_BATCH_SIZE);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  // The seed makes the cache feel feed-like: stable within a session for
  // smooth pagination, fresh on cold load / pull-to-refresh.
  const [feedSeed, setFeedSeed] = useState(() => newFeedSeed());
  const [savedOnly, setSavedOnly] = useState(false);
  const { store, isLiked, toggle, tick } = useRecipeLikes();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const pageSectionRef = useRef<HTMLElement | null>(null);
  const detailCache = useRef(new Map<string, RecipeVideoDetail>());
  const pullStartY = useRef<number | null>(null);
  const revealInFlightRef = useRef(false);
  /** Matches `nextCursor` after each commit so prefetches always read the latest cursor. */
  const nextCursorRef = useRef<number | null>(null);
  const videosRef = useRef<RecipeVideoSummary[]>([]);
  /** Serialize server fetches so a background prefetch never makes a second call return [] while loadingMore. */
  const prefetchTailRef = useRef<Promise<void>>(Promise.resolve());

  const [scrollRoot, setScrollRoot] = useState<Element | null>(null);

  useEffect(() => {
    videosRef.current = videos;
  }, [videos]);

  useEffect(() => {
    nextCursorRef.current = nextCursor;
  }, [nextCursor]);

  const displayFeed = useMemo(() => {
    if (!savedOnly) return videos;
    return buildSavedOnlyFeed(videos, store);
  }, [savedOnly, videos, store, tick]);

  const savedOnlyRef = useRef(savedOnly);
  useEffect(() => {
    if (savedOnlyRef.current === savedOnly) return;
    savedOnlyRef.current = savedOnly;
    if (savedOnly) {
      setVisibleCount(Math.min(VISIBLE_BATCH_SIZE, Math.max(displayFeed.length, 1)));
    } else {
      setVisibleCount(Math.min(VISIBLE_BATCH_SIZE, Math.max(videos.length, 1)));
    }
  }, [savedOnly, displayFeed.length, videos.length]);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => {
      const r = findScrollRoot(pageSectionRef.current);
      setScrollRoot((prev) => (prev === r ? prev : r));
    };
    update();
    window.addEventListener('resize', update);
    const el = pageSectionRef.current;
    const ro = el ? new ResizeObserver(update) : null;
    if (el) ro!.observe(el);
    return () => {
      window.removeEventListener('resize', update);
      ro?.disconnect();
    };
  }, [loading, displayFeed.length, visibleCount]);

  const prefetchDetails = useCallback((rows: RecipeVideoSummary[]) => {
    rows.forEach((video) => {
      if (detailCache.current.has(video.id) || video.status !== 'processed') return;
      void getRecipeVideo(video.id)
        .then((detail) => {
          detailCache.current.set(video.id, detail);
        })
        .catch(() => {
          // Detail prefetch is a latency optimization; the tap path still reports errors.
        });
    });
  }, []);

  const loadInitial = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial', seedOverride?: number) => {
      if (mode === 'initial') setLoading(true);
      if (mode === 'refresh') setRefreshing(true);
      setError('');
      const seed = seedOverride ?? feedSeed;
      try {
        const data = await listRecipeVideos(0, PREFETCH_BATCH_SIZE, seed, locationOpts(location));
        setVideos(data.videos);
        setVisibleCount(Math.min(VISIBLE_BATCH_SIZE, data.videos.length));
        const nc = data.next_cursor;
        setNextCursor(nc);
        nextCursorRef.current = nc;
        prefetchDetails(data.videos.slice(0, PREFETCH_BATCH_SIZE));
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [feedSeed, location, prefetchDetails],
  );

  useEffect(() => {
    void loadInitial('initial');
    // We intentionally only run this on mount; subsequent reshuffles flow
    // through the explicit refresh path below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch when the user pin moves: a different lat/lng changes which
  // recipes are buyable in catchment.
  const lastLocationKey = useRef<string | null>(null);
  useEffect(() => {
    const key = location ? `${location.lat.toFixed(4)},${location.lng.toFixed(4)}` : 'none';
    if (lastLocationKey.current === key) return;
    const isFirstPin = lastLocationKey.current === null;
    lastLocationKey.current = key;
    // Kick off the per-device prematch worker the moment we know the
    // user's pin (plan C2). This is fire-and-forget; the polling effect
    // below renders the progress bar while the worker chews through the
    // 40-row seed pool.
    if (location) {
      kickoffPrematch(location.lat, location.lng, 1.5).catch(() => {});
    }
    if (!isFirstPin) {
      void loadInitial('refresh');
    }
  }, [location, loadInitial]);

  // Cold-load progress: poll prematch status every 3 s until ≥20 rows
  // resolve, then settle (plan C4). The list endpoint already filters
  // to resolved rows, so as soon as a few land we re-fetch and reveal
  // them on Discover even before the full pool is done.
  const [prematchStatus, setPrematchStatus] = useState<PrematchStatus | null>(null);
  useEffect(() => {
    if (!location) return;
    let cancelled = false;
    let lastResolved = -1;
    let ticks = 0;
    // Safety cap: 3s × 200 ticks = 10 min wall clock. Prematch never
    // legitimately runs longer than that; if we hit this we stop to
    // avoid spinning forever against a misreporting backend.
    const MAX_TICKS = 200;
    const tick = async () => {
      if (cancelled) return;
      ticks += 1;
      try {
        const s = await getPrematchStatus();
        if (cancelled) return;
        setPrematchStatus(s);
        if (s.resolved > lastResolved) {
          lastResolved = s.resolved;
          // New rows landed — refresh the visible list.
          void loadInitial('refresh');
        }
        // Keep polling while work is still in flight on the worker
        // (queued/running) or while the totals don't yet account for
        // every job (resolved + skipped + failed < total). This is the
        // *job is still happening* signal, independent of the "≥20
        // ready" UX threshold — so the progress line in the banner keeps
        // ticking up to 40/40 even after the feed has revealed.
        const accounted = s.resolved + s.skipped + s.failed;
        const inFlight = s.queued > 0 || s.running > 0;
        const incomplete = s.total > 0 && accounted < s.total;
        if ((inFlight || incomplete) && ticks < MAX_TICKS) {
          window.setTimeout(tick, 3000);
        }
      } catch {
        if (ticks < MAX_TICKS) {
          // Transient error — back off a touch and retry rather than
          // freezing the UI.
          window.setTimeout(tick, 6000);
        }
      }
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [location, loadInitial]);

  const ensurePrefetch = useCallback((): Promise<RecipeVideoSummary[]> => {
    const promise = prefetchTailRef.current.then(async () => {
      if (savedOnly) return [];
      let cursor = nextCursorRef.current;
      if (cursor == null) return [];
      setLoadingMore(true);
      let fresh: RecipeVideoSummary[] = [];
      try {
        const data = await listRecipeVideos(
          cursor,
          PREFETCH_BATCH_SIZE,
          feedSeed,
          locationOpts(location),
        );
        setVideos((rows) => {
          const existing = new Set(rows.map((row) => row.id));
          fresh = data.videos.filter((row) => !existing.has(row.id));
          prefetchDetails(fresh);
          return [...rows, ...fresh];
        });
        const nc = data.next_cursor;
        setNextCursor(nc);
        nextCursorRef.current = nc;
      } catch (err) {
        setError(String(err));
      } finally {
        setLoadingMore(false);
      }
      return fresh;
    });
    prefetchTailRef.current = promise.then(() => {}).catch(() => {});
    return promise;
  }, [feedSeed, location, prefetchDetails, savedOnly]);

  // When the sentinel comes into view we want MORE cards on screen.
  // Two cases:
  //   1) We already have buffered videos beyond visibleCount → just
  //      reveal the next batch (and prefetch ahead if the buffer's low).
  //   2) Visible count has caught up to fetched length → fetch more
  //      from the server, then reveal those once they arrive.
  const revealNextBatch = useCallback(async () => {
    if (revealInFlightRef.current) return;
    revealInFlightRef.current = true;
    const buffered = displayFeed.length - visibleCount;
    try {
      if (buffered > 0) {
        const nextVisible = Math.min(visibleCount + VISIBLE_BATCH_SIZE, displayFeed.length);
        setVisibleCount(nextVisible);
        if (!savedOnly && displayFeed.length - nextVisible <= MIN_BUFFER_SIZE) {
          void ensurePrefetch();
        }
        return;
      }
      if (savedOnly) return;
      if (nextCursorRef.current != null) {
        const fresh = await ensurePrefetch();
        if (fresh.length > 0) {
          setVisibleCount((count) => count + Math.min(VISIBLE_BATCH_SIZE, fresh.length));
        }
      }
    } finally {
      revealInFlightRef.current = false;
    }
  }, [ensurePrefetch, displayFeed.length, visibleCount, savedOnly]);

  function viewportScrollMetrics() {
    const root = scrollRoot ?? document.scrollingElement ?? document.documentElement;
    return {
      scrollTop: root.scrollTop,
      scrollHeight: root.scrollHeight,
      clientHeight: root.clientHeight,
    };
  }

  const ioScrollRoot = scrollRoot && !isViewportScrollRoot(scrollRoot) ? scrollRoot : null;
  // Belt + suspenders for infinite scroll:
  //   - IntersectionObserver triggers "near bottom" reveals on most
  //     mobile browsers reliably.
  //   - A windowed scroll fallback covers cases where the sentinel
  //     ends up inside a stacking context the IO can't reach (e.g.
  //     parent transforms, content-visibility), or where the IO never
  //     observes because the sentinel mounts after the effect has
  //     already torn down.
  // Both paths bail when loading/loadingMore is true, so they don't
  // double-trigger.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loading && !loadingMore) {
          void revealNextBatch();
        }
      },
      {
        ...(ioScrollRoot ? { root: ioScrollRoot } : {}),
        rootMargin: '0px 0px 600px 0px',
      },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [ioScrollRoot, loading, loadingMore, revealNextBatch]);

  useEffect(() => {
    if (loading) return;
    const rootEl = scrollRoot ?? document.scrollingElement ?? document.documentElement;
    let raf = 0;
    function nearBottom() {
      const { scrollTop, scrollHeight, clientHeight } = viewportScrollMetrics();
      const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
      return distanceFromBottom < 600;
    }
    function maybe() {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        if (loadingMore) return;
        if (!nearBottom()) return;
        void revealNextBatch();
      });
    }
    rootEl.addEventListener('scroll', maybe, { passive: true });
    window.addEventListener('scroll', maybe, { passive: true });
    window.addEventListener('resize', maybe);
    // Also kick once in case the sentinel is already in view
    // (short content + tall viewport, or fast scroll past it).
    maybe();
    return () => {
      rootEl.removeEventListener('scroll', maybe);
      window.removeEventListener('scroll', maybe);
      window.removeEventListener('resize', maybe);
      window.cancelAnimationFrame(raf);
    };
  }, [loading, loadingMore, revealNextBatch, scrollRoot, displayFeed.length, visibleCount]);

  useEffect(() => {
    prefetchDetails(displayFeed.slice(0, Math.min(visibleCount + MIN_BUFFER_SIZE, displayFeed.length)));
  }, [prefetchDetails, displayFeed, visibleCount]);

  const visibleVideos = displayFeed.slice(0, visibleCount);
  const canRevealMore =
    visibleCount < displayFeed.length || (!savedOnly && nextCursor != null);

  // Short first screen: content may not fill the viewport so nothing scrolls
  // and the sentinel never intersects — kick reveal/prefetch from layout changes.
  useEffect(() => {
    const el = pageSectionRef.current;
    if (!el || loading) return;
    const ro = new ResizeObserver(() => {
      if (loadingMore || !canRevealMore) return;
      const { scrollHeight, clientHeight } = viewportScrollMetrics();
      if (scrollHeight <= clientHeight + 4) {
        void revealNextBatch();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [canRevealMore, loading, loadingMore, revealNextBatch, scrollRoot]);

  const openVideo = async (video: RecipeVideoSummary) => {
    setDetailLoading(true);
    try {
      const cached = detailCache.current.get(video.id);
      const detail = cached ?? await getRecipeVideo(video.id);
      detailCache.current.set(video.id, detail);
      openRecipe(detail);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    if (viewportScrollMetrics().scrollTop <= 0) {
      pullStartY.current = event.touches[0]?.clientY ?? null;
    }
  };

  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = pullStartY.current;
    pullStartY.current = null;
    if (start == null || refreshing) return;
    const end = event.changedTouches[0]?.clientY ?? start;
    if (viewportScrollMetrics().scrollTop <= 0 && end - start > PULL_REFRESH_THRESHOLD) {
      const seed = newFeedSeed();
      setFeedSeed(seed);
      void loadInitial('refresh', seed);
    }
  };

  return (
    <section
      ref={pageSectionRef}
      className="vitrina-discover-page"
      aria-label="Discover real creator videos"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className={`vitrina-refresh-pill ${refreshing ? 'is-visible' : ''}`}>
        {refreshing ? 'Refreshing recipes...' : 'Pull to refresh'}
      </div>
      <header className="vitrina-tab-header">
        <p>Discover</p>
        <h1>Try a new recipe today.</h1>
        <div className="vitrina-discover-seg" role="tablist" aria-label="Recipe feed">
          <button
            type="button"
            role="tab"
            aria-selected={!savedOnly}
            className={`vitrina-discover-seg__btn${!savedOnly ? ' is-active' : ''}`}
            onClick={() => setSavedOnly(false)}
          >
            For you
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={savedOnly}
            className={`vitrina-discover-seg__btn${savedOnly ? ' is-active' : ''}`}
            onClick={() => setSavedOnly(true)}
          >
            Saved
          </button>
        </div>
      </header>

      {error ? <div className="vitrina-discover-state">Could not load recipe videos: {error}</div> : null}
      {loading ? <DiscoverLoadingScreen /> : null}
      {!loading && prematchStatus && prematchStatus.total > 0 ? (() => {
        const inFlight = prematchStatus.queued > 0 || prematchStatus.running > 0;
        const done = !inFlight;
        // Only show the spinner while the worker is genuinely running.
        // Once done, show a quiet note so the user knows why they see fewer
        // results (some recipes have no shops nearby).
        if (inFlight) {
          return (
            <div
              className="vitrina-discover-state"
              role="status"
              aria-live="polite"
              style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', justifyContent: 'center', padding: '0.6rem 1rem', opacity: 0.85 }}
            >
              <DoodleSpinner />
              <span>
                Matching shops near you — {prematchStatus.resolved}/{Math.max(prematchStatus.total, 40)} ready…
              </span>
            </div>
          );
        }
        // Done: show a quiet note only when fewer than all recipes matched.
        if (done && prematchStatus.resolved > 0 && prematchStatus.resolved < prematchStatus.total) {
          return (
            <div
              className="vitrina-discover-state"
              role="status"
              style={{ padding: '0.4rem 1rem', opacity: 0.55, textAlign: 'center', fontSize: '0.82rem' }}
            >
              {prematchStatus.resolved} recipe{prematchStatus.resolved !== 1 ? 's' : ''} available near you
            </div>
          );
        }
        return null;
      })() : null}

      <div className="vitrina-video-grid">
        {visibleVideos.map((video) => {
          const cover = thumbnailUrl(video);
          const creator = video.creator?.replace(/^@/, '');
          const title = video.recipe_title || video.title;
          const liked = isLiked(video.id);
          return (
            <button
              key={video.id}
              type="button"
              className="vitrina-video-card"
              onClick={() => void openVideo(video)}
              onMouseEnter={() => prefetchIframe(iframeUrlFor(video))}
              onPointerDown={() => prefetchIframe(iframeUrlFor(video))}
            >
              <div className="vitrina-video-thumb" data-has-cover={cover ? 'true' : 'false'}>
                {cover ? (
                  <img
                    src={cover}
                    alt=""
                    loading="lazy"
                    onError={(event) => {
                      // The local /cover.jpg may not be committed yet
                      // for newly-ingested videos. Fall back to the
                      // upstream signed thumbnail (legacy field) if
                      // available; otherwise hide the broken icon.
                      const img = event.currentTarget;
                      const fallback = thumbnailFallbackUrl(video);
                      if (fallback && img.src !== fallback) {
                        img.src = fallback;
                      } else {
                        img.style.display = 'none';
                      }
                    }}
                  />
                ) : null}
                <RecipeLikeButton
                  liked={liked}
                  onPress={() => {
                    const next = !liked;
                    toggle(video, next);
                    fireRecipeLikeMem0(video, next);
                  }}
                  className="vitrina-video-like"
                  size={22}
                />
              </div>
              <div className="vitrina-video-meta">
                {title ? <span className="vitrina-video-title">{title}</span> : null}
                {creator ? <span className="vitrina-video-creator">@{creator}</span> : null}
              </div>
            </button>
          );
        })}
      </div>

      {!loading && savedOnly && displayFeed.length === 0 ? (
        <div className="vitrina-discover-state vitrina-discover-state--hint">
          Nothing saved yet. Tap the heart on a recipe or open a recipe and save it from the top bar.
        </div>
      ) : null}

      {canRevealMore ? (
        <div className="vitrina-see-more" ref={sentinelRef} aria-live="polite">
          <DoodleSpinner size={56} />
        </div>
      ) : null}

      {detailLoading ? <div className="vitrina-discover-state">Loading processed recipe...</div> : null}

      <style>{`
        .vitrina-discover-page {
          min-height: 100dvh;
          padding: 96px 18px 100px;
          box-sizing: border-box;
        }
        .vitrina-refresh-pill {
          position: fixed;
          top: calc(env(safe-area-inset-top, 0px) + 72px);
          left: 50%;
          z-index: 12;
          transform: translate(-50%, -12px);
          opacity: 0;
          pointer-events: none;
          padding: 8px 13px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--color-card) 84%, transparent);
          box-shadow: 0 18px 48px -30px color-mix(in srgb, var(--color-ink) 62%, transparent);
          color: var(--color-ink-light);
          font-size: 0.78rem;
          transition: opacity 160ms ease, transform 160ms ease;
          backdrop-filter: blur(10px);
        }
        .vitrina-refresh-pill.is-visible {
          opacity: 1;
          transform: translate(-50%, 0);
        }
        .vitrina-tab-header {
          width: min(960px, 100%);
          margin: 0 auto 22px;
        }
        .vitrina-tab-header p {
          margin: 0 0 5px;
          color: var(--color-ink-light);
          font-size: 11px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }
        .vitrina-tab-header h1 {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(2.4rem, 8vw, 4.5rem);
          line-height: 0.92;
          letter-spacing: -0.055em;
          color: var(--color-ink);
        }
        .vitrina-discover-seg {
          display: flex;
          gap: 8px;
          margin-top: 18px;
        }
        .vitrina-discover-seg__btn {
          flex: 1;
          max-width: 168px;
          padding: 10px 14px;
          border-radius: 999px;
          border: 1px solid color-mix(in srgb, var(--color-ink) 12%, transparent);
          background: color-mix(in srgb, var(--color-card) 55%, transparent);
          color: var(--color-ink-light);
          font-size: 0.86rem;
          font-weight: 600;
          cursor: pointer;
        }
        .vitrina-discover-seg__btn.is-active {
          color: var(--color-ink);
          border-color: color-mix(in srgb, var(--color-ink) 24%, transparent);
          background: color-mix(in srgb, var(--color-card) 92%, transparent);
        }
        .vitrina-tab-header span {
          display: block;
          max-width: 620px;
          margin-top: 12px;
          color: var(--color-ink-light);
          font-size: 0.95rem;
          line-height: 1.5;
        }
        .vitrina-discover-state {
          width: min(960px, 100%);
          margin: 0 auto 14px;
          padding: 14px 16px;
          border-radius: var(--r-lg);
          background: color-mix(in srgb, var(--color-card) 72%, transparent);
          color: var(--color-ink-light);
        }
        .vitrina-discover-state--hint {
          margin-top: 12px;
          text-align: center;
        }
        .vitrina-video-grid {
          width: min(960px, 100%);
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 18px 12px;
          padding-bottom: 16px;
        }
        .vitrina-video-card {
          appearance: none;
          border: 0;
          background: transparent;
          padding: 0;
          text-align: left;
          cursor: pointer;
          display: grid;
          gap: 8px;
        }
        .vitrina-video-thumb {
          position: relative;
          aspect-ratio: 4 / 5;
          overflow: hidden;
          border-radius: 6px;
          background: var(--color-cream-dark);
          box-shadow: 0 22px 60px -42px color-mix(in srgb, var(--color-ink) 60%, transparent);
          isolation: isolate;
        }
        .vitrina-video-thumb img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: 0;
        }
        .vitrina-video-like {
          position: absolute;
          top: 6px;
          right: 6px;
          z-index: 2;
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          border: 0;
          padding: 0;
          margin: 0;
          color: #fff;
          filter: drop-shadow(0 1px 3px color-mix(in srgb, #000 55%, transparent));
          background: color-mix(in srgb, #000 22%, transparent);
          cursor: pointer;
        }
        .vitrina-video-like[aria-pressed="true"] {
          color: #ffb4c4;
          background: color-mix(in srgb, #000 38%, transparent);
        }
        .vitrina-video-meta {
          display: grid;
          gap: 2px;
          padding: 0 2px;
        }
        .vitrina-video-title {
          color: var(--color-ink);
          font-family: var(--font-display);
          font-size: 0.92rem;
          font-weight: 600;
          line-height: 1.25;
          letter-spacing: -0.005em;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .vitrina-video-creator {
          color: var(--color-ink-light);
          font-size: 0.78rem;
          font-weight: 500;
        }
        .vitrina-see-more {
          width: min(960px, 100%);
          margin: 22px auto 0;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 7px;
          min-height: 64px;
        }
        .vitrina-loader-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: color-mix(in srgb, var(--color-ink) 38%, transparent);
          animation: vitrina-loader-dot 1.05s ease-in-out infinite;
        }
        .vitrina-loader-dot:nth-child(2) { animation-delay: 0.16s; }
        .vitrina-loader-dot:nth-child(3) { animation-delay: 0.32s; }
        @keyframes vitrina-loader-dot {
          0%, 100% { opacity: 0.3; transform: translateY(0); }
          50%      { opacity: 1; transform: translateY(-4px); }
        }
        /* Recipe modal styles live in RecipeModal.tsx (shared with chat). */
      `}</style>
    </section>
  );
}
