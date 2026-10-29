import { describe, expect, it } from 'vitest';
import { ingredientQuantityBreakdown } from './ingredientQuantity';

describe('ingredientQuantityBreakdown purchase units', () => {
  it('does not treat "250 g" in quantity_purchase as 250 packs when grams + pack known', () => {
    const b = ingredientQuantityBreakdown(
      {
        quantity_g: 250,
        quantity_purchase: '250 g',
        pack_grams: 500,
        product: { unit: 'pack', unit_size: '500 g' },
      },
      { portionRatio: 1 },
    );
    expect(b.unitsNeeded).toBe(1);
  });

  it('derives pack from unit_size when pack_grams missing', () => {
    const b = ingredientQuantityBreakdown(
      {
        quantity_g: 800,
        quantity_purchase: '800 g',
        product: { unit: 'pack', unit_size: '500g' },
      },
      { portionRatio: 1 },
    );
    expect(b.unitsNeeded).toBe(2);
  });

  it('parses weight-only purchase against derived pack when quantity_g missing', () => {
    const b = ingredientQuantityBreakdown(
      {
        quantity_purchase: '250 g',
        product: { unit: 'pack', unit_size: '500 g' },
      },
      { portionRatio: 1 },
    );
    expect(b.unitsNeeded).toBe(1);
  });

  it('scales count-style quantity_purchase by portion ratio', () => {
    const b = ingredientQuantityBreakdown(
      {
        quantity_purchase: '2 packs',
        product: { unit: 'pack', unit_size: '400 g' },
      },
      { portionRatio: 2 },
    );
    expect(b.unitsNeeded).toBe(4);
  });
});
