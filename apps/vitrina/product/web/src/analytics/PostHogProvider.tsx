import { PostHogErrorBoundary, PostHogProvider as Provider } from '@posthog/react';
import type { ReactNode } from 'react';

function fallback() {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <div style={{ maxWidth: 420, textAlign: 'center' }}>
        <h1>Something went wrong</h1>
        <p>Please refresh and try again. The error has been captured for the Vitrina team.</p>
      </div>
    </div>
  );
}

export function VitrinaPostHogProvider({ children }: { children: ReactNode }) {
  const key = import.meta.env.VITE_POSTHOG_KEY || import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = import.meta.env.VITE_POSTHOG_HOST || import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com';

  if (!key) return <>{children}</>;

  return (
    <Provider
      apiKey={key}
      options={{
        api_host: host,
        defaults: '2026-01-30',
        capture_pageview: 'history_change',
        autocapture: true,
        session_recording: {
          maskAllInputs: true,        // GDPR: phone/email/address never recorded
          maskTextSelector: '[data-ph-mask]',
        },
        capture_exceptions: true,     // window.onerror + unhandledrejection
        person_profiles: 'identified_only',
      }}
    >
      <PostHogErrorBoundary fallback={fallback}>
        {children}
      </PostHogErrorBoundary>
    </Provider>
  );
}
