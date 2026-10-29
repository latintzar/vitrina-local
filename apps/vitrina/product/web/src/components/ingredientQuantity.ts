/**
 * Human-readable ingredient quantity math.
 *
 * One rule across recipe cards, basket rows, and chat widgets:
 * show what the recipe needs, what the shop sells, and how many units
 * the shopper must buy. This is intentionally explicit for stressed
 * real-world use: a parent scanning at school pickup, an elderly person,
 * or anyone who needs the basket to feel trustworthy at a glance.
 */

export interface IngredientQuantitySource {
  quantity?: string | number | null;
  quantity_recipe?: string | number | null;
  quantity_purchase?: string | null;
  quantity_g?: number | string | null;
  pack_grams?: number | string | null;
  product?: {
    unit?: string | null;
    unit_size?: string | null;
  } | null;
}

export interface IngredientQuantityBreakdown {
  needLabel: string;
  soldAsLabel: string;
  unitsLabel: string;
  unitsNeeded: number;
}

export function ingredientQuantityBreakdown(
  item: IngredientQuantitySource,
  opts: {
    portionRatio?: number;
    cartQuantity?: number | null;
  } = {},
): IngredientQuantityBreakdown {
  const ratio = Number.isFinite(opts.portionRatio ?? 1) ? opts.portionRatio ?? 1 : 1;
  const quantityG = toNumber(item.quantity_g);
  const recipeQty = item.quantity_recipe ?? item.quantity ?? null;
  const soldAs = formatSoldAs(item);

  const scaledNeedG = quantityG != null ? quantityG * ratio : null;
  const recipeNeed = scaledNeedG != null
    ? formatGrams(scaledNeedG)
    : scaleRecipeQuantity(recipeQty, ratio);

  const computedUnits = unitsFor(item, ratio);
  const unitsNeeded = Math.max(1, opts.cartQuantity ?? computedUnits);
  const unitWord = purchaseUnitWord(item);

  return {
    needLabel: recipeNeed || 'Recipe amount',
    soldAsLabel: soldAs || 'Shop unit',
    unitsLabel: `${unitsNeeded} ${unitWord}${unitsNeeded === 1 || unitWord.endsWith('s') ? '' : 's'}`,
    unitsNeeded,
  };
}

/** True when quantity_purchase describes a weight/volume shop line (not N packs). */
function purchaseStringIsWeightDominant(purchase: string): boolean {
  const t = purchase.trim().toLowerCase();
  if (!t) return false;
  return /\d/.test(t) && /\b(g|kg|г|кг|ml|l|л|мл)\b/.test(t);
}

/** Grams implied by a weight-dominant purchase string (e.g. "250 g"). */
function gramsFromWeightPurchaseString(purchase: string): number | null {
  const m = purchase
    .trim()
    .toLowerCase()
    .match(/^(\d+(?:[.,]\d+)?)\s*(kg|кг|ml|мл|g|г|l|л)\b/);
  if (!m) return null;
  const n = parseNumberish(m[1]);
  if (n == null || n <= 0) return null;
  const u = m[2];
  if (u === 'kg' || u === 'кг') return n * 1000;
  if (u === 'l' || u === 'л') return n * 1000;
  return n;
}

/**
 * Effective pack size in grams from pack_grams or product unit strings
 * (aligned with recipe_videos.unit_parser.parse_pack_grams).
 */
function effectivePackGrams(item: IngredientQuantitySource): number | null {
  const direct = toNumber(item.pack_grams);
  if (direct != null && direct > 0) return direct;
  const unit = (item.product?.unit || '').trim().toLowerCase();
  const size = (item.product?.unit_size || '').trim().toLowerCase();
  if (size) {
    const numM = size.match(/(\d+(?:[.,]\d+)?)/);
    if (numM && numM.index !== undefined) {
      const tail = size.slice(numM.index + numM[0].length).trim();
      const n = parseNumberish(numM[1]);
      if (n != null && n > 0) {
        const gramTokens: [string, number][] = [
          ['кг', 1000],
          ['kg', 1000],
          ['г', 1],
          ['g', 1],
          ['л', 1000],
          ['l', 1000],
          ['мл', 1],
          ['ml', 1],
        ];
        for (const [tok, factor] of gramTokens) {
          if (tail.startsWith(tok)) return n * factor;
        }
        if (/(pc|pcs|piece|pieces|pack|slab|bunch|бр|брой)/.test(tail)) return null;
        if (/(pc|pcs|piece|pieces|pack|slab|bunch|бр|брой)/.test(unit)) return null;
      }
    }
  }
  if (unit === 'kg') return 1000;
  return null;
}

function unitsFor(item: IngredientQuantitySource, ratio: number): number {
  const r = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  const quantityG = toNumber(item.quantity_g);
  const packG = effectivePackGrams(item);

  if (quantityG != null && quantityG > 0 && packG != null && packG > 0) {
    return Math.max(1, Math.ceil((quantityG * r) / packG));
  }

  const qp = (item.quantity_purchase || '').trim();
  if (qp && purchaseStringIsWeightDominant(qp)) {
    const needG = gramsFromWeightPurchaseString(qp);
    if (needG != null && needG > 0 && packG != null && packG > 0) {
      return Math.max(1, Math.ceil((needG * r) / packG));
    }
  }

  if (qp && !purchaseStringIsWeightDominant(qp)) {
    const purchaseCount = firstNumber(qp);
    if (purchaseCount != null && purchaseCount > 0) {
      return Math.max(1, Math.ceil(purchaseCount * r));
    }
  }

  const recipeCount = firstNumber(item.quantity_recipe ?? item.quantity);
  const packPieces = piecesFromUnitSize(item.product?.unit_size);
  if (recipeCount != null && packPieces != null && packPieces > 0) {
    return Math.max(1, Math.ceil((recipeCount * r) / packPieces));
  }

  return 1;
}

function formatSoldAs(item: IngredientQuantitySource): string {
  const size = normaliseUnitText(item.product?.unit_size);
  if (size) return size;
  const unit = normaliseUnitText(item.product?.unit);
  if (unit) return unit;
  const purchase = (item.quantity_purchase || '').trim();
  return purchase;
}

function purchaseUnitWord(item: IngredientQuantitySource): string {
  const purchase = (item.quantity_purchase || '').trim().toLowerCase();
  const match = purchase.match(/^\s*\d+(?:[.,]\d+)?\s+(.+?)\s*$/);
  if (match?.[1]) return singularise(match[1].split(/\s+/)[0]);
  const unit = (item.product?.unit || '').trim().toLowerCase();
  if (unit && !/^(pc|pcs|piece|pieces|unit|units)$/i.test(unit)) return singularise(unit);
  return 'unit';
}

function scaleRecipeQuantity(value: unknown, ratio: number): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number') return formatNumber(value * ratio);
  const text = String(value).trim();
  if (!text) return '';
  const match = text.match(/^(\d+(?:[.,]\d+)?|\d+\s*\/\s*\d+)(.*)$/);
  if (!match) return text;
  const n = parseNumberish(match[1]);
  if (n == null) return text;
  return `${formatNumber(n * ratio)}${match[2] || ''}`.trim();
}

function formatGrams(g: number): string {
  if (g >= 1000) return `${formatNumber(g / 1000)} kg`;
  return `${formatNumber(g)} g`;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '';
  if (Math.abs(value - Math.round(value)) < 0.01) return String(Math.round(value));
  return value.toFixed(value < 10 ? 1 : 0).replace(/\.0$/, '');
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function firstNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const match = value.match(/(\d+(?:[.,]\d+)?|\d+\s*\/\s*\d+)/);
  return match ? parseNumberish(match[1]) : null;
}

function parseNumberish(value: string): number | null {
  const raw = value.trim().replace(',', '.');
  if (raw.includes('/')) {
    const [a, b] = raw.split('/').map((part) => Number(part.trim()));
    return Number.isFinite(a) && Number.isFinite(b) && b !== 0 ? a / b : null;
  }
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function piecesFromUnitSize(value: string | null | undefined): number | null {
  const text = (value || '').toLowerCase();
  if (!/(pc|pcs|piece|pieces|бр|брой)/.test(text)) return null;
  return firstNumber(text) ?? 1;
}

function normaliseUnitText(value: string | null | undefined): string {
  return (value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/(\d)([A-Za-zА-Яа-я])/g, '$1 $2')
    .replace(/\b(KG|G|ML|L|PCS|PC)\b/g, (m) => m.toLowerCase());
}

function singularise(word: string): string {
  if (word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.endsWith('s') && word.length > 3) return word.slice(0, -1);
  return word;
}
