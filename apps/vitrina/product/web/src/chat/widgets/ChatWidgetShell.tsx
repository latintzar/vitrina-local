/**
 * ChatWidgetShell — unified surface for every chat widget.
 *
 * Before this existed each widget styled its own Surface differently
 * (different padding, radius, margins, CTA placement). Visually that
 * made the chat feel like a grab-bag of cards.
 *
 * The shell provides:
 *   - Consistent outer Surface (padding, radius, margin, ink colour).
 *   - An optional header row (eyebrow / title / subtitle).
 *   - A body slot for whatever the widget needs.
 *   - An optional bottom-right CTA slot rendered with @scope/ui Button,
 *     so all primary actions sit in the same visual position.
 *
 * Bespoke widgets that already have a polished layout (RecipeWidget,
 * StretchCard, ShopProductWidget) opt in just by wrapping their root
 * Surface with the `vitrina-chat-widget` class, which inherits the
 * shared margin / radius / shadow tokens. Simpler ones use the full
 * shell for free unification.
 */

import { Button, Surface } from '@scope/ui';
import type { ReactNode } from 'react';

export interface ChatWidgetShellProps {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  children?: ReactNode;
  cta?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  /** Extra className appended to the outer Surface. */
  className?: string;
}

export function ChatWidgetShell({
  eyebrow,
  title,
  subtitle,
  children,
  cta,
  className,
}: ChatWidgetShellProps) {
  const cls = ['vitrina-chat-widget', className].filter(Boolean).join(' ');
  return (
    <Surface variant="lifted" rounded="lg" padding="none" className={cls}>
      {(eyebrow || title || subtitle) && (
        <header className="vitrina-chat-widget__head">
          {eyebrow ? <span className="vitrina-chat-widget__eyebrow">{eyebrow}</span> : null}
          {title ? <strong className="vitrina-chat-widget__title">{title}</strong> : null}
          {subtitle ? <span className="vitrina-chat-widget__subtitle">{subtitle}</span> : null}
        </header>
      )}
      {children ? <div className="vitrina-chat-widget__body">{children}</div> : null}
      {cta ? (
        <footer className="vitrina-chat-widget__foot">
          <Button onClick={cta.onClick} disabled={cta.disabled}>
            {cta.label}
          </Button>
        </footer>
      ) : null}
      <style>{`
        /* Card chrome — applies to ALL widgets (those that wrap their own
           Surface inherit padding/radius/shadow via this class). */
        .vitrina-chat-widget {
          padding: 14px 16px;
          margin: 8px 0;
          display: grid;
          gap: 10px;
          color: var(--color-ink);
          border-radius: 14px;
          background: var(--color-card, #ffffff);
          box-shadow: 0 1px 0 color-mix(in srgb, var(--color-ink) 6%, transparent),
                      0 8px 24px -16px color-mix(in srgb, var(--color-ink) 18%, transparent);
        }
        .vitrina-chat-widget__head {
          display: grid;
          gap: 2px;
        }
        .vitrina-chat-widget__eyebrow {
          font-size: 0.7rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--color-ink-light, #6b5a4d);
        }
        .vitrina-chat-widget__title {
          font-family: var(--font-display);
          font-size: 1rem;
          line-height: 1.25;
          color: var(--color-ink);
        }
        .vitrina-chat-widget__subtitle {
          font-size: 0.86rem;
          color: var(--color-ink-light, #6b5a4d);
          line-height: 1.35;
        }
        .vitrina-chat-widget__body {
          font-size: 0.92rem;
          color: var(--color-ink);
          line-height: 1.4;
          display: grid;
          gap: 8px;
        }
        .vitrina-chat-widget__foot {
          display: flex;
          justify-content: flex-end;
          padding-top: 4px;
        }
      `}</style>
    </Surface>
  );
}
