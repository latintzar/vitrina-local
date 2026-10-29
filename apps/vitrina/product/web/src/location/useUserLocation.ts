import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '../auth/supabaseClient';

export interface UserLocation {
  label: string;
  lng: number;
  lat: number;
  precision: 'approximate' | 'exact';
  source: 'manual' | 'browser' | 'saved' | 'profile';
  capturedAt: string;
}

const STORAGE_KEY = 'vitrina:location';
const LEGACY_STORAGE_KEY = 'vitrina:user_location';
// Conceptually this is the user's "home address" — stored on the user
// profile (Supabase `auth.users.user_metadata.home_location`) for
// signed-in shoppers so it follows them across devices and OAuth flows
// re-hydrate the value before the location-prompt gate ever fires.
// Anonymous shoppers fall back to localStorage on this device.
const PROFILE_META_KEY = 'home_location';

export function jitterLocation(lng: number, lat: number, meters = 50): [number, number] {
  const latDelta = meters / 111_000;
  const lonDelta = meters / (111_000 * Math.max(Math.cos((lat * Math.PI) / 180), 0.2));
  return [
    lng + (Math.random() - 0.5) * lonDelta * 2,
    lat + (Math.random() - 0.5) * latDelta * 2,
  ];
}

function normalizeLocation(raw: Partial<UserLocation> & { lng: number; lat: number; label?: string }): UserLocation {
  return {
    label: raw.label || 'София',
    lng: raw.lng,
    lat: raw.lat,
    precision: raw.precision || 'approximate',
    source: raw.source || 'saved',
    capturedAt: raw.capturedAt || new Date().toISOString(),
  };
}

/**
 * Read saved location synchronously from localStorage.
 *
 * Called as the useState initializer so the very first render already
 * has the location — no useEffect delay, no flash of "please set location"
 * after OAuth redirects back to the app.
 */
function readStoredLocation(): UserLocation | null {
  if (typeof window === 'undefined') return null;
  // Handle ?reset=true here too so the cold-start demo flow works even
  // before the first render's effects fire.
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') === 'true') {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      window.localStorage.removeItem('vitrina:cart_key');
      params.delete('reset');
      const newUrl =
        window.location.pathname +
        (params.toString() ? `?${params.toString()}` : '') +
        window.location.hash;
      window.history.replaceState({}, '', newUrl);
      return null;
    }
  } catch {
    // best-effort URL parse, ignore
  }
  const raw =
    window.localStorage.getItem(STORAGE_KEY) ||
    window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = normalizeLocation(JSON.parse(raw));
    // Normalise key on first read (migrate legacy key)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    return parsed;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    return null;
  }
}

export function useUserLocation() {
  // Initialise synchronously from localStorage — no useEffect delay means
  // App.tsx sees the saved location on the very first render and won't
  // show the location-prompt gate after an OAuth redirect.
  const [location, setLocationState] = useState<UserLocation | null>(readStoredLocation);

  // Keep a side-effect watcher only for ?reset=true navigations that happen
  // after the initial render (e.g. the user presses back after a demo reset).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('reset') === 'true') {
          window.localStorage.removeItem(STORAGE_KEY);
          window.localStorage.removeItem(LEGACY_STORAGE_KEY);
          window.localStorage.removeItem('vitrina:cart_key');
          setLocationState(null);
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  // On every auth state change, prefer the user's *profile* home location
  // (server-side, cross-device) over the local cache. This is the fix
  // for the "asked for location again after OAuth" bug — once you sign
  // in, your saved home address comes with you.
  useEffect(() => {
    const supa = getSupabase();
    if (!supa) return;
    let cancelled = false;
    const apply = (raw: unknown) => {
      if (cancelled) return;
      if (!raw || typeof raw !== 'object') return;
      const candidate = raw as Partial<UserLocation> & { lng?: number; lat?: number };
      if (typeof candidate.lng !== 'number' || typeof candidate.lat !== 'number') return;
      const profile = normalizeLocation({
        ...candidate,
        lng: candidate.lng,
        lat: candidate.lat,
        source: 'profile',
      });
      setLocationState((prev) => {
        // Profile wins on first sign-in; keep whatever was set locally
        // afterwards (`setLocation` already mirrors back to profile).
        if (!prev || prev.source === 'saved' || prev.source === 'profile') {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
          }
          return profile;
        }
        return prev;
      });
    };
    void supa.auth.getUser().then(({ data }) => {
      const meta = data?.user?.user_metadata as Record<string, unknown> | undefined;
      apply(meta?.[PROFILE_META_KEY]);
    });
    const sub = supa.auth.onAuthStateChange((_event, session) => {
      const meta = session?.user?.user_metadata as Record<string, unknown> | undefined;
      apply(meta?.[PROFILE_META_KEY]);
    });
    return () => {
      cancelled = true;
      sub.data.subscription.unsubscribe();
    };
  }, []);

  const setLocation = useCallback((next: UserLocation) => {
    const normalized = normalizeLocation(next);
    setLocationState(normalized);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    }
    // Best-effort write-through to the user's profile so it follows them
    // across devices. Anonymous shoppers (no Supabase user) just keep
    // the local cache; the next sign-in will sync this address up.
    const supa = getSupabase();
    if (!supa) return;
    void supa.auth.getUser().then(({ data }) => {
      if (!data?.user) return;
      void supa.auth.updateUser({
        data: { [PROFILE_META_KEY]: normalized },
      });
    });
  }, []);

  const clearLocation = useCallback(() => {
    setLocationState(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    const supa = getSupabase();
    if (!supa) return;
    void supa.auth.getUser().then(({ data }) => {
      if (!data?.user) return;
      void supa.auth.updateUser({ data: { [PROFILE_META_KEY]: null } });
    });
  }, []);

  return { location, setLocation, clearLocation };
}
