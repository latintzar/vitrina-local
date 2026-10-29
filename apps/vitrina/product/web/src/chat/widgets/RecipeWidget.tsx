/**
 * RecipeWidget — compact chat preview for a buyable recipe.
 *
 * Rendered inline in the assistant's reply when a TikTok / Instagram URL
 * was detected in the user's message. Primary CTA adds to basket (posts
 * to chat with recipe attachment); secondary opens the full RecipeModal.
 */

import { Button, Surface } from '@scope/ui';
import { ingredientQuantityBreakdown } from '../../components/ingredientQuantity';
import { openRecipe } from '../../discover/recipeViewer';
import { thumbnailUrl, type RecipeStockItem, type RecipeVideoDetail } from '../../discover/recipeVideosApi';
import type { VitrinaRecipeAttachment } from '../uiMessageExtras';
import { postChatPrompt } from '../promptBus';

export interface RecipeWidgetProps {
  detail: RecipeVideoDetail;
}

function totalEur(detail: RecipeVideoDetail): number {
  let total = 0;
  for (const group of detail.stock_groups) {
    for (const item of group.items) {
      total += (item.product.price_eur || 0) * ingredientQuantityBreakdown(item).unitsNeeded;
    }
  }
  return total;
}

function ingredientLabel(item: { ingredient?: string; product: { name: string } }): string {
  return (item.ingredient || item.product.name).trim();
}

function quantityLine(item: RecipeStockItem): string {
  const q = ingredientQuantityBreakdown(item);
  return `${ingredientLabel(item)} · Need ${q.needLabel} · Sold ${q.soldAsLabel} · Buy ${q.unitsLabel}`;
}

export function RecipeWidget({ detail }: RecipeWidgetProps) {
  const cover = thumbnailUrl(detail);
  const ingredients = detail.recipe?.ingredients?.length ?? 0;
  const shops = detail.stock_groups.length;
  const total = totalEur(detail);
  const creator = detail.creator?.replace(/^@/, '');

  const recipeAttachment: VitrinaRecipeAttachment = {
    thumbnailUrl: cover,
    recipeTitle: detail.recipe_title || detail.title,
    recipeId: detail.id,
  };

  return (
    <Surface className="vitrina-chat-widget vitrina-recipe-widget">
      <div className="vitrina-recipe-widget__body">
        <header className="vitrina-recipe-widget__head">
          <div className="vitrina-recipe-widget__thumb" data-has-cover={cover ? 'true' : 'false'}>
            {cover ? <img src={cover} alt="" loading="lazy" /> : null}
            <span className="vitrina-recipe-widget__source">{detail.source}</span>
          </div>
          <div className="vitrina-recipe-widget__title">
            <strong>{detail.recipe_title || detail.title}</strong>
            {creator ? <em>@{creator}</em> : null}
          </div>
        </header>

        {detail.stock_groups.length > 0 ? (
          <ul className="vitrina-recipe-widget__shops">
            {detail.stock_groups.map((group) => {
              const names = group.items.map(quantityLine).filter(Boolean);
              const preview = names.slice(0, 4).join(', ');
              const more = names.length > 4 ? ` +${names.length - 4} more` : '';
              return (
                <li key={group.shop.id}>
                  <span className="vitrina-recipe-widget__shopname">{group.shop.name}</span>
                  <span className="vitrina-recipe-widget__items">
                    {preview}
                    {more}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="vitrina-recipe-widget__empty">
            Ask Vitrina to match this recipe to local shops, or tap View to see details.
          </p>
        )}

        <footer className="vitrina-recipe-widget__footer">
          <span>
            {ingredients} ingredients · {shops} {shops === 1 ? 'shop' : 'shops'}
          </span>
          {total > 0 ? (
            <span className="vitrina-recipe-widget__price">{total.toFixed(2)} €</span>
          ) : null}
        </footer>
      </div>
      <div className="vitrina-recipe-widget__cta">
        <Button
          fullWidth
          onClick={() =>
            postChatPrompt({
              prompt: `Add *${detail.recipe_title || detail.title}* for 4 portions. (recipe_id=${detail.id})`,
              attachment: recipeAttachment,
            })
          }
        >
          Add to basket
        </Button>
        <Button fullWidth variant="secondary" onClick={() => openRecipe(detail)}>
          View
        </Button>
      </div>

      <style>{`
        .vitrina-recipe-widget {
          padding: 0;
          margin: 6px 0;
          overflow: hidden;
        }
        .vitrina-recipe-widget__body {
          padding: 12px 12px 10px;
          display: grid;
          gap: 10px;
          color: var(--color-ink);
        }
        .vitrina-recipe-widget__head {
          display: grid;
          grid-template-columns: 64px 1fr;
          gap: 12px;
          align-items: center;
        }
        .vitrina-recipe-widget__thumb {
          position: relative;
          aspect-ratio: 4 / 5;
          border-radius: 6px;
          overflow: hidden;
          background:
            var(--color-cream-dark);
          isolation: isolate;
        }
        .vitrina-recipe-widget__thumb img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .vitrina-recipe-widget__source {
          position: absolute;
          left: 5px;
          top: 5px;
          padding: 2px 6px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.9);
          color: #2a2420;
          font-size: 9px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        .vitrina-recipe-widget__title {
          display: grid;
          gap: 3px;
          min-width: 0;
        }
        .vitrina-recipe-widget__title strong {
          font-family: var(--font-display);
          font-size: 1.05rem;
          line-height: 1.15;
          color: var(--color-ink);
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        .vitrina-recipe-widget__title em {
          color: var(--color-ink-light);
          font-style: normal;
          font-size: 0.78rem;
        }
        .vitrina-recipe-widget__shops {
          list-style: none;
          margin: 0;
          padding: 8px 0 0;
          display: grid;
          gap: 6px;
          border-top: 1px solid color-mix(in srgb, var(--color-ink) 8%, transparent);
        }
        .vitrina-recipe-widget__shops li {
          display: grid;
          grid-template-columns: minmax(0, 0.42fr) minmax(0, 1fr);
          gap: 10px;
          align-items: baseline;
        }
        .vitrina-recipe-widget__shopname {
          font-family: var(--font-display);
          font-size: 0.86rem;
          color: var(--color-ink);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .vitrina-recipe-widget__items {
          color: var(--color-ink-light);
          font-size: 0.82rem;
          line-height: 1.35;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        .vitrina-recipe-widget__empty {
          margin: 0;
          padding-top: 6px;
          color: var(--color-ink-light);
          font-size: 0.85rem;
          border-top: 1px solid color-mix(in srgb, var(--color-ink) 8%, transparent);
        }
        .vitrina-recipe-widget__footer {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 10px;
          padding-top: 4px;
          color: var(--color-ink-light);
          font-size: 0.8rem;
        }
        .vitrina-recipe-widget__price {
          color: var(--color-ink);
          font-weight: 600;
          font-size: 0.92rem;
        }
        .vitrina-recipe-widget__cta {
          padding: 0 12px 12px;
          display: grid;
          gap: 8px;
        }
      `}</style>
    </Surface>
  );
}
