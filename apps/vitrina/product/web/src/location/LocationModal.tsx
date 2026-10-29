/**
 * LocationModal — first-cold-load + manual location picker.
 *
 * Spec (2026-04-27 rebuild brief, "Location modal" bucket):
 *   • Single header line: Vitrina wordmark + "Where do you live?".
 *   • No close button — modal is mandatory on first cold load (App.tsx
 *     decides this; we just don't render an X).
 *   • Behavior is the **Leo casa LocationPickerModal** pattern: the
 *     pin is a static DOM element pinned to the dead-centre of the
 *     map (no Mapbox marker). Panning the map moves the *map*, not
 *     the pin — when the user releases (`moveend`) we reverse-geocode
 *     the new map centre and label the address above the pin. The
 *     input field mirrors that same label so the address you see
 *     above the pin is the address that will be saved.
 *   • Label = the precise street/address, never the city. Falls back
 *     gracefully to the closest neighbourhood if the geocoder gives
 *     us nothing better.
 *   • Mobile keyboard-tracking: when the input is focused, the
 *     input + CTA slide up to sit above the keyboard via
 *     `visualViewport`; the map shrinks underneath.
 *   • CTA hidden (not just disabled) until a selection or GPS lands.
 *
 * The `WelcomeSplash` rendered above this modal on the very first
 * cold-load runs separately from App.tsx and animates into this
 * surface; once dismissed it sets `vitrina:welcomed=1` in localStorage
 * so it never shows again.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { jitterLocation, type UserLocation } from './useUserLocation';

const SOFIA_CENTER: [number, number] = [23.3219, 42.6977];
const TOKEN =
  import.meta.env.VITE_MAPBOX_TOKEN ||
  '';

interface ReverseGeocodeResult {
  label: string;
  street?: string;
}

interface ForwardSuggestion {
  id: string;
  label: string;
  hint?: string;
  lng: number;
  lat: number;
}

// Geocoding: Nominatim (OpenStreetMap, free, no API key, no billing risk).
// Usage policy: 1 req/sec, must identify via User-Agent (browser sends
// Referer automatically which Nominatim accepts). We only hit it on
// `moveend` (one per drag) and a 180ms debounce while typing — well
// inside the limit.
//
// Why not Mapbox geocoding? Two reasons:
//   1. Cost. Mapbox bills geocoding requests against the same key as
//      tiles; an over-eager pan storm could rack up charges.
//   2. Address quality in Sofia. Mapbox routinely returns "Pinned
//      location" for points that Nominatim resolves to "ulitsa Han
//      Asparuh 12, Sofia". OSM has better coverage of indie European
//      streets than Mapbox in our experience.
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  footway?: string;
  cycleway?: string;
  path?: string;
  house_number?: string;
  neighbourhood?: string;
  suburb?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  country?: string;
}

interface NominatimReverseResponse {
  display_name?: string;
  name?: string;
  address?: NominatimAddress;
}

interface NominatimSearchResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  address?: NominatimAddress;
}

function _composeStreet(addr: NominatimAddress): string | null {
  const street =
    addr.road || addr.pedestrian || addr.footway || addr.cycleway || addr.path;
  if (!street) return null;
  return addr.house_number ? `${street} ${addr.house_number}` : street;
}

function _composeFallback(addr: NominatimAddress): string | null {
  return (
    addr.neighbourhood ||
    addr.suburb ||
    addr.city_district ||
    addr.city ||
    addr.town ||
    addr.village ||
    null
  );
}

async function forwardGeocode(query: string): Promise<ForwardSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  // Bias to Sofia metro via viewbox so a partial "vit…" doesn't return
  // Vitória, Brazil. `bounded=1` clips strictly to the box.
  const viewbox = '23.20,42.78,23.45,42.60';
  const url =
    `${NOMINATIM_BASE}/search?format=jsonv2&addressdetails=1` +
    `&limit=5&accept-language=en,bg&viewbox=${viewbox}&bounded=1` +
    `&q=${encodeURIComponent(trimmed)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) return [];
  const data = (await res.json()) as NominatimSearchResult[];
  const out: ForwardSuggestion[] = [];
  for (const f of data) {
    if (!f.lat || !f.lon) continue;
    const addr = f.address || {};
    const street = _composeStreet(addr);
    const label = (street || f.name || _composeFallback(addr) || '').trim();
    if (!label) continue;
    const localityBits = [
      addr.suburb,
      addr.city_district,
      addr.city || addr.town || addr.village,
    ].filter(Boolean) as string[];
    const hint =
      localityBits.length > 0 ? localityBits.join(', ') : f.display_name;
    out.push({
      id: String(f.place_id),
      label,
      hint: hint || undefined,
      lng: parseFloat(f.lon),
      lat: parseFloat(f.lat),
    });
  }
  return out;
}

async function reverseGeocode(lng: number, lat: number): Promise<ReverseGeocodeResult> {
  // zoom=18 → building / address-level result. addressdetails=1 gives
  // us the structured address parts we compose into "Street 12" rather
  // than the verbose 90-char display_name.
  const url =
    `${NOMINATIM_BASE}/reverse?format=jsonv2&addressdetails=1&zoom=18` +
    `&accept-language=en,bg&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`reverseGeocode ${res.status}`);
  const data = (await res.json()) as NominatimReverseResponse;
  const addr = data.address || {};
  const street = _composeStreet(addr);
  if (street) return { label: street, street };
  const fallback = _composeFallback(addr);
  if (fallback) return { label: fallback };
  if (data.name) return { label: data.name };
  if (data.display_name) {
    const head = data.display_name.split(',')[0]?.trim();
    if (head) return { label: head };
  }
  throw new Error('reverseGeocode no usable feature');
}

export function LocationModal({
  open,
  initialLocation,
  onConfirm,
  onCancel: _onCancel,
  mandatory: _mandatory = false,
}: {
  open: boolean;
  initialLocation?: UserLocation | null;
  onConfirm: (location: UserLocation) => void;
  onCancel: () => void;
  /**
   * When true, no close affordance is rendered and the modal is fully
   * blocking (used on first cold load — the user MUST set a location
   * before Vitrina can show anything geo-relevant). When false the
   * modal is openable from the wordmark / settings and dismissible.
   */
  mandatory?: boolean;
}) {
  void _onCancel;
  void _mandatory;
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Latest reverse-geocode token, used to discard stale responses when
  // the user pans again before the previous request resolves.
  const reverseTokenRef = useRef(0);
  // True while the user is actively dragging — we hide the address
  // label and bounce the pin up slightly, then reverse-geocode on
  // `moveend` to refresh the label.
  const [dragging, setDragging] = useState(false);
  const [draft, setDraft] = useState<UserLocation | null>(initialLocation ?? null);
  const [pinLabel, setPinLabel] = useState(initialLocation?.label ?? '');
  const [input, setInput] = useState(initialLocation?.label ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [suggestions, setSuggestions] = useState<ForwardSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const suggestionTimer = useRef<number | null>(null);

  // Mobile keyboard tracking: when the soft keyboard rises it shrinks
  // visualViewport.height; we lift the footer by exactly that amount so
  // the input + CTA hover above the keyboard rather than getting hidden.
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardInset(inset);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [open]);

  // Reverse-geocode the current map centre and update the address
  // label + draft. Source = where the centre came from (manual pan,
  // browser GPS, suggestion pick). Optionally persists jittered coords
  // for privacy while still using the precise lng/lat for geocoding.
  const setPoint = useCallback(
    async (
      lng: number,
      lat: number,
      source: UserLocation['source'] = 'manual',
      stored?: { storedLng: number; storedLat: number },
    ) => {
      const persistLng = stored?.storedLng ?? lng;
      const persistLat = stored?.storedLat ?? lat;
      const token = ++reverseTokenRef.current;
      const base: UserLocation = {
        lng: persistLng,
        lat: persistLat,
        label: '',
        precision: 'approximate',
        source,
        capturedAt: new Date().toISOString(),
      };
      setDraft(base);
      setPinLabel('Locating…');
      setInput('Locating…');
      try {
        const { label } = await reverseGeocode(lng, lat);
        if (reverseTokenRef.current !== token) return;
        setDraft({ ...base, label });
        setPinLabel(label);
        setInput(label);
      } catch {
        if (reverseTokenRef.current !== token) return;
        const friendly = 'Pinned location';
        setDraft({ ...base, label: friendly });
        setPinLabel(friendly);
        setInput(friendly);
      }
    },
    [],
  );

  useEffect(() => {
    if (!open || !mapEl.current || mapRef.current) return;
    // Empty the container before instantiating — kills the Mapbox
    // "container should be empty" warning when a previous map left
    // detritus behind (HMR or modal re-open).
    mapEl.current.innerHTML = '';
    mapboxgl.accessToken = TOKEN;
    const center: [number, number] = initialLocation
      ? [initialLocation.lng, initialLocation.lat]
      : SOFIA_CENTER;
    // streets-v12 renders street names + building footprints clearly,
    // which is what people expect when picking an address. light-v11
    // strips most of that detail at city zoom.
    const map = new mapboxgl.Map({
      container: mapEl.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center,
      zoom: initialLocation ? 15 : 12,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: false }), 'top-right');
    // Pin stays in the dead-centre (it's a DOM overlay). Panning the
    // map changes the underlying address — refresh the label on the
    // user's release. movestart bounces the pin up so the user gets a
    // tiny "alive" feedback while dragging.
    map.on('movestart', () => setDragging(true));
    map.on('moveend', () => {
      setDragging(false);
      const c = map.getCenter();
      void setPoint(c.lng, c.lat, 'manual');
    });
    mapRef.current = map;
    if (initialLocation) {
      setPinLabel(initialLocation.label || 'Locating…');
      setInput(initialLocation.label || '');
      if (!initialLocation.label) {
        void setPoint(initialLocation.lng, initialLocation.lat, initialLocation.source);
      }
    } else {
      // No saved location → auto-trigger the browser geolocation prompt
      // immediately so the user doesn't have to tap "Use my location".
      // If they grant, flyTo will fire moveend → reverse-geocode. If
      // they deny, we leave the pin on Sofia centre and let them type
      // or pan to set it manually. We deliberately DON'T reverse-
      // geocode the Sofia default — labelling it "Sofia, Bulgaria"
      // would mislead users into hitting Confirm with the city centre.
      setPinLabel('');
      setInput('');
      // Silent variant — same as the explicit "Use my location" button
      // but without flipping the busy/error state, so the modal opens
      // clean while the browser native prompt is shown.
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const realLng = pos.coords.longitude;
            const realLat = pos.coords.latitude;
            const [storedLng, storedLat] = jitterLocation(realLng, realLat, 50);
            mapRef.current?.flyTo({ center: [realLng, realLat], zoom: 16 });
            void setPoint(realLng, realLat, 'browser', { storedLng, storedLat });
          },
          () => {
            // Permission denied / unavailable — leave the pin on the
            // Sofia centre but don't seed a label or draft, so Confirm
            // stays disabled until the user pans or types.
          },
          { enableHighAccuracy: true, timeout: 12000 },
        );
      }
    }
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [initialLocation, open, setPoint]);

  if (!open) return null;

  async function useCurrentLocation() {
    setBusy(true);
    setError('');
    if (!('geolocation' in navigator)) {
      setBusy(false);
      setError('Browser geolocation unavailable. Tap the map to drop a pin.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // The pin is the map centre — flyTo will trigger `moveend`
        // which reverse-geocodes & relabels for us. Jitter is applied
        // only to the persisted coords (privacy); the map centre and
        // reverse-geocode use the precise GPS point.
        const realLng = pos.coords.longitude;
        const realLat = pos.coords.latitude;
        const [storedLng, storedLat] = jitterLocation(realLng, realLat, 50);
        mapRef.current?.flyTo({ center: [realLng, realLat], zoom: 16 });
        void setPoint(realLng, realLat, 'browser', {
          storedLng,
          storedLat,
        }).finally(() => setBusy(false));
      },
      () => {
        setBusy(false);
        setError('Could not get your location. Tap the map to drop a pin instead.');
      },
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  // Forward-geocode debounce — fires while the user types so they can
  // pick a real address suggestion just like Uber Eats / Deliveroo.
  const handleInputChange = (value: string) => {
    setInput(value);
    if (suggestionTimer.current) window.clearTimeout(suggestionTimer.current);
    if (value.trim().length < 2) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      return;
    }
    suggestionTimer.current = window.setTimeout(() => {
      void forwardGeocode(value).then((items) => {
        setSuggestions(items);
        setSuggestionsOpen(items.length > 0);
      });
    }, 180);
  };

  const pickSuggestion = (s: ForwardSuggestion) => {
    setSuggestionsOpen(false);
    setSuggestions([]);
    // Optimistically set the chip above the pin to the suggestion's
    // friendly label so it stays in sync with the input field while
    // the map flies. moveend will then refine via reverse-geocode.
    setPinLabel(s.label);
    setInput(s.label);
    setDraft({
      lng: s.lng,
      lat: s.lat,
      label: s.label,
      precision: 'approximate',
      source: 'manual',
      capturedAt: new Date().toISOString(),
    });
    mapRef.current?.flyTo({ center: [s.lng, s.lat], zoom: 16 });
    inputRef.current?.blur();
  };

  // The pin is always at the map centre, so a draft is always set
  // once the map has loaded. We still gate CONFIRM behind a non-empty
  // label so users don't save "Locating…" if the geocoder is slow.
  const ctaReady = Boolean(draft && pinLabel && pinLabel !== 'Locating…');

  return (
    <div
      className="vitrina-location-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Set your neighbourhood"
    >
      <header className="vitrina-location-header">
        <span className="vitrina-location-wordmark">Vitrina</span>
        <span className="vitrina-location-question">Where do you live?</span>
      </header>
      <div
        className="vitrina-location-map"
        style={{ paddingBottom: keyboardInset ? 0 : undefined }}
      >
        <div ref={mapEl} className="vitrina-location-map__canvas" />
        {/* Address chip — sits directly above the pin and mirrors the
            input field below. Hidden while the user is dragging so the
            stale label doesn't lie to them mid-pan. */}
        {pinLabel && !dragging ? (
          <div className="vitrina-location-chip" aria-hidden="true">
            <span>{pinLabel}</span>
          </div>
        ) : null}
        {/* Centred DOM pin — does not move when the map pans. */}
        <div
          className={`vitrina-location-centerpin${dragging ? ' is-dragging' : ''}`}
          aria-hidden="true"
        >
          <svg width="34" height="44" viewBox="0 0 34 44" fill="none">
            <path
              d="M17 0C7.611 0 0 7.611 0 17c0 11.9 15.3 25.4 16.15 26.18a1.4 1.4 0 0 0 1.7 0C18.7 42.4 34 28.9 34 17 34 7.611 26.389 0 17 0Z"
              fill="var(--color-ink, #2a2420)"
            />
            <circle cx="17" cy="17" r="6" fill="var(--color-card, #fff)" />
          </svg>
          <div className="vitrina-location-centerpin__shadow" />
        </div>
      </div>
      <footer
        className="vitrina-location-footer"
        style={{ transform: `translateY(-${keyboardInset}px)` }}
      >
        {suggestionsOpen ? (
          <ul className="vitrina-location-suggestions" role="listbox">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => pickSuggestion(s)}
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <span className="vitrina-location-suggestion__label">{s.label}</span>
                  {s.hint ? (
                    <span className="vitrina-location-suggestion__hint">{s.hint}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <input
          ref={inputRef}
          value={input}
          onChange={(event) => handleInputChange(event.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setSuggestionsOpen(true);
          }}
          onBlur={() => {
            // Slight delay so a click on a suggestion isn't cancelled by
            // the blur firing first.
            window.setTimeout(() => setSuggestionsOpen(false), 120);
          }}
          placeholder="Street, neighbourhood, or tap the map"
          autoComplete="street-address"
          inputMode="text"
        />
        <button
          type="button"
          className="vitrina-location-confirm"
          disabled={!ctaReady}
          onClick={() => {
            if (!ctaReady || !draft) {
              // Permission was denied or not yet granted — pressing
              // Confirm in the disabled state shouldn't do anything,
              // but if it slips through we offer the explicit prompt.
              void useCurrentLocation();
              return;
            }
            onConfirm({
              ...draft,
              label: input.trim() || draft.label,
              capturedAt: new Date().toISOString(),
            });
          }}
        >
          {busy ? 'Locating…' : 'Confirm'}
        </button>
        {error ? <p role="alert">{error}</p> : null}
      </footer>

      <style>{`
        .vitrina-location-modal {
          position: fixed;
          inset: 0;
          z-index: 80;
          display: flex;
          flex-direction: column;
          background: var(--color-card);
          color: var(--color-ink);
          overflow: hidden;
        }
        .vitrina-location-header {
          display: flex;
          align-items: baseline;
          gap: 12px;
          padding: calc(env(safe-area-inset-top, 0px) + 18px) 22px 14px;
          border-bottom: 1px solid color-mix(in srgb, var(--color-ink) 7%, transparent);
        }
        .vitrina-location-wordmark {
          font-family: var(--font-display);
          font-size: clamp(1.4rem, 4vw, 1.8rem);
          color: var(--color-ink);
          letter-spacing: -0.025em;
        }
        .vitrina-location-question {
          color: var(--color-ink-light);
          font-size: 0.95rem;
          font-style: italic;
        }
        .vitrina-location-map {
          position: relative;
          flex: 1;
          min-height: 240px;
          transition: flex 200ms ease;
        }
        .vitrina-location-map__canvas {
          position: absolute;
          inset: 0;
        }
        /* Centred pin — pinned to the visual centre of the map by
           translating up by half the pin height so the pin's TIP
           (not its midpoint) sits dead-centre on the map's centre
           coordinate. The map moves under it; the pin never moves. */
        .vitrina-location-centerpin {
          position: absolute;
          left: 50%;
          top: 50%;
          z-index: 4;
          pointer-events: none;
          transform: translate(-50%, calc(-100% + 4px));
          transition: transform 180ms cubic-bezier(.2, .9, .3, 1.4);
          filter: drop-shadow(0 6px 8px rgba(0, 0, 0, 0.25));
        }
        .vitrina-location-centerpin.is-dragging {
          transform: translate(-50%, calc(-100% - 6px));
        }
        .vitrina-location-centerpin__shadow {
          position: absolute;
          left: 50%;
          bottom: -6px;
          width: 14px;
          height: 4px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.28);
          transform: translateX(-50%);
          filter: blur(2px);
          transition: opacity 160ms ease, transform 180ms ease;
        }
        .vitrina-location-centerpin.is-dragging .vitrina-location-centerpin__shadow {
          opacity: 0.55;
          transform: translateX(-50%) scale(0.7);
        }
        /* Address chip — floats just above the pin. Same text as the
           input field, so what you see above the pin is what you save. */
        .vitrina-location-chip {
          position: absolute;
          left: 50%;
          top: 50%;
          z-index: 5;
          transform: translate(-50%, calc(-100% - 44px));
          max-width: min(78vw, 360px);
          padding: 8px 12px;
          border-radius: 999px;
          background: var(--color-card, #fff);
          color: var(--color-ink, #2a2420);
          font-size: 0.85rem;
          font-weight: 500;
          line-height: 1.2;
          letter-spacing: 0.01em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          box-shadow:
            0 1px 2px rgba(0, 0, 0, 0.08),
            0 8px 24px -10px rgba(0, 0, 0, 0.32);
          pointer-events: none;
        }
        .vitrina-location-chip::after {
          content: '';
          position: absolute;
          left: 50%;
          bottom: -5px;
          width: 10px;
          height: 10px;
          background: var(--color-card, #fff);
          transform: translateX(-50%) rotate(45deg);
          box-shadow: 2px 2px 4px -2px rgba(0, 0, 0, 0.15);
        }
        .vitrina-location-footer {
          position: relative;
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
          padding: 12px 14px calc(14px + env(safe-area-inset-bottom, 0px));
          background: var(--color-card);
          border-top: 1px solid color-mix(in srgb, var(--color-ink) 7%, transparent);
          transition: transform 180ms ease;
        }
        .vitrina-location-suggestions {
          position: absolute;
          left: 14px;
          right: 14px;
          bottom: calc(100% + 8px);
          margin: 0;
          padding: 6px;
          list-style: none;
          background: var(--color-card);
          border: 1px solid color-mix(in srgb, var(--color-ink) 8%, transparent);
          border-radius: 6px;
          box-shadow: 0 12px 36px -18px rgba(0, 0, 0, 0.35);
          max-height: 240px;
          overflow-y: auto;
          z-index: 5;
        }
        .vitrina-location-suggestions li { display: block; }
        .vitrina-location-suggestions button {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2px;
          width: 100%;
          padding: 10px 12px;
          margin: 0;
          border: 0;
          background: transparent;
          color: var(--color-ink);
          font: inherit;
          text-align: left;
          border-radius: 6px;
          cursor: pointer;
        }
        .vitrina-location-suggestions button:hover {
          background: color-mix(in srgb, var(--color-ink) 5%, transparent);
        }
        .vitrina-location-suggestion__label {
          font-size: 0.95rem;
          color: var(--color-ink);
        }
        .vitrina-location-suggestion__hint {
          font-size: 0.8rem;
          color: var(--color-ink-light);
        }
        .vitrina-location-footer input {
          min-height: 46px;
          padding: 0 14px;
          border-radius: 6px;
          border: 1px solid color-mix(in srgb, var(--color-ink) 14%, transparent);
          background: color-mix(in srgb, var(--color-cream) 60%, transparent);
          color: var(--color-ink);
          font: inherit;
        }
        .vitrina-location-footer input:focus {
          outline: 2px solid color-mix(in srgb, var(--color-ink) 28%, transparent);
          outline-offset: 1px;
        }
        .vitrina-location-locate {
          min-height: 46px;
          padding: 0 18px;
          border-radius: 6px;
          border: 1px solid color-mix(in srgb, var(--color-ink) 18%, transparent);
          background: transparent;
          color: var(--color-ink);
          font: inherit;
          cursor: pointer;
        }
        .vitrina-location-locate:disabled { opacity: 0.5; cursor: not-allowed; }
        .vitrina-location-confirm {
          min-height: 50px;
          padding: 0 22px;
          border-radius: 6px;
          border: 0;
          background: var(--color-ink);
          color: var(--color-card);
          font: inherit;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          cursor: pointer;
          transition: opacity 160ms ease, background 160ms ease;
        }
        .vitrina-location-confirm:disabled {
          background: color-mix(in srgb, var(--color-ink) 18%, transparent);
          color: color-mix(in srgb, var(--color-card) 80%, transparent);
          cursor: not-allowed;
        }
        .vitrina-location-footer p {
          margin: 0;
          color: #8a2120;
          font-size: 0.85rem;
        }
      `}</style>
    </div>
  );
}
