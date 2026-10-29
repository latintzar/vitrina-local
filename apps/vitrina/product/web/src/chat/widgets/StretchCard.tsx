/**
 * StretchCard — chat widget proposing a "stretch" recipe.
 *
 * Emitted by the chat agent after `recipes.stretch_basket` returns a
 * candidate with `reuse_ratio >= 0.5`. The card pitches the saving in
 * one warm line ("Reuses 60% of leftovers · adds €3.20 · same shops")
 * and a primary `[Add stretch recipe]` button that posts a structured
 * prompt back into chat so the agent can call `recipes.add_to_basket`
 * for the candidate.
 */

import { Surface } from '@scope/ui';
import { postChatPrompt } from '../promptBus';

export interface StretchCardProps {
  recipe_id: string;
  title: string;
  reuse_ratio: number;
  leftover_consumed_grams?: number | null;
  additional_cost_eur?: number | null;
  additional_shops?: string[] | null;
  thumbnail_url?: string | null;
}

export function StretchCard(props: StretchCardProps) {
  const {
    recipe_id,
    title,
    reuse_ratio,
    leftover_consumed_grams,
    additional_cost_eur,
    additional_shops,
    thumbnail_url,
  } = props;
  const reusePct = Math.round((reuse_ratio || 0) * 100);
  const sameShops = !additional_shops || additional_shops.length === 0;
  const tagline = [
    `Reuses ${reusePct}% of leftovers`,
    leftover_consumed_grams ? `${Math.round(leftover_consumed_grams)} g` : null,
    additional_cost_eur != null ? `adds €${additional_cost_eur.toFixed(2)}` : null,
    sameShops ? 'same shops' : `+${additional_shops!.length} new shop${additional_shops!.length > 1 ? 's' : ''}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Surface className="vitrina-chat-widget vitrina-stretch-card">
      <div className="vitrina-stretch-card__inner">
        {thumbnail_url ? (
          <div className="vitrina-stretch-card__thumb">
            <img src={thumbnail_url} alt="" loading="lazy" />
          </div>
        ) : null}
        <div className="vitrina-stretch-card__body">
          <span className="vitrina-stretch-card__eyebrow">Stretch your basket</span>
          <strong className="vitrina-stretch-card__title">{title}</strong>
          <span className="vitrina-stretch-card__tag">{tagline}</span>
        </div>
      </div>
      <button
        type="button"
        className="vitrina-stretch-card__cta"
        onClick={() => {
          postChatPrompt(
            `Add stretch recipe *${title}* for 4 portions. (recipe_id=${recipe_id})`,
          );
        }}
      >
        Add stretch recipe
      </button>
      <style>{`
        .vitrina-stretch-card { padding: 0; overflow: hidden; }
        .vitrina-stretch-card__inner {
          display: grid; grid-template-columns: 64px 1fr; gap: 12px;
          padding: 12px;
        }
        .vitrina-stretch-card__thumb {
          width: 64px; aspect-ratio: 4/5; border-radius: 6px;
          overflow: hidden; background: var(--color-cream-dark);
        }
        .vitrina-stretch-card__thumb img { width: 100%; height: 100%; object-fit: cover; }
        .vitrina-stretch-card__body { display: grid; gap: 4px; min-width: 0; }
        .vitrina-stretch-card__eyebrow {
          font-size: 0.7rem; letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--color-ink-light, #6b5a4d);
        }
        .vitrina-stretch-card__title {
          font-family: var(--font-display); font-size: 1.02rem;
          line-height: 1.2; color: var(--color-ink);
        }
        .vitrina-stretch-card__tag {
          color: var(--color-ink-light, #6b5a4d); font-size: 0.82rem;
        }
        .vitrina-stretch-card__cta {
          width: calc(100% - 24px);
          margin: 0 12px 12px;
          appearance: none; border: 0;
          padding: 11px 14px; border-radius: 6px;
          background: var(--color-accent, #d97706);
          color: #fff; font-weight: 600; font-size: 0.95rem;
          cursor: pointer;
        }
        .vitrina-stretch-card__cta:hover { opacity: 0.92; }
        .vitrina-stretch-card__cta:active { transform: scale(0.985); }
      `}</style>
    </Surface>
  );
}
